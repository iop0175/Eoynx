"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, X, User, Check, AlertCircle, Loader2 } from "lucide-react";
import { updateProfile, uploadAvatar, removeAvatar, checkHandleAvailability } from "@/app/actions/profile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  UI_FIELD_LABEL,
  UI_INPUT_BASE,
  UI_SECTION_CARD,
  UI_SECTION_TITLE,
} from "@/components/ui/ui-classes";

type ProfileSettingsClientProps = {
  profile: {
    handle: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    dm_open: boolean;
  };
};

export default function ProfileSettingsClient({ profile }: ProfileSettingsClientProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [handle, setHandle] = React.useState(profile.handle);
  const [handleStatus, setHandleStatus] = React.useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [handleError, setHandleError] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState(profile.display_name || "");
  const [bio, setBio] = React.useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Debounced handle availability check
  React.useEffect(() => {
    const trimmedHandle = handle.toLowerCase().trim();
    
    // If same as original, reset status
    if (trimmedHandle === profile.handle) {
      setHandleStatus("idle");
      setHandleError(null);
      return;
    }

    // Basic format validation
    if (trimmedHandle.length < 3) {
      setHandleStatus("unavailable");
      setHandleError("최소 3자 이상 입력하세요");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(trimmedHandle)) {
      setHandleStatus("unavailable");
      setHandleError("영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다");
      return;
    }

    setHandleStatus("checking");
    setHandleError(null);

    const checkHandle = async () => {
      const result = await checkHandleAvailability(trimmedHandle);
      if (result.available) {
        setHandleStatus("available");
        setHandleError(null);
      } else {
        setHandleStatus("unavailable");
        setHandleError(result.error || "이미 사용 중인 핸들입니다");
      }
    };

    const timer = setTimeout(checkHandle, 500);
    return () => clearTimeout(timer);
  }, [handle, profile.handle]);

  // Handle avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadAvatar(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        setAvatarUrl(result.url);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove avatar
  const handleRemoveAvatar = async () => {
    setUploading(true);
    setError(null);

    try {
      const result = await removeAvatar();
      if (result.error) {
        setError(result.error);
      } else {
        setAvatarUrl(null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to remove avatar");
    } finally {
      setUploading(false);
    }
  };

  // Save profile
  const handleSave = async () => {
    // Don't save if handle is invalid
    if (handle !== profile.handle && handleStatus !== "available") {
      setError(handleError || "핸들을 확인해주세요");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateProfile({
        handle: handle.toLowerCase().trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        // If handle changed, update local state
        if (result.newHandle) {
          setHandle(result.newHandle);
          setHandleStatus("idle");
        }
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = UI_INPUT_BASE;

  return (
    <div className="grid gap-4">
      {error && (
        <Alert tone="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert tone="success">
          Profile saved successfully!
        </Alert>
      )}

      {/* Avatar */}
      <div className={UI_SECTION_CARD}>
        <div className={UI_SECTION_TITLE}>Avatar</div>
        <div className="flex items-center gap-4">
          {/* Avatar preview */}
          <div className="relative">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                aria-label="Remove avatar"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Upload button */}
          <div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant="secondary"
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              JPG, PNG. Max 2MB.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Profile Info */}
      <div className={UI_SECTION_CARD}>
        <div className={UI_SECTION_TITLE}>Profile Info</div>
        <div className="grid gap-4">
          {/* Handle (editable with validation) */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Handle (고유 ID)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400 dark:text-neutral-600">@</span>
              <div className="relative flex-1">
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="your_handle"
                  maxLength={30}
                  className={`${inputClass} pr-10 ${
                    handleStatus === "unavailable" ? "border-red-400 dark:border-red-600" : 
                    handleStatus === "available" ? "border-green-400 dark:border-green-600" : ""
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {handleStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                  )}
                  {handleStatus === "available" && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {handleStatus === "unavailable" && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            </div>
            {handleError && (
              <p className="mt-1 text-xs text-red-500">{handleError}</p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              영문 소문자, 숫자, 밑줄(_) 가능 / 3-30자
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className={inputClass}
            />
          </div>

          {/* Bio */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={160}
              className={`${inputClass} min-h-24 resize-none`}
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {bio.length}/160
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
            size="lg"
            fullWidth
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
