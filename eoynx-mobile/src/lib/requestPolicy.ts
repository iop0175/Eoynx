import type { AuthError, PostgrestError } from "@supabase/supabase-js";

type AppLanguage = "en" | "ko";

export type ApiErrorLike =
  | AuthError
  | PostgrestError
  | Error
  | {
      message?: string | null;
      name?: string | null;
      status?: number | string | null;
      code?: string | null;
    }
  | null
  | undefined;

type ErrorCarrier = {
  error?: ApiErrorLike;
};

type RequestPolicyOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 350;

const LOCALIZED_MESSAGES = {
  en: {
    network: "Network connection is unstable. Please check your connection and try again.",
    timeout: "The request took too long. Please try again.",
    unknown: "Something went wrong. Please try again.",
  },
  ko: {
    network: "네트워크 연결이 불안정합니다. 연결 상태를 확인한 뒤 다시 시도해주세요.",
    timeout: "요청 시간이 초과되었습니다. 다시 시도해주세요.",
    unknown: "문제가 발생했습니다. 다시 시도해주세요.",
  },
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const extractRequestError = (value: unknown): ApiErrorLike => {
  if (value instanceof Error) return value;
  if (isObject(value) && "error" in value) {
    return (value as ErrorCarrier).error ?? null;
  }
  return null;
};

const isTimeoutError = (error: ApiErrorLike) => {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  const name = typeof error?.name === "string" ? error.name.toLowerCase() : "";
  return message.includes("timeout") || name.includes("timeout");
};

const isNetworkError = (error: ApiErrorLike) => {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("socket") ||
    message.includes("offline") ||
    message.includes("connection")
  );
};

const hasServerStatus = (error: ApiErrorLike) => {
  const statusValue =
    isObject(error) && "status" in error
      ? (error.status as number | string | null | undefined)
      : undefined;
  const status =
    typeof statusValue === "number"
      ? statusValue
      : typeof statusValue === "string"
        ? Number(statusValue)
        : Number.NaN;
  return Number.isFinite(status) && status >= 500;
};

export const isRetryableRequestError = (error: ApiErrorLike) =>
  isTimeoutError(error) || isNetworkError(error) || hasServerStatus(error);

const withTimeout = async <T>(promise: PromiseLike<T> | T, timeoutMs: number) => {
  return await Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    }),
  ]);
};

export async function runRequestWithPolicy<T>(
  operation: () => PromiseLike<T> | T,
  options?: RequestPolicyOptions
): Promise<T> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let attempt = 0;

  while (true) {
    try {
      const result = await withTimeout(operation(), timeoutMs);
      const error = extractRequestError(result);
      if (error && attempt < retries && isRetryableRequestError(error)) {
        attempt += 1;
        await sleep(retryDelayMs * attempt);
        continue;
      }
      return result;
    } catch (error) {
      if (attempt < retries && isRetryableRequestError(error as ApiErrorLike)) {
        attempt += 1;
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw error;
    }
  }
}

export const getRequestErrorMessage = (
  language: AppLanguage,
  error: ApiErrorLike,
  fallbackMessage?: string
) => {
  if (isTimeoutError(error)) {
    return LOCALIZED_MESSAGES[language].timeout;
  }
  if (isNetworkError(error)) {
    return LOCALIZED_MESSAGES[language].network;
  }
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (message) return message;
  return fallbackMessage ?? LOCALIZED_MESSAGES[language].unknown;
};
