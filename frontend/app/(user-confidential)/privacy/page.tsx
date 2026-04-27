"use client";

import { VendeoLogo } from "@/components/shared/vendeo-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const LAST_UPDATED = "1 avril 2026";
const VERSION = "1.0";

const SECTIONS = [
  {
    num: "01",
    title: "Introduction",
    content: `VendeoAI s'engage fermement Ã  protÃ©ger la vie privÃ©e de ses utilisateurs. Cette Politique explique de faÃ§on transparente comment nous collectons, utilisons, stockons et protÃ©geons vos donnÃ©es personnelles lorsque vous utilisez notre plateforme.

En utilisant VendeoAI, vous consentez aux traitements dÃ©crits ci-dessous. Si vous n'acceptez pas cette politique, veuillez cesser d'utiliser le service.`,
  },
  {
    num: "02",
    title: "DonnÃ©es collectÃ©es",
    content: `Nous collectons les catÃ©gories de donnÃ©es suivantes :

DonnÃ©es de compte
â¢ Nom d'utilisateur, email, mot de passe hachÃ© (bcrypt)
â¢ Informations de profil (nom de l'entreprise, photo)
â¢ NumÃ©ros de tÃ©lÃ©phone mobile pour MVola/Orange Money â aucune donnÃ©e de carte bancaire

DonnÃ©es Facebook connectÃ©es
â¢ Informations des pages et comptes que vous autorisez
â¢ Messages et commentaires clients (avec leur consentement via Facebook)
â¢ Statistiques d'engagement (likes, portÃ©e, interactions)

DonnÃ©es d'utilisation
â¢ Journaux d'activitÃ© sur la plateforme
â¢ ParamÃ¨tres de configuration (rÃ¨gles, templates, produits)
â¢ DonnÃ©es analytiques agrÃ©gÃ©es

DonnÃ©es techniques
â¢ Adresse IP, type de navigateur, systÃ¨me d'exploitation
â¢ Cookies de session et prÃ©fÃ©rences d'interface
â¢ Journaux d'erreurs et de diagnostic`,
  },
  {
    num: "03",
    title: "Utilisation des donnÃ©es",
    content: `Vos donnÃ©es nous permettent de :

â¢ Fournir, maintenir et amÃ©liorer le service VendeoAI
â¢ Traiter vos paiements via les opÃ©rateurs mobiles partenaires
â¢ AmÃ©liorer nos modÃ¨les d'IA (uniquement avec des donnÃ©es anonymisÃ©es)
â¢ Vous envoyer des notifications importantes et mises Ã  jour du service
â¢ DÃ©tecter et prÃ©venir les activitÃ©s frauduleuses
â¢ Respecter nos obligations lÃ©gales et rÃ©glementaires
â¢ Assurer un support client de qualitÃ©

Nous ne vendons, ne louons et ne cÃ©dons jamais vos donnÃ©es Ã  des tiers Ã  des fins publicitaires.`,
  },
  {
    num: "04",
    title: "Base lÃ©gale",
    content: `ConformÃ©ment aux rÃ©glementations applicables, nos traitements reposent sur :

â¢ ExÃ©cution du contrat â traitement nÃ©cessaire Ã  la fourniture du service
â¢ Consentement â pour les donnÃ©es Facebook et les communications marketing
â¢ IntÃ©rÃªts lÃ©gitimes â amÃ©lioration du service, sÃ©curitÃ©, prÃ©vention des fraudes
â¢ Obligations lÃ©gales â conservation requise par la loi

Vous pouvez retirer votre consentement Ã  tout moment depuis les paramÃ¨tres de votre compte, sans affecter la lÃ©galitÃ© des traitements antÃ©rieurs.`,
  },
  {
    num: "05",
    title: "Partage des donnÃ©es",
    content: `Vos donnÃ©es ne sont jamais vendues. Nous les partageons uniquement dans ces cas :

Prestataires techniques
H©bergeurs, processeurs de paiements et outils d'analyse. Ils n'accÃ¨dent qu'aux donnÃ©es strictement nÃ©cessaires et sont liÃ©s par des accords de confidentialitÃ©.

OpÃ©rations d'entreprise
En cas de fusion, acquisition ou cession, vous serez informÃ© au prÃ©alable.

Obligations lÃ©gales
RÃ©ponse Ã  des injonctions judiciaires ou demandes d'autoritÃ©s compÃ©tentes.`,
  },
  {
    num: "06",
    title: "SÃ©curitÃ©",
    content: `Nous appliquons des mesures de sÃ©curitÃ© rigoureuses :

â¢ Chiffrement en transit (HTTPS/TLS 1.3) et au repos (AES-256)
â¢ Mots de passe hachÃ©s avec bcrypt
â¢ ContrÃ´le d'accÃ¨s basÃ© sur les rÃ´les (RBAC)
â¢ Surveillance continue et dÃ©tection d'intrusion
â¢ Sauvegardes chiffrÃ©es et procÃ©dures de reprise d'activitÃ©
â¢ Formation rÃ©guliÃ¨re des Ã©quipes Ã  la sÃ©curitÃ© des donnÃ©es

En cas de violation susceptible d'affecter vos droits, nous vous notifierons sous 72 heures.`,
  },
  {
    num: "07",
    title: "Conservation",
    content: `DurÃ©es de conservation de vos donnÃ©es :

â¢ Compte actif â durÃ©e de la relation contractuelle
â¢ Journaux analytiques â 12 mois glissants
â¢ Transactions et paiements â 7 ans (obligation lÃ©gale)
â¢ Messages et conversations â 6 mois aprÃ¨s rÃ©ception

AprÃ¨s suppression du compte, vos donnÃ©es personnelles sont effacÃ©es sous 30 jours, sauf donnÃ©es lÃ©galement conservÃ©es.`,
  },
  {
    num: "08",
    title: "Vos droits",
    content: `Vous disposez des droits suivants sur vos donnÃ©es :

â¢ AccÃ¨s â obtenir une copie de vos donnÃ©es
â¢ Rectification â corriger des informations inexactes
â¢ Effacement â demander la suppression
â¢ PortabilitÃ© â recevoir vos donnÃ©es dans un format structurÃ©
â¢ Opposition â vous opposer Ã  certains traitements
â¢ Limitation â restreindre le traitement

Pour exercer ces droits : privacy@vendeo.ai. RÃ©ponse garantie sous 30 jours. Vous pouvez Ã©galement saisir l'autoritÃ© de protection des donnÃ©es compÃ©tente.`,
  },
  {
    num: "09",
    title: "Cookies",
    content: `VendeoAI utilise des cookies pour amÃ©liorer votre expÃ©rience :

Essentiels (obligatoires)
â¢ Session et authentification
â¢ Protection CSRF et sÃ©curitÃ©

Fonctionnels
â¢ MÃ©morisation du thÃ¨me et de la langue
â¢ Maintien de la session de connexion

Analytiques (avec consentement)
â¢ Mesure d'audience anonymisÃ©e
â¢ Performances et dÃ©tection d'erreurs

GÃ©rez vos prÃ©fÃ©rences dans les paramÃ¨tres de votre navigateur. Le refus de certains cookies peut affecter des fonctionnalitÃ©s.`,
  },
  {
    num: "10",
    title: "Transferts internationaux",
    content: `VendeoAI peut traiter vos donnÃ©es dans des pays diffÃ©rents du vÃ´tre. Pour tout transfert international, nous garantissons des protections adÃ©quates via des clauses contractuelles types approuvÃ©es ou des mÃ©canismes Ã©quivalents reconnus par les autoritÃ©s compÃ©tentes.`,
  },
  {
    num: "11",
    title: "Mineurs",
    content: `VendeoAI est exclusivement destinÃ© aux personnes Ã¢gÃ©es de 18 ans ou plus. Nous ne collectons sciemment aucune donnÃ©e concernant des mineurs. Si vous pensez qu'un enfant nous a fourni des informations, contactez-nous immÃ©diatement Ã  privacy@vendeo.ai pour suppression.`,
  },
  {
    num: "12",
    title: "Modifications",
    content: `Cette politique peut Ãªtre mise Ã  jour pÃ©riodiquement. La version la plus rÃ©cente est toujours accessible sur notre site. Pour toute modification substantielle, vous serez informÃ© par email ou notification dans l'application au moins 30 jours avant l'entrÃ©e en vigueur.`,
  },
  {
    num: "13",
    title: "Contact",
    content: `Pour toute question relative Ã  cette Politique de confidentialitÃ© :

privacy@vendeo.ai â Protection des donnÃ©es & exercice des droits
support@vendeo.ai â Support gÃ©nÃ©ral
https://vendeo.ai â Site officiel`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-6 lg:px-16 py-4 flex items-center justify-between max-w-none">
          <Link href="/" className="flex items-center gap-2">
            <VendeoLogo size={7} />
            <span className="text-sm font-bold">VendeoAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Conditions d&apos;utilisation
            </Link>
            <Button size="sm" variant="outline" asChild className="h-8 text-sm">
              <Link href="/sign-up">CrÃ©er un compte</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-16 xl:px-24 py-16 max-w-none">
        {/* Hero */}
        <div className="mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 mb-6">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Politique de confidentialitÃ©
            </span>
            <span className="text-xs text-muted-foreground">v{VERSION}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Vos donnÃ©es,
            <br />
            notre responsabilitÃ©
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            DerniÃ¨re mise Ã  jour : {LAST_UPDATED}
          </p>
          <div className="mt-6 rounded-xl border border-border/50 bg-card/60 px-5 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              La protection de vos donnÃ©es personnelles est une prioritÃ©
              absolue pour VendeoAI. Cette politique explique avec transparence
              comment nous traitons vos informations.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="grid gap-0">
          {SECTIONS.map((section, i) => (
            <div
              key={i}
              className="grid md:grid-cols-[180px_1fr] gap-6 md:gap-16 py-10 border-t border-border/40 first:border-t-0"
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
              Questions sur vos donnÃ©es ?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              privacy@vendeo.ai
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/terms">Conditions d&apos;utilisation</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">CrÃ©er un compte â</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
