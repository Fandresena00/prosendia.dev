/**
 * @file features/billing/components/payment-method.tsx
 */

import { Card, CardContent } from "@/components/ui/card";
import { PROVIDER_META } from "../types/billing.types";
import { ProviderLogo } from "./payment-logos";

export default function PaymentMethod() {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Modes de paiement acceptés</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY"] as const).map((p) => {
          const meta = PROVIDER_META[p];
          return (
            <Card key={p} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <ProviderLogo provider={p} size={32} />
                <div>
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.operator} Madagascar</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Numéros {meta.prefix}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
