"use client";

interface StrengthBarProps {
  password: string;
}

export function StrengthBar({ password }: StrengthBarProps) {
  if (!password.length) return null;

  const len = password.length;
  const level = len < 6 ? 1 : len < 8 ? 2 : len < 12 ? 3 : 4;
  const labels = ["", "Faible", "Moyen", "Fort", "Très fort"];
  const colors = [
    "",
    "text-rose-400",
    "text-amber-400",
    "text-emerald-400",
    "text-emerald-400",
  ];
  const bgFill = [
    "",
    "bg-rose-500/50",
    "bg-amber-500/50",
    "bg-emerald-500/50",
    "bg-emerald-500/70",
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= level ? bgFill[level] : "bg-border/50"
            }`}
          />
        ))}
      </div>
      <span className={`text-[11px] font-medium ${colors[level]}`}>
        {labels[level]}
      </span>
    </div>
  );
}
