import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
  fingerprint: string;
}

@Injectable()
export class CredentialEncryptionService {
  private readonly algorithm = 'aes-256-gcm';

  private getMasterKey(): Buffer {
    const envKey = process.env.INTEGRATION_MASTER_KEY;
    if (envKey) {
      const keyBuffer = Buffer.from(envKey, 'hex');
      if (keyBuffer.length === 32) {
        return keyBuffer;
      }
    }
    return crypto
      .createHash('sha256')
      .update('dev-integration-master-key-not-for-prod')
      .digest();
  }

  encrypt(plaintext: string): EncryptedData {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const fingerprint = crypto
      .createHash('sha256')
      .update(plaintext)
      .digest('hex')
      .substring(0, 16);
    return {
      encryptedValue: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      fingerprint,
    };
  }

  decrypt(encryptedValue: string, iv: string, authTag: string): string {
    const key = this.getMasterKey();
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
