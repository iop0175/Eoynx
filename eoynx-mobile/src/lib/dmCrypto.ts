import { decode, encode } from "base64-arraybuffer";

export const DM_CRYPTO_SPEC = "aes-gcm-v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

export const canUseWebCrypto = (): boolean =>
  typeof globalThis !== "undefined" &&
  !!globalThis.crypto &&
  !!globalThis.crypto.subtle &&
  !!globalThis.crypto.getRandomValues;

export async function generateSimpleRoomKey(): Promise<string | null> {
  if (!canUseWebCrypto()) return null;
  try {
    const aesKey = await globalThis.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"],
    );
    const raw = await globalThis.crypto.subtle.exportKey("raw", aesKey);
    return encode(raw);
  } catch {
    return null;
  }
}

export async function importRoomKey(roomKeyBase64: string): Promise<CryptoKey | null> {
  if (!canUseWebCrypto()) return null;
  try {
    return await globalThis.crypto.subtle.importKey(
      "raw",
      decode(roomKeyBase64),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export async function encryptWithRoomKey(
  roomKey: CryptoKey,
  content: string,
): Promise<{ encryptedContent: string; iv: string } | null> {
  if (!canUseWebCrypto()) return null;
  try {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      roomKey,
      enc.encode(content),
    );
    return {
      encryptedContent: encode(encrypted),
      iv: encode(iv.buffer as ArrayBuffer),
    };
  } catch {
    return null;
  }
}

export async function decryptWithRoomKey(
  roomKey: CryptoKey,
  encryptedContentBase64: string,
  ivBase64: string,
): Promise<string | null> {
  if (!canUseWebCrypto()) return null;
  try {
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(decode(ivBase64)) },
      roomKey,
      decode(encryptedContentBase64),
    );
    return dec.decode(decrypted);
  } catch {
    return null;
  }
}

export async function decryptDMContent(
  roomKeyBase64: string,
  encryptedContentBase64: string,
  ivBase64: string,
): Promise<string | null> {
  const roomKey = await importRoomKey(roomKeyBase64);
  if (!roomKey) return null;
  return decryptWithRoomKey(roomKey, encryptedContentBase64, ivBase64);
}

export async function encryptDMContent(
  roomKeyBase64: string,
  content: string,
): Promise<{ encryptedContent: string; iv: string } | null> {
  const roomKey = await importRoomKey(roomKeyBase64);
  if (!roomKey) return null;
  return encryptWithRoomKey(roomKey, content);
}

export function generateDMRoomKey(): string | null {
  if (!canUseWebCrypto()) return null;
  try {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    return encode(key.buffer as ArrayBuffer);
  } catch {
    return null;
  }
}
