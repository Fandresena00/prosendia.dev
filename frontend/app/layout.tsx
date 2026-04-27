import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "../styles/globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#2563EB",
    },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://vendeo.ai"),
  title: {
    default: "VendeoAI — Automatisez vos ventes Facebook avec l'IA",
    template: "%s | VendeoAI",
  },
  description:
    "VendeoAI répond automatiquement à vos messages et commentaires Facebook 24h/24. Augmentez vos ventes, gérez plusieurs pages et convertissez plus de clients sans effort.",
  applicationName: "VendeoAI",
  keywords: [
    "VendeoAI",
    "IA Facebook",
    "automatisation Facebook",
    "chatbot Messenger",
    "réponses automatiques Facebook",
    "ventes Facebook IA",
    "gestion commentaires Facebook",
    "assistant commercial IA",
    "e-commerce Madagascar",
    "Facebook automation Madagascar",
    "bot Facebook vente",
    "IA vente en ligne",
  ],
  authors: [{ name: "VendeoAI", url: "https://vendeo.ai" }],
  creator: "VendeoAI",
  publisher: "VendeoAI",
  category: "technology",
  alternates: {
    canonical: "https://vendeo.ai",
    languages: {
      "fr-FR": "https://vendeo.ai",
      "en-US": "https://vendeo.ai/en",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: "https://vendeo.ai",
    siteName: "VendeoAI",
    title: "VendeoAI — Vos ventes Facebook sur pilote automatique",
    description:
      "Ne manquez plus aucun client. VendeoAI répond instantanément à vos messages et commentaires Facebook — 24h/24, 7j/7. Vendez plus, travaillez moins.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VendeoAI — Assistant IA pour les ventes Facebook",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@vendeoai",
    creator: "@vendeoai",
    title: "VendeoAI — IA pour vos ventes Facebook",
    description:
      "Automatisez vos réponses Facebook et boostez vos ventes avec l'IA. Essai gratuit, sans carte bancaire.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/logo/vendeoai_logo_iconic_dark.svg",
        type: "image/svg+xml",
      },
      {
        url: "/logo/vendeoai_logo_iconic_dark.png",
        type: "image/png",
        sizes: "1024x1024",
      },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/logo/vendeoai_logo_iconic_dark.png",
    apple: [
      {
        url: "/logo/vendeoai_logo_iconic_dark.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  verification: { google: "your-google-site-verification-code" },
  other: {
    "msapplication-TileColor": "#020617",
    "msapplication-TileImage": "/logo/vendeoai_logo_iconic_dark.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Adaptive SVG favicon — light/dark media query */}
        <link
          rel="icon"
          href="/logo/vendeoai_logo_iconic_light.svg"
          media="(prefers-color-scheme: light)"
          type="image/svg+xml"
        />
        <link
          rel="icon"
          href="/logo/vendeoai_logo_iconic_dark.svg"
          media="(prefers-color-scheme: dark)"
          type="image/svg+xml"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Toaster closeButton={false} position="top-center" theme="system" />
          <SpeedInsights />
          <Analytics />
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
