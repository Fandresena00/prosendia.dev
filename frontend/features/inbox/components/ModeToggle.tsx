'use client';

import { Bot, Hand } from 'lucide-react';
import type { ConvMode } from '../types/inbox.types';

interface ModeToggleProps {
  mode:     ConvMode;
  onChange: (mode: ConvMode) => void;
}

/**
 * AI / Human handover toggle.
 * Active mode is highlighted; clicking the inactive button switches mode.
 */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-secondary/60 rounded-full p-0.5 border border-border/40">
      <button
        type="button"
        onClick={() => onChange('ai')}
        className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-all ${
          mode === 'ai'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Bot className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden md:inline">Mode IA</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('human')}
        className={`flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-all ${
          mode === 'human'
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Hand className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden md:inline">Prendre en main</span>
      </button>
    </div>
  );
}
