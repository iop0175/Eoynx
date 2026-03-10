"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, X, User } from "lucide-react";
import { updateProfile, uploadAvatar, removeAvatar } from "@/app/actions/profile";

type ProfileSettingsClientProps = {
  profile: {
    handle: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  };
};

export default function ProfileSettingsClient({ profile }: ProfileSettingsClientProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = React.useState(profile.display_name || "");
  const [bio, setBio] = React.useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

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
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
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

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:placeholder:text-neutral-600 dark:focus:border-neutral-700";

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          Profile saved successfully!
        </div>
      )}

      {/* Avatar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
        <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Avatar</div>
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </button>
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
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
        <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Profile Info</div>
        <div className="grid gap-4">
          {/* Handle (read-only) */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Handle
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400 dark:text-neutral-600">@</span>
              <input
                value={profile.handle}
                disabled
                className={`${inputClass} cursor-not-allowed opacity-60`}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
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
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
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
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
