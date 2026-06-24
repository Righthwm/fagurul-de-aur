import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  color?: "gold" | "green" | "amber";
  className?: string;
}

export function Badge({ children, color = "gold", className }: BadgeProps) {
  const colors = {
    gold: "bg-gold-400/15 text-gold-300 border border-gold-400/30",
    green: "bg-success/15 text-success border border-success/30",
    amber: "bg-amber-400/15 text-amber-300 border border-amber-400/30",
  };

  return (
    <span
      className={cn(
        "inline-block px-2.5 py-0.5 rounded-sm text-xs font-body font-semibold tracking-wider uppercase",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}
