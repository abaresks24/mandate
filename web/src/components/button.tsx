import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

// Refined button system shared across landing + app.
// primary   = NEAR green bg, black text (legible on #00EC97), used sparingly.
// secondary = black outline, subtle.
// ghost     = text only.
const variants: Record<Variant, string> = {
  primary: "bg-near text-ink hover:brightness-95 border border-transparent",
  secondary:
    "bg-paper text-ink border border-ink/80 hover:bg-ink hover:text-paper",
  ghost: "bg-transparent text-ink/70 hover:text-ink border border-transparent",
};

const sizes: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className, type = "button", ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
