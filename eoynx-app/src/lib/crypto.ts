/**
 * E2E 암호화 유틸리티
 * Web Crypto API 기반 RSA + AES 하이브리드 암호화
 */

// =====================================================
// Types
// =====================================================

export interface KeyPair {
  publicKey: string;  // Base64 encoded
  privateKey: string; // Base64 encoded
}

export interface EncryptedMessage {
  encryptedContent: string;  // Base64 encoded AES encrypted content
  encryptedKey: string;      // Base64 encoded RSA encrypted AES key
  iv: string;                // Base64 encoded IV
}

// =====================================================
// Key Generation & Management
// =====================================================

export interface CryptoKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * RSA 키쌍 생성 (CryptoKey 객체 반환)
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * JWK JSON 문자열로 된 공개키를 CryptoKey로 변환
 */
export async function importPublicKey(publicKeyJwk: string): Promise<CryptoKey> {
  const jwk = JSON.parse(publicKeyJwk);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"]
  );
}

/**
 * Base64 인코딩된 비밀키를 CryptoKey로 변환
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(privateKeyBase64);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"]
  );
}

// =====================================================
// DM Room Symmetric Key Management
// =====================================================

export interface RoomKeyData {
  rawKey: CryptoKey;           // 복호화된 AES 키 (사용용)
  encryptedKeyForP1: string;   // participant1 공개키로 암호화된 키
  encryptedKeyForP2: string;   // participant2 공개키로 암호화된 키
}

/**
 * DM방용 대칭키 생성 및 양쪽 참가자의 공개키로 암호화
 * @deprecated 단순화된 generateSimpleRoomKey 사용 권장
 */
export async function generateRoomKey(
  participant1PublicKey: CryptoKey,
  participant2PublicKey: CryptoKey
): Promise<RoomKeyData> {
  // AES 대칭키 생성
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // AES 키를 raw 형식으로 내보내기
  const aesKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);

  // 양쪽 참가자의 공개키로 AES 키 암호화
  const encryptedForP1 = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    participant1PublicKey,
    aesKeyBuffer
  );

  const encryptedForP2 = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    participant2PublicKey,
    aesKeyBuffer
  );

  return {
    rawKey: aesKey,
    encryptedKeyForP1: arrayBufferToBase64(encryptedForP1),
    encryptedKeyForP2: arrayBufferToBase64(encryptedForP2),
  };
}

// =====================================================
// Simple Room Key (직접 Base64 저장 방식)
// =====================================================

/**
 * 단순 AES 대칭키 생성 및 Base64 문자열 반환
 * 채팅방 생성 시 호출하여 DB에 직접 저장
 */
export async function generateSimpleRoomKey(): Promise<string> {
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const aesKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);
  return arrayBufferToBase64(aesKeyBuffer);
}

/**
 * Base64 문자열로 저장된 room key를 CryptoKey로 변환
 */
export async function importRoomKey(roomKeyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(roomKeyBase64);
  return await window.crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * 암호화된 대칭키를 개인키로 복호화하여 CryptoKey 반환
 */
export async function decryptRoomKey(
  privateKey: CryptoKey,
  encryptedKey: string
): Promise<CryptoKey> {
  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  
  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKeyBuffer
  );

  return await window.crypto.subtle.importKey(
    "raw",
    aesKeyBuffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * DM방 대칭키로 메시지 암호화
 */
export async function encryptWithRoomKey(
  roomKey: CryptoKey,
  content: string
): Promise<{ encryptedContent: string; iv: string }> {
  const encoder = new TextEncoder();
  const contentBuffer = encoder.encode(content);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    roomKey,
    contentBuffer
  );

  return {
    encryptedContent: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * DM방 대칭키로 메시지 복호화
 */
export async function decryptWithRoomKey(
  roomKey: CryptoKey,
  encryptedContent: string,
  iv: string
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedContent);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    roomKey,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// =====================================================
// Encryption & Decryption (Legacy - per message)
// =====================================================

/**
 * 메시지 암호화 (하이브리드 암호화)
 * 1. AES 세션키 생성
 * 2. AES로 메시지 암호화
 * 3. RSA로 AES 키 암호화
 */
export async function encryptMessage(
  content: string,
  recipientPublicKeyBase64: string
): Promise<EncryptedMessage> {
  // AES 세션키 생성
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // IV 생성
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // AES로 메시지 암호화
  const encoder = new TextEncoder();
  const contentBuffer = encoder.encode(content);
  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aesKey,
    contentBuffer
  );

  // AES 키 추출
  const aesKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);

  // RSA로 AES 키 암호화
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    recipientPublicKey,
    aesKeyBuffer
  );

  return {
    encryptedContent: arrayBufferToBase64(encryptedContentBuffer),
    encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * 메시지 복호화 (CryptoKey 사용)
 * 클라이언트에서 이미 로드된 개인키를 직접 사용
 */
export async function decryptMessage(
  privateKey: CryptoKey,
  encryptedContent: string,
  encryptedKey: string,
  iv: string
): Promise<string> {
  // RSA로 AES 키 복호화
  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    encryptedKeyBuffer
  );

  // AES 키 복원
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyBuffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"]
  );

  // AES로 메시지 복호화
  const ivBuffer = base64ToArrayBuffer(iv);
  const encryptedContentBuffer = base64ToArrayBuffer(encryptedContent);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    aesKey,
    encryptedContentBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// =====================================================
// Local Key Storage (CryptoKey 기반)
// =====================================================

const PRIVATE_KEY_STORAGE_PREFIX = "eoynx_dm_private_key_";

/**
 * 공개키를 JWK JSON 문자열로 내보내기
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey("jwk", publicKey);
  return JSON.stringify(jwk);
}

/**
 * 비밀키를 로컬 스토리지에 저장 (userId별로 구분)
 */
export async function savePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  if (typeof window !== "undefined") {
    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
    localStorage.setItem(PRIVATE_KEY_STORAGE_PREFIX + userId, JSON.stringify(jwk));
  }
}

/**
 * 로컬 스토리지에서 비밀키 불러오기 (CryptoKey 반환)
 */
export async function loadPrivateKey(userId: string): Promise<CryptoKey | null> {
  if (typeof window === "undefined") {
    return null;
  }
  
  const stored = localStorage.getItem(PRIVATE_KEY_STORAGE_PREFIX + userId);
  if (!stored) {
    return null;
  }
  
  try {
    const jwk = JSON.parse(stored);
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["decrypt"]
    );
  } catch (error) {
    console.error("Failed to load private key:", error);
    return null;
  }
}

/**
 * 로컬 스토리지에서 비밀키 삭제
 */
export function clearPrivateKey(userId: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PRIVATE_KEY_STORAGE_PREFIX + userId);
  }
}

/**
 * 비밀키 존재 여부 확인
 */
export function hasPrivateKey(userId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(PRIVATE_KEY_STORAGE_PREFIX + userId) !== null;
}

// =====================================================
// Utility Functions
// =====================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
