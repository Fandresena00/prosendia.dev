"use client";

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const LAST_UPDATED = "1 avril 2026";
const VERSION = "1.0";

const SECTIONS = [
  {
    num: "01",
    title: "Acceptation des conditions",
    content: `En accédant à prosendia ou en créant un compte, vous acceptez sans réserve les présentes Conditions d'utilisation ainsi que notre Politique de confidentialité. Si vous n'acceptez pas ces conditions, veuillez cesser d'utiliser le service immédiatement.

Ces conditions constituent un accord juridiquement contraignant entre vous et prosendia. Nous nous réservons le droit de les modifier à tout moment ; les modifications entrent en vigueur dès leur publication. Votre usage continu du service après toute modification vaut acceptation des nouvelles conditions.`,
  },
  {
    num: "02",
    title: "Description du service",
    content: `prosendia est une plateforme SaaS d'automatisation commerciale propulsée par l'intelligence artificielle, conçue pour les vendeurs utilisant Facebook. Elle permet de :

• Automatiser les réponses aux messages et commentaires Facebook
• Gérer plusieurs pages Facebook depuis une interface centralisée
• Analyser les performances et données d'engagement en temps réel
• Configurer des règles, templates et scénarios de réponse personnalisés
• Connecter un catalogue produits pour enrichir les interactions IA

prosendia est fourni « en l'état ». Nous ne garantissons pas l'absence d'interruptions ni d'erreurs.`,
  },
  {
    num: "03",
    title: "Création de compte",
    content: `Pour accéder à prosendia, vous devez créer un compte en fournissant des informations exactes, complètes et à jour. Vous vous engagez à :

• Maintenir la confidentialité de vos identifiants
• Assumer l'entière responsabilité de toute activité effectuée depuis votre compte
• Notifier immédiatement prosendia de tout accès non autorisé

Vous devez être âgé d'au moins 18 ans. Nous nous réservons le droit de suspendre ou de supprimer tout compte fournissant de fausses informations ou violant ces conditions.`,
  },
  {
    num: "04",
    title: "Utilisation acceptable",
    content: `Vous acceptez d'utiliser prosendia uniquement à des fins légales. Les comportements suivants sont expressément interdits :

• Envoi de communications non sollicitées (spam)
• Violation des conditions d'utilisation de Facebook / Meta
• Usurpation d'identité ou représentation trompeuse
• Tentative de décompilation, rétro-ingénierie ou exploitation du service
• Collecte de données sans consentement explicite des utilisateurs
• Diffusion de contenus illicites, haineux ou discriminatoires

Toute violation entraîne la résiliation immédiate du compte et peut donner lieu à des poursuites judiciaires.`,
  },
  {
    num: "05",
    title: "Intégration Facebook & Meta",
    content: `prosendia s'appuie sur l'API officielle de Meta Platforms, Inc. En utilisant notre service, vous reconnaissez que :

• Votre utilisation est également soumise aux Conditions et à la Politique de données de Meta
• prosendia agit en qualité de sous-traitant pour les données Facebook transmises
• Nous ne sommes pas affiliés à Meta Platforms, Inc.
• L'accès à l'API peut être modifié ou révoqué par Meta à tout moment

Vous êtes seul responsable du respect des politiques de Meta relatives à l'usage automatisé de leurs plateformes.`,
  },
  {
    num: "06",
    title: "Propriété intellectuelle",
    content: `L'ensemble des composants de prosendia — logiciel, interface, algorithmes IA, marques et logos — sont la propriété exclusive de prosendia ou de ses concédants de licence. Les présentes conditions ne vous confèrent aucun droit de propriété intellectuelle sur le service.

Vous conservez la propriété de vos données, contenus et catalogues. En utilisant le service, vous nous accordez une licence limitée, non exclusive et révocable pour les traiter dans le seul but de fournir le service.`,
  },
  {
    num: "07",
    title: "Tarification et paiements",
    content: `prosendia propose différents plans tarifaires accessibles depuis notre page de facturation. Les paiements sont traités via MVola ou Orange Money. En souscrivant à un plan payant :

• Les paiements sont manuels — aucun renouvellement automatique
• Aucun remboursement n'est accordé pour les périodes partiellement utilisées
• Les tarifs peuvent évoluer avec un préavis de 30 jours
• En cas de défaut de paiement, l'accès au service peut être suspendu

Le plan gratuit est soumis aux limitations décrites sur notre site.`,
  },
  {
    num: "08",
    title: "Limitation de responsabilité",
    content: `Dans les limites autorisées par la loi applicable, prosendia ne pourra être tenu responsable de dommages indirects, accessoires, spéciaux ou consécutifs, incluant la perte de profits, de données ou d'opportunités commerciales.

Notre responsabilité totale envers vous ne pourra excéder le montant payé pour le service au cours des trois (3) derniers mois.

Nous ne garantissons pas l'exactitude des réponses générées par l'IA. Vous êtes responsable de leur supervision avant toute communication à vos clients.`,
  },
  {
    num: "09",
    title: "Résiliation",
    content: `Vous pouvez résilier votre compte à tout moment depuis les paramètres de votre profil. prosendia se réserve le droit de suspendre ou de résilier votre accès sans préavis en cas de :

• Violation des présentes conditions
• Non-paiement des sommes dues
• Comportement frauduleux ou abusif
• Injonction d'une autorité légale compétente

Suite à la résiliation, vos données seront supprimées dans un délai de 30 jours, sauf obligation légale de conservation.`,
  },
  {
    num: "10",
    title: "Droit applicable & litiges",
    content: `Les présentes conditions sont régies par le droit du pays d'enregistrement de prosendia. Tout litige sera soumis à la juridiction exclusive des tribunaux compétents.

Avant toute procédure judiciaire, les parties s'engagent à tenter une résolution amiable par médiation. Pour toute réclamation : legal@prosendia.ai`,
  },
  {
    num: "11",
    title: "Contact",
    content: `Pour toute question relative aux présentes Conditions d'utilisation :

legal@prosendia.ai — Questions juridiques et contractuelles
support@prosendia.ai — Support général
https://prosendia.ai — Site officiel`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-6 lg:px-16 py-4 flex items-center justify-between max-w-none">
          <Link href="/" className="flex items-center gap-2">
            <ProsendiaLogo size={7} />
            <span className="text-sm font-bold">prosendia</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Confidentialité
            </Link>
            <Button size="sm" variant="outline" asChild className="h-8 text-sm">
              <Link href="/sign-up">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-16 xl:px-24 py-16 max-w-none">
        {/* Hero */}
        <div className="mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 mb-6">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Conditions d&apos;utilisation
            </span>
            <span className="text-xs text-muted-foreground">v{VERSION}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Règles d&apos;utilisation
            <br />
            de prosendia
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
          <div className="mt-6 rounded-xl border border-border/50 bg-card/60 px-5 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              En créant un compte ou en utilisant prosendia, vous acceptez les
              présentes conditions. Lisez-les attentivement avant d&apos;accéder
              au service.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="grid gap-0">
          {SECTIONS.map((section, i) => (
            <div
              key={i}
              className="group grid md:grid-cols-[180px_1fr] gap-6 md:gap-16 py-10 border-t border-border/40 first:border-t-0"
            >
              <div className="shrink-0">
                <span className="text-5xl font-bold text-border/40 tabular-nums leading-none select-none">
                  {section.num}
                </span>
              </div>
              <div className="space-y-3 pb-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {section.title}
                </h2>
                <div className="text-sm text-muted-foreground leading-[1.8] whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 border-t border-border/40 pt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold">
              Des questions sur ces conditions ?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contactez-nous à legal@prosendia.ai
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/privacy">Politique de confidentialité</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Créer un compte →</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
