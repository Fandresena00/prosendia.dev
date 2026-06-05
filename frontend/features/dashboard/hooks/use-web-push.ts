/**
 * @file features/dashboard/hooks/use-web-push.ts
 *
 * Enregistre le Service Worker et l'abonnement Web Push.
 * Appelé au montage du dashboard uniquement pour Starter/Pro.
 */
"use client";

import { useEffect } from "react";
import { dashboardService } from "../services/dashboard.service";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function useWebPush(planId: string | undefined) {
  const eligible = planId === "STARTER" || planId === "PRO" || planId === "CUSTOM";

  useEffect(() => {
    if (!eligible || !VAPID_PUBLIC_KEY) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    void registerPush();
  }, [eligible]);
}

async function registerPush() {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Déjà abonné — rafraîchir côté serveur
      await dashboardService.subscribePush(existing.toJSON());
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await dashboardService.subscribePush(sub.toJSON());
  } catch {
    // Silencieux — Web Push optionnel
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData  = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
