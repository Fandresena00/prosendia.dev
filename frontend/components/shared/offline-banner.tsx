/**
 * @file components/shared/offline-banner.tsx
 * @description Non-intrusive banner shown when the app is in offline state.
 *
 * The user can still navigate the app — their session is preserved in memory.
 * Actions that require the backend (save, send…) will fail gracefully.
 */

"use client";

import { useAuthStatus } from "@/features/auth/store/auth.store";
import { IconWifi } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";

export function OfflineBanner() {
  const status = useAuthStatus();
  const isOffline = status === "offline";

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.25 }}
          className="fixed top-0 inset-x-0 z-100 flex items-center justify-center gap-2 bg-amber-500/90 backdrop-blur-sm py-2 px-4 text-[12px] font-medium text-white"
          role="alert"
          aria-live="polite"
        >
          <IconWifi className="h-3.5 w-3.5 opacity-75" />
          Connexion perdue — votre session est préservée. Reconnexion en cours…
        </motion.div>
      )}
    </AnimatePresence>
  );
}
