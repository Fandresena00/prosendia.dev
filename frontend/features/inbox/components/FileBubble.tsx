'use client';

import type { FileAttachment } from '../types/inbox.types';

// ─── FileBubble ───────────────────────────────────────────────────────────────

export function FileBubble({
  file,
  isClient,
}: {
  file: FileAttachment;
  isClient: boolean;
}) {
  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 max-w-[280px] ${
        isClient
          ? 'bg-[#F0F2F5] dark:bg-[#3A3B3C]'
          : 'bg-primary text-primary-foreground'
      }`}
    >
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold ${
          isClient
            ? 'bg-white/60 dark:bg-black/20 text-foreground'
            : 'bg-white/20 text-primary-foreground'
        }`}
      >
        {ext}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${
            isClient ? '' : 'text-primary-foreground'
          }`}
        >
          {file.name}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            isClient ? 'text-muted-foreground' : 'text-primary-foreground/70'
          }`}
        >
          {file.size ?? '—'}
        </p>
      </div>
    </div>
  );
}
