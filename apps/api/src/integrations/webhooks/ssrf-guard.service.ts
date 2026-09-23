import { Injectable, BadRequestException } from '@nestjs/common';
import * as net from 'net';
import * as dns from 'dns/promises';

function ipToInt(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function isPrivateIpv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const ipInt = ipToInt(ip);
  const ranges: Array<{ start: string; prefix: number }> = [
    { start: '10.0.0.0', prefix: 8 },
    { start: '172.16.0.0', prefix: 12 },
    { start: '192.168.0.0', prefix: 16 },
    { start: '127.0.0.0', prefix: 8 },
    { start: '169.254.0.0', prefix: 16 },
  ];
  for (const range of ranges) {
    const rangeInt = ipToInt(range.start);
    const mask = (~0 << (32 - range.prefix)) >>> 0;
    if ((ipInt & mask) === (rangeInt & mask)) return true;
  }
  return false;
}

@Injectable()
export class SsrfGuardService {
  async validateEndpoint(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Webhook endpoint must be a valid URL');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook endpoint must use HTTPS');
    }

    const hostname = parsed.hostname;

    if (hostname === 'localhost' || hostname === '0.0.0.0') {
      throw new BadRequestException(
        'Webhook endpoint must not point to a private or loopback address',
      );
    }

    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (net.isIPv4(addr.address) && isPrivateIpv4(addr.address)) {
          throw new BadRequestException(
            'Webhook endpoint must not resolve to a private or loopback address',
          );
        }
        if (
          net.isIPv6(addr.address) &&
          (addr.address === '::1' ||
            addr.address.startsWith('fc') ||
            addr.address.startsWith('fd'))
        ) {
          throw new BadRequestException(
            'Webhook endpoint must not resolve to a private IPv6 address',
          );
        }
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        'Webhook endpoint hostname could not be resolved',
      );
    }
  }
}
