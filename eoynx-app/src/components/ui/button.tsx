import * as React from "react";

type ButtonVariant = "primary" | "neutral" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

export function buttonClass(options?: ButtonClassOptions): string {
  const variant = options?.variant ?? "neutral";
  const size = options?.size ?? "md";

  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-violet-600 text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400",
    neutral:
      "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200",
    secondary:
      "border border-neutral-200 text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900",
    danger:
      "bg-red-600 text-white hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-4 py-3.5 text-sm font-semibold",
  };

  const fullWidth = options?.fullWidth ? "w-full" : "";

  return [base, variants[variant], sizes[size], fullWidth, options?.className ?? ""]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
