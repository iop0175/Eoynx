"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type ImageUploadProps = {
    onImageSelect: (file: File) => void;
    selectedImage: File | null;
    previewUrl: string | null;
};

export function ImageUpload({ onImageSelect, selectedImage, previewUrl }: ImageUploadProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = React.useState(false);

    const handleFiles = (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];
            // 파일 타입 검증
            const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
            if (!allowedTypes.includes(file.type)) {
                alert("Please upload a JPEG, PNG, WebP, or GIF image");
                return;
            }
            // 파일 크기 검증 (5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert("File size must be less than 5MB");
                return;
            }
            onImageSelect(file);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="grid gap-3">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
            />

            {previewUrl ? (
                <div className="relative">
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full rounded-xl object-cover"
                        style={{ maxHeight: "400px" }}
                    />
                    <button
                        type="button"
                        onClick={handleClick}
                        className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80"
                    >
                        Change
                    </button>
                </div>
            ) : (
                <div
                    onClick={handleClick}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${dragActive
                            ? "border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-900"
                            : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                        }`}
                >
                    <div className="text-4xl">📷</div>
                    <div className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Drop image here or click to upload
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        JPEG, PNG, WebP, GIF (max 5MB)
                    </div>
                </div>
            )}
        </div>
    );
}
