/**
 * @file features/billing/components/payment-logos.tsx
 */

export function MVolaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#E30613" />
      <text
        x="50%" y="56%"
        dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="13" fontWeight="bold" fontFamily="system-ui"
      >
        M
      </text>
    </svg>
  );
}

export function OrangeMoneyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#FF6600" />
      <circle cx="20" cy="20" r="10" fill="white" fillOpacity="0.25" />
      <text
        x="50%" y="56%"
        dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui"
      >
        OM
      </text>
    </svg>
  );
}

export function AirtelMoneyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#E2001A" />
      <text
        x="50%" y="56%"
        dominantBaseline="middle" textAnchor="middle"
        fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui"
      >
        AM
      </text>
    </svg>
  );
}

export function ProviderLogo({
  provider,
  size = 20,
}: {
  provider: string;
  size?: number;
}) {
  if (provider === "MVOLA") return <MVolaLogo size={size} />;
  if (provider === "AIRTEL_MONEY") return <AirtelMoneyLogo size={size} />;
  return <OrangeMoneyLogo size={size} />;
}
