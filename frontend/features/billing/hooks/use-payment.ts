/**
 * @file features/billing/hooks/use-payment.ts
 *
 * Hook qui gère le flow de paiement Papi :
 *   1. Appel API initiate → reçoit paymentLink
 *   2. Redirige le user vers paymentLink
 *   3. Papi notifie le backend, qui active l'abonnement
 *   4. Page success/failure gérée par Next.js
 */

"use client";

import { useState } from "react";
import { billingService } from "../services/billing.service";
import type { PaymentProvider } from "../types/billing.types";

type PaymentState = "idle" | "loading" | "redirecting" | "error";

interface UsePaymentReturn {
  state:       PaymentState;
  errorMsg:    string | null;
  pay: (
    planId:     string,
    provider:   PaymentProvider,
    phone:      string,   // format local ex: "341234567"
    payerName:  string,
  ) => Promise<void>;
  reset: () => void;
}

/**
 * Convertit un numéro local en format E.164 (+261XXXXXXXXX).
 * Accepte "034XXXXXXX", "34XXXXXXX", "0034XXXXXXX" ou déjà "+261XXXXXXXXX".
 */
export function toMalagasyE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("261") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+261${digits.slice(1)}`;
  if (digits.length === 9) return `+261${digits}`;

  throw new Error(
    `Numéro invalide "${raw}". Format attendu: 034XXXXXXX ou 0341234567`,
  );
}

export function usePayment(): UsePaymentReturn {
  const [state,    setState]    = useState<PaymentState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pay = async (
    planId:    string,
    provider:  PaymentProvider,
    phone:     string,
    payerName: string,
  ) => {
    setState("loading");
    setErrorMsg(null);

    try {
      const e164 = toMalagasyE164(phone);

      const result = await billingService.initiatePayment(planId, provider, e164, payerName);

      setState("redirecting");

      // Ouvrir la page Papi dans le même onglet
      window.location.href = result.paymentLink;
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur de paiement");
    }
  };

  const reset = () => {
    setState("idle");
    setErrorMsg(null);
  };

  return { state, errorMsg, pay, reset };
}
