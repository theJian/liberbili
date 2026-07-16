import { hmac } from '@noble/hashes/hmac.js';
import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const MIXIN_INDEX = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20,
  34, 44, 52,
] as const;

const BV_TABLE = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 1n << 51n;

export function avToBv(aid: number) {
  const result = [...'BV1000000000'];
  let value = (MAX_AID | BigInt(aid)) ^ XOR_CODE;
  for (let index = 11; value > 0; index -= 1) {
    result[index] = BV_TABLE[Number(value % 58n)];
    value /= 58n;
  }
  [result[3], result[9]] = [result[9], result[3]];
  [result[4], result[7]] = [result[7], result[4]];
  return result.join('');
}

export function bvToAv(bvid: string) {
  const value = [...bvid];
  [value[3], value[9]] = [value[9], value[3]];
  [value[4], value[7]] = [value[7], value[4]];
  const decoded = value.slice(3).reduce((total, character) => total * 58n + BigInt(BV_TABLE.indexOf(character)), 0n);
  return Number((decoded & MASK_CODE) ^ XOR_CODE);
}

export function mixinKey(imgKey: string, subKey: string) {
  const source = imgKey + subKey;
  return MIXIN_INDEX.map((index) => source[index]).join('').slice(0, 32);
}

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, '');

export function signWbi(params: Record<string, string | number>, key: string, now = Date.now()) {
  const wts = Math.round(now / 1000);
  const entries = Object.entries({ ...params, wts }).sort(([a], [b]) => a.localeCompare(b));
  const query = entries.map(([name, value]) => `${encode(name)}=${encode(String(value))}`).join('&');
  return `${query}&w_rid=${bytesToHex(md5(utf8ToBytes(query + key)))}`;
}

export function ticketSignature(timestamp: number) {
  return bytesToHex(hmac(sha256, utf8ToBytes('XgwSnGZ1p'), utf8ToBytes(`ts${timestamp}`)));
}

export function randomHex(bytes: number) {
  const data = new Uint8Array(bytes);
  // Anonymous device-fingerprint entropy, not a security credential.
  for (let index = 0; index < data.length; index += 1) data[index] = Math.floor(Math.random() * 256);
  return bytesToHex(data);
}
