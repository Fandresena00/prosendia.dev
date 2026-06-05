/**
 * @file features/billing/components/payment-dialog.tsx
 *
 * Dialog de paiement connecté à Papi.
 * Flow: choix provider → saisie numéro → clic Payer → redirect Papi
 */

"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { usePayment } from "../hooks/use-payment";
import type { PaymentProvider, Plan } from "../types/billing.types";
import { PROVIDER_META } from "../types/billing.types";
import { ProviderLogo } from "./payment-logos";

const PROVIDERS: PaymentProvider[] = ["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY"];

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  payerName?: string; // Nom de l'utilisateur pré-rempli
}

export function PaymentDialog({
  open,
  onClose,
  plan,
  payerName = "",
}: PaymentDialogProps) {
  const [provider, setProvider] = useState<PaymentProvider>("MVOLA");
  const [selectedPrefix, setSelectedPrefix] = useState(
    PROVIDER_META["MVOLA"].prefixes[0],
  );
  const [phoneLocal, setPhoneLocal] = useState("");
  const [nameInput, setNameInput] = useState(payerName);
  const { state, errorMsg, pay, reset } = usePayment();

  const meta = PROVIDER_META[provider];
  const isLoading = state === "loading" || state === "redirecting";
  const isRedirecting = state === "redirecting";

  const handleClose = () => {
    if (isLoading) return;
    reset();
    setPhoneLocal("");
    setSelectedPrefix(PROVIDER_META[provider].prefixes[0]);
    onClose();
  };

  const handlePay = async () => {
    if (!plan || !phoneLocal.trim() || !nameInput.trim()) return;
    const fullPhone = `${selectedPrefix}${phoneLocal.replace(/\D/g, "")}`;
    await pay(plan.id, provider, fullPhone, nameInput.trim());
  };

  const isValid =
    phoneLocal.replace(/\D/g, "").length >= 7 && nameInput.trim().length > 0;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isRedirecting
              ? "Redirection vers le paiement…"
              : `Souscrire au plan ${plan?.name}`}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {isRedirecting ? (
          /* État redirection */
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold">
                Ouverture de la page de paiement
              </p>
              <p className="text-xs text-muted-foreground">
                Vous allez être redirigé vers Papi pour finaliser le paiement.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              Paiement sécurisé via app.papi.mg
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Provider selection */}
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const m = PROVIDER_META[p];
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setProvider(p);
                      setSelectedPrefix(m.prefixes[0]);
                    }}
                    className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-all ${
                      provider === p
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <ProviderLogo provider={p} size={28} />
                    <div className="text-center">
                      <p className="text-xs font-semibold leading-tight">
                        {m.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {m.prefixes.join(" & ")}
                      </p>
                    </div>
                    {provider === p && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            <Separator />

            {/* Nom */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom complet</Label>
              <Input
                placeholder="Votre nom"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Numéro */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Numéro {meta.label}</Label>
              <div className="flex items-center gap-2">
                {meta.prefixes.length > 1 ? (
                  <select
                    value={selectedPrefix}
                    onChange={(e) => setSelectedPrefix(e.target.value)}
                    className="flex items-center justify-center h-10 w-16 rounded-md border border-border/50 bg-secondary/50 text-sm font-semibold text-muted-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary/40 px-1 cursor-pointer"
                  >
                    {meta.prefixes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex items-center justify-center h-10 w-14 rounded-md border border-border/50 bg-secondary/50 text-sm font-semibold text-muted-foreground shrink-0">
                    {selectedPrefix}
                  </span>
                )}
                <Input
                  placeholder="XX XXX XX"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  className="h-10 text-sm flex-1"
                  maxLength={9}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {meta.operator} · Format: {selectedPrefix}XX XXX XX
              </p>
            </div>

            {/* Récapitulatif */}
            <div className="rounded-md border border-border/40 bg-secondary/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{plan?.name}</span>
              </div>
              {plan?.credits && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Crédits IA</span>
                  <span className="font-medium text-primary">
                    {plan.credits.toLocaleString("fr-FR")} crédits
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Durée</span>
                <span>30 jours</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {plan?.priceAriary?.toLocaleString("fr-MG")} Ar
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                ⚠️ Sans recharge automatique — renouvellement manuel chaque
                mois. Vous serez redirigé vers Papi pour le paiement.
              </p>
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <AlertDialogCancel
                className="flex-1 h-9 text-sm"
                onClick={handleClose}
              >
                Annuler
              </AlertDialogCancel>
              <Button
                className="flex-1 h-9 text-sm gap-2"
                disabled={!isValid || isLoading}
                onClick={handlePay}
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Traitement…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Payer {plan?.priceAriary?.toLocaleString("fr-MG")} Ar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
