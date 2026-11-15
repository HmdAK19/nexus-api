import { promises as dns } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';

import { AppError } from '../errors/AppError.js';

function isUnsafeIpv4(address: string) {
  const [first = -1, second = -1] = address.split('.').map(Number);
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isUnsafeIp(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return isUnsafeIpv4(normalized);
  if (isIP(normalized) !== 6) return false;
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
    return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isUnsafeIpv4(mappedIpv4) : false;
}

export function parsePublicHttpsUrl(value: string, label = 'URL') {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(`${label} is invalid.`, 422, 'INVALID_PUBLIC_URL');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isUnsafeIp(hostname) ||
    url.username ||
    url.password
  ) {
    throw new AppError(`${label} must be a public HTTPS endpoint.`, 422, 'UNSAFE_PUBLIC_URL');
  }
  return url;
}

export async function assertPublicHttpsUrl(value: string, label = 'URL') {
  const url = parsePublicHttpsUrl(value, label);
  if (!isIP(url.hostname)) {
    let addresses: LookupAddress[];
    try {
      addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new AppError(`${label} hostname could not be resolved.`, 422, 'UNRESOLVED_PUBLIC_URL');
    }
    if (addresses.length === 0 || addresses.some(({ address }) => isUnsafeIp(address))) {
      throw new AppError(`${label} resolves to a private network.`, 422, 'UNSAFE_PUBLIC_URL');
    }
  }
  return url;
}
