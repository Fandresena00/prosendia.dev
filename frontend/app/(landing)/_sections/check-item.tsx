import { Check } from "lucide-react";

export function CheckItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Check className="h-2.5 w-2.5 text-primary" />
      </span>
      {text}
    </li>
  );
}
