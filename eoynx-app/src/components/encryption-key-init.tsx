"use client";

import { useEffect, useRef } from "react";
import {
  generateKeyPair,
  exportPublicKey,
  savePrivateKey,
  hasPrivateKey,
} from "@/lib/crypto";
import { saveEncryptionPublicKey, getEncryptionPublicKey } from "@/app/actions/profile";

interface EncryptionKeyInitProps {
  userId: string | null;
}

/**
 * 로그인한 사용자의 암호화 키를 자동으로 초기화하는 컴포넌트
 * - 개인키가 없으면 새 키쌍 생성
 * - 공개키를 서버에 저장  
 */
export function EncryptionKeyInit({ userId }: EncryptionKeyInitProps) {
  const initAttempted = useRef(false);

  useEffect(() => {
    if (!userId || initAttempted.current) return;
    initAttempted.current = true;

    const currentUserId = userId; // TypeScript narrowing

    async function initEncryptionKeys() {
      try {
        // 이미 개인키가 있으면 종료
        if (hasPrivateKey(currentUserId)) {
          // 서버에 공개키가 있는지 확인
          const { publicKey: existingKey } = await getEncryptionPublicKey(currentUserId);
          if (existingKey) {
            return; // 이미 모든 키가 설정됨
          }
          // 개인키만 있고 공개키가 없는 경우 (드문 케이스)
          // 새로 생성해야 함
        }

        // 키쌍 생성
        const keyPair = await generateKeyPair();

        // 개인키 로컬 저장
        await savePrivateKey(currentUserId, keyPair.privateKey);

        // 공개키 서버에 저장
        const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
        await saveEncryptionPublicKey(publicKeyJwk);

        console.log("Encryption keys initialized successfully");
      } catch (error) {
        console.error("Failed to initialize encryption keys:", error);
      }
    }

    initEncryptionKeys();
  }, [userId]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}
