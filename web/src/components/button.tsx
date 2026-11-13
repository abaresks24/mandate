import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

// Button system shared across landing + app (Sagittaire reskin).
// primary   = crimson bg, cream text, embossed — used sparingly.
// secondary = parchment outline, crimson on hover.
// ghost     = text only.
const variants: Record<Variant, string> = {
  primary:
    "bg-near text-cream border border-red-edge shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_2px_10px_rgba(184,23,28,0.35)] hover:bg-red-edge",
  secondary:
    "bg-paper text-ink border border-edge hover:border-near hover:text-near",
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
