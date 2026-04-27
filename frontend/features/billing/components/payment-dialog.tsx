/**
 * @file features/billing/components/payment-dialog.tsx
 * @description payment dialog in the billing page.
 */

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
import { CheckCircle, Zap } from "lucide-react";
import { useState } from "react";
import { PLANS } from "../data/mok";
import { PayMethod } from "../types/billing.types";
import { MVolaLogo, OrangeMoneyLogo } from "./payements-logos";

export function PaymentDialog({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan: (typeof PLANS)[0] | null;
}) {
  const [method, setMethod] = useState<PayMethod>("mvola");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const prefix = method === "mvola" ? "034" : "032";

  const handlePay = () => {
    if (!phone) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 2000);
  };

  const handleClose = () => {
    setSuccess(false);
    setPhone("");
    setLoading(false);
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {success ? "Paiement initié !" : `Souscrire au plan ${plan?.name}`}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {success ? (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">
                  Vérifiez votre téléphone
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Un message de confirmation a été envoyé au{" "}
                  <span className="font-semibold">
                    {prefix}
                    {phone}
                  </span>
                  . Confirmez pour activer votre plan.
                </p>
              </div>
            </div>
            <Button className="w-full h-9 text-sm" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Method selection */}
            <div className="grid grid-cols-2 gap-3">
              {(["mvola", "orange"] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex flex-col items-center gap-2.5 rounded-md border p-3.5 transition-all ${method === m ? "border-primary/40 bg-primary/5" : "border-border/50 hover:border-border"}`}
                >
                  <div className="flex items-center justify-center">
                    {m === "mvola" ? (
                      <MVolaLogo size={36} />
                    ) : (
                      <OrangeMoneyLogo size={36} />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">
                      {m === "mvola" ? "MVola" : "Orange Money"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m === "mvola" ? "Telma · 034" : "Orange · 032"}
                    </p>
                  </div>
                  {method === m && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>

            <Separator />

            {/* Phone number only — no name field */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Numéro {method === "mvola" ? "MVola" : "Orange Money"}
              </Label>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-10 w-12 rounded-md border border-border/50 bg-secondary/50 text-sm font-semibold text-muted-foreground shrink-0">
                  {prefix}
                </span>
                <Input
                  placeholder="XX XXX XX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 text-sm flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {method === "mvola"
                  ? "Un code USSD sera envoyé sur votre téléphone Telma."
                  : "Une notification Orange Money sera envoyée."}
              </p>
            </div>

            {/* Recap */}
            <div className="rounded-md border border-border/40 bg-secondary/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan {plan?.name}</span>
                <span className="font-semibold">{plan?.price}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Durée</span>
                <span>1 mois</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-primary">{plan?.price}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Sans recharge automatique — renouvellement manuel chaque
                mois.
              </p>
            </div>

            <div className="flex gap-3">
              <AlertDialogCancel className="flex-1 h-9 text-sm">
                Annuler
              </AlertDialogCancel>
              <Button
                className="flex-1 h-9 text-sm gap-2"
                disabled={!phone || loading}
                onClick={handlePay}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
                    Traitement…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Payer {plan?.price}
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
