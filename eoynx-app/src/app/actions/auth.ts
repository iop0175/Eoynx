"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthResult = { error?: string; success?: string } | void;

const PRIVACY_CONSENT_VERSION = "2026-03-13";

async function getActionLocale(): Promise<"ko" | "en"> {
  const cookieStore = await cookies();
  return cookieStore.get("locale")?.value === "ko" ? "ko" : "en";
}

export async function signInWithEmail(formData: FormData): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function signUpWithEmail(formData: FormData): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const locale = await getActionLocale();

  const hasPrivacyConsent = formData.get("privacyConsent") === "yes";
  if (!hasPrivacyConsent) {
    return {
      error:
        locale === "ko"
          ? "개인정보 수집 및 이용 동의가 필요합니다."
          : "Privacy consent is required.",
    };
  }

  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();
  const countryCodeRaw = String(formData.get("countryCode") ?? "").trim().toUpperCase();

  if (!birthDateRaw) {
    return { error: locale === "ko" ? "생년월일을 입력해주세요." : "Birth date is required." };
  }

  const parsedBirth = new Date(`${birthDateRaw}T00:00:00Z`);
  if (Number.isNaN(parsedBirth.getTime())) {
    return { error: locale === "ko" ? "생년월일 형식이 올바르지 않습니다." : "Invalid birth date format." };
  }

  const today = new Date();
  const minBirth = new Date(Date.UTC(today.getUTCFullYear() - 100, today.getUTCMonth(), today.getUTCDate()));
  const maxBirth = new Date(Date.UTC(today.getUTCFullYear() - 13, today.getUTCMonth(), today.getUTCDate()));
  if (parsedBirth < minBirth || parsedBirth > maxBirth) {
    return {
      error:
        locale === "ko"
          ? "가입 가능 연령(13세 이상) 및 생년월일 범위를 확인해주세요."
          : "Please provide a valid birth date (age 13+).",
    };
  }

  if (!/^[A-Z]{2}$/.test(countryCodeRaw)) {
    return { error: locale === "ko" ? "국가 코드를 선택해주세요." : "Please select your country." };
  }

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        privacy_consent: true,
        privacy_consent_version: PRIVACY_CONSENT_VERSION,
        privacy_consent_at: new Date().toISOString(),
        birth_date: birthDateRaw,
        country_code: countryCodeRaw,
      },
    },
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: "Check your email for confirmation link" };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const locale = await getActionLocale();
  const text = {
    signInRequired: locale === "ko" ? "로그인이 필요합니다." : "You need to sign in.",
    confirmRequired:
      locale === "ko"
        ? "계정 탈퇴를 위해 DELETE를 정확히 입력해주세요."
        : "Type DELETE exactly to confirm account deletion.",
    deletedSuccess:
      locale === "ko"
        ? "회원 탈퇴가 완료되었습니다. 다시 가입할 수 있습니다."
        : "Account deleted successfully. You can sign up again.",
    verifyFailed:
      locale === "ko"
        ? "탈퇴 검증에 실패했습니다. 잠시 후 다시 시도해주세요."
        : "Account deletion verification failed. Please try again.",
  };

  const confirmText = String(formData.get("confirmText") ?? "").trim();

  if (confirmText !== "DELETE") {
    redirect("/settings?error=" + encodeURIComponent(text.confirmRequired));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/settings?error=" + encodeURIComponent(text.signInRequired));
  }

  const { error: deleteError } = await supabase.rpc("delete_my_account");

  if (deleteError) {
    const migrationHint =
      locale === "ko"
        ? "DB 마이그레이션이 필요합니다. supabase migration을 먼저 적용해주세요."
        : "Database migration is required. Apply Supabase migrations first.";
    const errorMessage =
      deleteError.message.includes("Could not find the function")
        ? migrationHint
        : deleteError.message;

    redirect("/settings?error=" + encodeURIComponent(errorMessage));
  }

  const {
    data: { user: remainingUser },
    error: remainingUserError,
  } = await supabase.auth.getUser();

  if (!remainingUserError && remainingUser) {
    redirect("/settings?error=" + encodeURIComponent(text.verifyFailed));
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(
    "/auth?success=" + encodeURIComponent(text.deletedSuccess)
  );
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://eoynx.com").trim();

  const callbackUrl = new URL(
    `${siteUrl}/auth/callback`
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // OAuth callback must hit the callback route for code exchange/session setup.
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function acceptPrivacyConsent(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const nextPath = String(formData.get("next") ?? "/feed");
  const consent = formData.get("privacyConsent") === "yes";

  if (!consent) {
    redirect(
      "/auth/consent?error=" +
        encodeURIComponent("개인정보 수집 및 이용 동의가 필요합니다.") +
        "&next=" +
        encodeURIComponent(nextPath)
    );
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      privacy_consent: true,
      privacy_consent_version: PRIVACY_CONSENT_VERSION,
      privacy_consent_at: new Date().toISOString(),
    },
  });

  if (error) {
    redirect(
      "/auth/consent?error=" +
        encodeURIComponent(error.message) +
        "&next=" +
        encodeURIComponent(nextPath)
    );
  }

  redirect(nextPath.startsWith("/") ? nextPath : "/feed");
}
