/**
 * @file features/billing/components/payment-method.tsx
 * @description payment method options in the billing page.
 */

import { Card, CardContent } from "@/components/ui/card";
import { MVolaLogo, OrangeMoneyLogo } from "./payements-logos";

export default function PayementMethod() {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Modes de paiement acceptés</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            name: "MVola",
            operator: "Telma Madagascar",
            desc: "Numéros 034 · Confirmation USSD",
            Logo: () => <MVolaLogo size={32} />,
          },
          {
            name: "Orange Money",
            operator: "Orange Madagascar",
            desc: "Numéros 032 · Notification app",
            Logo: () => <OrangeMoneyLogo size={32} />,
          },
        ].map((m) => (
          <Card key={m.name} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="shrink-0">
                <m.Logo />
              </div>
              <div>
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.operator}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {m.desc}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
