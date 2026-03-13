"use client";

import * as React from "react";
import { X } from "lucide-react";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants/safety";
import { reportUser, reportItem, reportComment } from "@/app/actions/safety";

type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "user" | "item" | "comment";
  targetId: string;
  targetName?: string;
};

export function ReportModal({ isOpen, onClose, type, targetId, targetName }: ReportModalProps) {
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason) {
      setError("신고 사유를 선택해주세요");
      return;
    }

    setLoading(true);
    setError(null);

    let result;
    switch (type) {
      case "user":
        result = await reportUser(targetId, reason, description);
        break;
      case "item":
        result = await reportItem(targetId, reason, description);
        break;
      case "comment":
        result = await reportComment(targetId, reason, description);
        break;
    }

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason("");
        setDescription("");
      }, 1500);
    }
  };

  if (!isOpen) return null;

  const typeLabel = type === "user" ? "사용자" : type === "item" ? "아이템" : "댓글";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-neutral-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {success ? "신고 완료" : `${typeLabel} 신고`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="mb-2 text-4xl">✓</div>
            <p className="text-neutral-600 dark:text-neutral-400">
              신고가 접수되었습니다. 검토 후 조치하겠습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {targetName && (
              <div className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
                신고 대상: <span className="font-medium">{targetName}</span>
              </div>
            )}

            {/* Reason selection */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">신고 사유</label>
              <div className="grid gap-2">
                {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      reason === key
                        ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/30"
                        : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={key}
                      checked={reason === key}
                      onChange={() => setReason(key)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        reason === key
                          ? "border-red-500 bg-red-500"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {reason === key && (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional description */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">
                추가 설명 (선택)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="신고와 관련된 추가 정보를 입력해주세요..."
                maxLength={500}
                className="h-24 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-red-500 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-red-600"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !reason}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? "제출 중..." : "신고하기"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
