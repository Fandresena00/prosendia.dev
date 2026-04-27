/**
 * @file features/billing/components/payment-logos.tsx
 * @description visual logos for payment methods in the billing page.
 */

/* MVola logo — Telma red brand */
export function MVolaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#E30613" />
      <text
        x="50%"
        y="56%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        M
      </text>
    </svg>
  );
}

/* Orange Money logo — Orange brand */
export function OrangeMoneyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#FF6600" />
      <circle cx="20" cy="20" r="10" fill="white" fillOpacity="0.25" />
      <text
        x="50%"
        y="56%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        OM
      </text>
    </svg>
  );
}
