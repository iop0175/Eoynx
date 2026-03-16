import * as SecureStore from "expo-secure-store";
import { decode, encode } from "base64-arraybuffer";

const PRIVATE_KEY_STORAGE_PREFIX = "eoynx_dm_private_key_";

const canUseWebCrypto = () =>
  typeof globalThis !== "undefined" &&
  !!globalThis.crypto &&
  !!globalThis.crypto.subtle;

export async function generateEncryptionKeyPair() {
  if (!canUseWebCrypto()) {
    throw new Error("WebCrypto is not available");
  }

  return await globalThis.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<string> {
  const jwk = await globalThis.crypto.subtle.exportKey("jwk", publicKey);
  return JSON.stringify(jwk);
}

export async function savePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  const jwk = await globalThis.crypto.subtle.exportKey("jwk", privateKey);
  await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_PREFIX + userId, JSON.stringify(jwk));
}

export async function loadPrivateKey(userId: string): Promise<CryptoKey | null> {
  const stored = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_PREFIX + userId);
  if (!stored) return null;

  const jwk = JSON.parse(stored);
  return await globalThis.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"],
  );
}

export async function hasPrivateKey(userId: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_PREFIX + userId);
  return Boolean(stored);
}

export async function decryptRoomKeyWithPrivateKey(
  privateKey: CryptoKey,
  encryptedKeyBase64: string,
): Promise<string> {
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    decode(encryptedKeyBase64),
  );
  return encode(decrypted);
}

export async function encryptRoomKeyForPublicKey(
  publicKeyJwk: string,
  roomKeyBase64: string,
): Promise<string> {
  const publicKey = await globalThis.crypto.subtle.importKey(
    "jwk",
    JSON.parse(publicKeyJwk),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );

  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    decode(roomKeyBase64),
  );

  return encode(encrypted);
}
