import { CredentialEncryptionService } from '../credentials/credential-encryption.service';

describe('CredentialEncryptionService', () => {
  let service: CredentialEncryptionService;

  beforeEach(() => {
    service = new CredentialEncryptionService();
  });

  it('should encrypt and decrypt a plaintext string symmetrically', () => {
    const plaintext = 'sk_live_secret_key_1234567890';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted.encryptedValue).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.fingerprint).toHaveLength(16);
    expect(encrypted.encryptedValue).not.toContain(plaintext);

    const decrypted = service.decrypt(
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe(plaintext);
  });

  it('should generate unique IV and ciphertext for identical plaintexts', () => {
    const plaintext = 'same_secret_token';
    const enc1 = service.encrypt(plaintext);
    const enc2 = service.encrypt(plaintext);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.encryptedValue).not.toBe(enc2.encryptedValue);
    // But fingerprints should match because plaintext is identical
    expect(enc1.fingerprint).toBe(enc2.fingerprint);
  });

  it('should fail decryption if ciphertext is tampered with (authenticated encryption)', () => {
    const plaintext = 'my_important_secret';
    const encrypted = service.encrypt(plaintext);

    // Tamper with first byte of ciphertext
    const tamperedHex =
      (encrypted.encryptedValue[0] === 'a' ? 'b' : 'a') +
      encrypted.encryptedValue.substring(1);

    expect(() => {
      service.decrypt(tamperedHex, encrypted.iv, encrypted.authTag);
    }).toThrow();
  });

  it('should fail decryption if auth tag is tampered with', () => {
    const plaintext = 'my_important_secret';
    const encrypted = service.encrypt(plaintext);

    const tamperedTag =
      (encrypted.authTag[0] === '0' ? '1' : '0') +
      encrypted.authTag.substring(1);

    expect(() => {
      service.decrypt(encrypted.encryptedValue, encrypted.iv, tamperedTag);
    }).toThrow();
  });
});
