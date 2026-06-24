import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-body font-semibold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "bg-transparent text-text-secondary hover:text-gold-300 border-none p-0",
    };

    const sizes = {
      sm: "text-xs px-4 py-2",
      md: "text-sm px-8 py-3",
      lg: "text-base px-10 py-4",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], variant !== "ghost" && sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
