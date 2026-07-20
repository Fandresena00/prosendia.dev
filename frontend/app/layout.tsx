import { Toaster } from "@/components/ui/sonner";
import { APP_NAME } from "@/lib/utils";
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
  metadataBase: new URL("https://prosendia.genforus.com"),
  title: {
    default: `${APP_NAME} — Automatisez vos ventes Facebook avec l'IA`,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_NAME} répond automatiquement à vos messages et commentaires Facebook 24h/24. Augmentez vos ventes, gérez plusieurs pages et convertissez plus de clients sans effort.`,
  applicationName: APP_NAME,
  keywords: [
    APP_NAME,
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
  authors: [{ name: APP_NAME, url: "https://prosendia.genforus.com" }],
  creator: APP_NAME,
  publisher: APP_NAME,
  category: "technology",
  alternates: {
    canonical: "https://prosendia.genforus.com",
    languages: {
      "fr-FR": "https://prosendia.genforus.com",
      "en-US": "https://prosendia.genforus.com/en",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: "https://prosendia.genforus.com",
    siteName: APP_NAME,
    title: `${APP_NAME} — Vos ventes Facebook sur pilote automatique`,
    description: `Ne manquez plus aucun client. ${APP_NAME} répond instantanément à vos messages et commentaires Facebook — 24h/24, 7j/7. Vendez plus, travaillez moins.`,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Assistant IA pour les ventes Facebook`,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@prosendia",
    creator: "@prosendia",
    title: `${APP_NAME} — IA pour vos ventes Facebook`,
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
  // Single transparent-background mark now covers every context (light,
  // dark, iOS, Android) — no more separate dark/light SVG pair to keep
  // in sync.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/logo/prosendia-favicon-32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/logo/prosendia-logo-1024.png",
        type: "image/png",
        sizes: "1024x1024",
      },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/logo/prosendia-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  verification: { google: "your-google-site-verification-code" },
  other: {
    "msapplication-TileColor": "#020617",
    "msapplication-TileImage": "/logo/prosendia-logo-1024.png",
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
