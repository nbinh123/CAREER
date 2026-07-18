import React from "react";

const VARIANTS = {
  primary: "bg-chili text-paper active:bg-chili-dark",
  dark: "bg-ink text-paper active:bg-ink-soft",
  outline: "bg-transparent text-ink border border-ink/20 active:bg-ink/5",
  ghost: "bg-transparent text-ink active:bg-ink/5",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  icon: Icon,
  fullWidth = false,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-display font-medium text-sm tracking-wide transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none ${
        VARIANTS[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </button>
  );
}
