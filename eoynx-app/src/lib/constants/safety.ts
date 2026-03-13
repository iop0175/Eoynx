/**
 * Report reason constants
 * Separated from server actions to avoid "use server" export restrictions
 */

export type ReportReason = 
  | "spam"
  | "harassment" 
  | "inappropriate"
  | "fake"
  | "violence"
  | "other";

export const REPORT_REASONS: Record<ReportReason, string> = {
  spam: "스팸 또는 광고",
  harassment: "괴롭힘 또는 혐오 발언",
  inappropriate: "부적절한 콘텐츠",
  fake: "허위 정보",
  violence: "폭력적인 콘텐츠",
  other: "기타",
};
