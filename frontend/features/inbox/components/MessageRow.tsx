'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  IconCheck,
  IconChecks,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Bot, User } from 'lucide-react';
import type { Msg } from '../types/inbox.types';
import { getBubbleRadius } from '../utils/inbox.utils';
import { FileBubble } from './FileBubble';
import { PhotoGrid } from './PhotoGrid';

interface MessageRowProps {
  msg:            Msg;
  prevMsg?:       Msg;
  nextMsg?:       Msg;
  clientInitials: string;
  clientAvatarUrl?: string | null;
}

/**
 * Renders a single message bubble with avatar, reactions and delivery status.
 * Extracted from ChatView to isolate re-renders.
 */
export function MessageRow({
  msg,
  prevMsg,
  nextMsg,
  clientInitials,
  clientAvatarUrl,
}: MessageRowProps) {
  const isClient = msg.sender === 'client';
  const isAI     = msg.sender === 'ai';
  const prevSame = prevMsg?.sender === msg.sender;
  const nextSame = nextMsg?.sender === msg.sender;

  const br =
    msg.kind === 'photos'
      ? ''
      : getBubbleRadius(isClient, prevSame, nextSame);

  return (
    <div
      className={`flex items-end gap-2 ${
        isClient ? 'justify-start' : 'justify-end'
      } ${prevSame ? 'mt-0.5' : 'mt-3'}`}
    >
      {/* Client avatar */}
      {isClient && !prevSame ? (
        <Avatar className="h-8 w-8 mb-1">
          <AvatarImage src={clientAvatarUrl ?? undefined} alt="Client" />
          <AvatarFallback className="text-xs font-bold">
            {clientInitials}
          </AvatarFallback>
        </Avatar>
      ) : isClient ? (
        <div className="w-8 shrink-0" />
      ) : null}

      <div
        className={`flex flex-col ${
          isClient ? 'items-start' : 'items-end'
        } max-w-[75%]`}
      >
        {/* Sender label (first in run only) */}
        {!prevSame && !isClient && (
          <p className="text-[11px] text-muted-foreground mb-1 px-1 flex items-center gap-1">
            {isAI ? (
              <>
                <Bot className="h-3 w-3" />
                VendeoAI
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                Vous
              </>
            )}
          </p>
        )}

        {/* Text bubble */}
        {msg.kind === 'text' && (
          <div
            className={`px-4 py-2.5 text-[14.5px] leading-relaxed ${br} ${
              msg.failed
                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : isClient
                  ? 'bg-[#F0F2F5] dark:bg-[#3A3B3C] text-foreground'
                  : isAI
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-[#0084FF] text-white'
            } ${msg.pending ? 'opacity-60' : ''}`}
          >
            {msg.content}
          </div>
        )}

        {/* Photos */}
        {msg.kind === 'photos' && msg.photos && (
          <div className={msg.pending ? 'opacity-60' : ''}>
            <PhotoGrid photos={msg.photos} />
          </div>
        )}

        {/* File */}
        {msg.kind === 'file' && msg.file && (
          <div className={msg.pending ? 'opacity-60' : ''}>
            <FileBubble file={msg.file} isClient={isClient} />
          </div>
        )}

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div
            className={`flex gap-0.5 -mt-1 ${isClient ? 'ml-2' : 'mr-2'}`}
          >
            <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-full px-1.5 py-0.5 shadow-sm">
              {msg.reactions.map((r, i) => (
                <span key={i} className="text-xs">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp + delivery status */}
        {!nextSame && (
          <div
            className={`flex items-center gap-1 mt-1 px-0.5 ${
              isClient ? '' : 'flex-row-reverse'
            }`}
          >
            <span className="text-[11px] text-muted-foreground">{msg.time}</span>

            {msg.failed && (
              <IconAlertCircle className="h-3 w-3 text-destructive" />
            )}

            {!isClient && !msg.failed && (
              msg.pending ? (
                <IconCheck className="h-3 w-3 text-muted-foreground" />
              ) : (
                <IconChecks className="h-3.5 w-3.5 text-primary" />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
