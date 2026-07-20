"use client";

import { ProsendiaLogo } from "@/components/shared/prosendia-logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";

const LAST_UPDATED = "20 juillet 2026";
const VERSION = "2.0";

const SECTIONS = [
  {
    num: "01",
    title: "Introduction",
    content: `Genforus, éditeur de prosendia, s'engage à protéger la vie privée de ses utilisateurs. Cette Politique de confidentialité explique de façon transparente comment nous collectons, utilisons, stockons et protégeons vos données personnelles lorsque vous utilisez notre plateforme.

En utilisant prosendia, vous consentez aux traitements décrits ci-dessous. Si vous n'acceptez pas cette politique, veuillez cesser d'utiliser le Service.`,
  },
  {
    num: "02",
    title: "Données collectées",
    content: `Nous collectons les catégories de données suivantes :

Données de compte
• Nom, email, mot de passe (haché — jamais stocké en clair)
• Informations de profil (nom de l'entreprise, photo)
• Numéro de téléphone mobile utilisé pour les paiements MVola / Orange Money — aucune donnée de carte bancaire n'est collectée

Données Facebook connectées
• Informations des Pages et comptes que vous autorisez via l'authentification Meta
• Messages privés et commentaires de vos clients, uniquement pour les Pages que vous connectez
• Statistiques d'engagement (portée, interactions) mises à disposition par l'API Meta

Données d'utilisation
• Journaux d'activité sur la plateforme
• Paramètres de configuration (règles IA, templates, catalogue produits)
• Données analytiques agrégées sur la performance de vos automatisations

Données techniques
• Adresse IP, type de navigateur, système d'exploitation
• Cookies de session et préférences d'interface
• Journaux d'erreurs et de diagnostic`,
  },
  {
    num: "03",
    title: "Pourquoi nous collectons ces données",
    content: `Vos données nous permettent de :

• fournir, maintenir et améliorer le Service prosendia ;
• générer les réponses de l'IA sur la base du contexte de vos conversations et de votre catalogue produits ;
• traiter vos paiements via les opérateurs de paiement mobile partenaires ;
• améliorer nos modèles et règles internes, uniquement à partir de données agrégées ou anonymisées ;
• vous envoyer des notifications importantes relatives à votre Compte ou au Service ;
• détecter et prévenir les activités frauduleuses ou abusives ;
• respecter nos obligations légales et réglementaires ;
• assurer un support client de qualité.

Nous ne vendons, ne louons et ne cédons jamais vos données à des tiers à des fins publicitaires.`,
  },
  {
    num: "04",
    title: "Base légale des traitements",
    content: `Conformément aux réglementations applicables, nos traitements reposent sur :

• l'exécution du contrat — traitement nécessaire à la fourniture du Service que vous avez souscrit ;
• votre consentement — notamment pour la connexion de vos Pages Facebook et, le cas échéant, les communications marketing ;
• nos intérêts légitimes — amélioration du Service, sécurité, prévention des fraudes ;
• nos obligations légales — conservation de certaines données requise par la loi (facturation notamment).

Vous pouvez retirer votre consentement à tout moment depuis les paramètres de votre Compte, sans affecter la légalité des traitements antérieurs à ce retrait.`,
  },
  {
    num: "05",
    title: "Partage des données",
    content: `Vos données personnelles ne sont jamais vendues. Nous les partageons uniquement dans les cas suivants, et toujours dans la limite de ce qui est strictement nécessaire :

Meta Platforms, Inc.
Dans le cadre de l'intégration officielle Facebook / Messenger, certaines données transitent nécessairement par l'API Meta pour permettre l'envoi et la réception de messages.

Prestataires d'intelligence artificielle
Le contenu des conversations peut être transmis à nos fournisseurs de modèles d'IA dans le seul but de générer une réponse ; voir l'article 10 pour le détail de ce traitement.

Hébergement et infrastructure
Nos prestataires d'hébergement, de base de données et de déploiement, liés par des accords de confidentialité, n'accèdent qu'aux données strictement nécessaires au fonctionnement technique du Service.

Prestataires de paiement
Les opérateurs de paiement mobile (MVola, Orange Money) traitent les données nécessaires à la transaction ; prosendia ne stocke aucune donnée bancaire.

Obligations légales
Réponse à des injonctions judiciaires ou demandes d'autorités compétentes.

Opérations d'entreprise
En cas de fusion, acquisition ou cession, vous seriez informé au préalable et vos données resteraient soumises à une politique de confidentialité au moins aussi protectrice.`,
  },
  {
    num: "06",
    title: "Durées de conservation",
    content: `• Compte actif — pendant toute la durée de la relation contractuelle
• Journaux analytiques et techniques — 12 mois glissants
• Transactions et factures — 7 ans, conformément aux obligations comptables applicables
• Messages et conversations — 6 mois après leur réception, sauf configuration différente de votre part
• Sauvegardes chiffrées — conservées selon un calendrier de rotation interne, puis supprimées automatiquement

Après suppression de votre Compte, vos données personnelles sont effacées dans un délai de 30 jours, sauf obligation légale de conservation plus longue (article 8 du Code Général des Impôts, notamment).`,
  },
  {
    num: "07",
    title: "Sécurité",
    content: `Nous appliquons des mesures de sécurité rigoureuses pour protéger vos données :

• chiffrement en transit (HTTPS / TLS) et au repos (AES-256) pour les données sensibles, notamment les jetons d'accès Facebook ;
• mots de passe hachés, jamais stockés en clair ;
• contrôle d'accès basé sur les rôles (RBAC) au sein de nos équipes ;
• surveillance continue et journalisation des accès sensibles ;
• sauvegardes chiffrées et procédures de reprise d'activité ;
• sensibilisation régulière de nos équipes à la sécurité des données.

En cas de violation de données susceptible d'affecter significativement vos droits, nous vous en informerons dans les meilleurs délais.`,
  },
  {
    num: "08",
    title: "Vos droits",
    content: `Conformément à la loi malgache n°2014-038 relative à la protection des données à caractère personnel et, le cas échéant, aux réglementations applicables dans votre pays, vous disposez des droits suivants sur vos données :

• Accès — obtenir une copie des données que nous détenons vous concernant
• Rectification — corriger toute information inexacte ou incomplète
• Effacement — demander la suppression de votre Compte et de vos données
• Portabilité — recevoir vos données dans un format structuré et couramment utilisé
• Opposition — vous opposer à certains traitements fondés sur notre intérêt légitime
• Limitation — demander la restriction temporaire d'un traitement

Pour exercer ces droits, contactez-nous à contact@genforus.com. Nous nous engageons à répondre dans un délai de 30 jours.`,
  },
  {
    num: "09",
    title: "Cookies",
    content: `Prosendia utilise des cookies pour améliorer votre expérience :

Essentiels (obligatoires)
• Session et authentification
• Protection contre les attaques CSRF

Fonctionnels
• Mémorisation du thème (clair / sombre) et de la langue
• Maintien de la session de connexion

Analytiques (avec votre consentement)
• Mesure d'audience anonymisée
• Détection d'erreurs et de performance

Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur ; le refus de certains cookies non essentiels peut limiter certaines fonctionnalités du Service.`,
  },
  {
    num: "10",
    title: "Intelligence artificielle et vos données",
    content: `Pour générer une réponse, prosendia transmet à son fournisseur de modèles d'IA le contexte strictement nécessaire à la conversation en cours : historique récent des échanges, catalogue produits et règles que vous avez configurées. Cette transmission est chiffrée et limitée à la génération de la réponse demandée.

Selon le fournisseur de modèle utilisé, ces données ne sont pas conservées au-delà du traitement de la requête ni utilisées pour ré-entraîner des modèles tiers, conformément aux accords que nous avons conclus avec nos partenaires IA. Nous n'utilisons vos conversations pour améliorer nos propres règles internes que sous forme agrégée ou anonymisée.`,
  },
  {
    num: "11",
    title: "Utilisation des API Facebook / Meta",
    content: `Prosendia utilise exclusivement les API officielles de Meta (Graph API, Webhooks, Messenger Platform) pour fournir ses fonctionnalités. Les données issues de vos Pages Facebook (messages, commentaires, informations publiques) sont traitées uniquement dans le but de fournir les fonctionnalités que vous avez explicitement activées, conformément à la Politique de la plateforme Meta.

Vous pouvez révoquer à tout moment l'accès de prosendia à vos Pages depuis les paramètres de votre compte Facebook ou depuis votre tableau de bord prosendia ; la déconnexion entraîne l'arrêt immédiat de la collecte de nouvelles données pour la Page concernée.`,
  },
  {
    num: "12",
    title: "Suppression de vos données",
    content: `Lorsque vous supprimez votre Compte ou déconnectez une Page Facebook :

• l'accès à la Page et les jetons associés sont immédiatement invalidés ;
• les données liées à la Page (conversations, configuration, statistiques) sont supprimées de nos bases actives sous 30 jours ;
• les copies de sauvegarde chiffrées sont purgées selon notre calendrier de rotation, sans dépasser la durée indiquée à l'article 6 ;
• les données que nous sommes légalement tenus de conserver (facturation notamment) sont conservées pour la seule durée requise par la loi, puis supprimées.

Pour toute demande de suppression accélérée ou toute question sur ce processus, contactez contact@genforus.com.`,
  },
  {
    num: "13",
    title: "Transferts internationaux",
    content: `Certains de nos prestataires techniques (hébergement, infrastructure, fournisseurs de modèles d'IA) peuvent traiter des données en dehors de Madagascar. Lorsque c'est le cas, nous nous assurons que ces prestataires offrent des garanties de protection adéquates, par le biais d'accords contractuels appropriés ou de mécanismes reconnus équivalents.`,
  },
  {
    num: "14",
    title: "Mineurs",
    content: `Prosendia est exclusivement destiné aux personnes âgées de 18 ans ou plus, agissant dans un cadre professionnel ou entrepreneurial. Nous ne collectons sciemment aucune donnée concernant des mineurs. Si vous pensez qu'un mineur nous a fourni des informations personnelles, contactez-nous immédiatement à contact@genforus.com afin que nous procédions à leur suppression.`,
  },
  {
    num: "15",
    title: "Modifications de cette politique",
    content: `Cette Politique de confidentialité peut être mise à jour périodiquement pour refléter l'évolution du Service ou de la réglementation applicable. La version la plus récente est toujours accessible sur cette page. Pour toute modification substantielle, vous serez informé par email ou notification dans l'application au moins 30 jours avant son entrée en vigueur.`,
  },
  {
    num: "16",
    title: "Contact",
    content: `Pour toute question relative à cette Politique de confidentialité :

contact@genforus.com — Protection des données et exercice de vos droits
WhatsApp : +261 37 51 127 31
https://prosendia.ai — Site officiel`,
  },
];

export default function PrivacyPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].num);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.num);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-6 py-4 lg:px-16">
          <Link href="/" className="flex items-center gap-2">
            <ProsendiaLogo size={7} />
            <span className="text-sm font-bold">prosendia</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Conditions d&apos;utilisation
            </Link>
            <Button size="sm" variant="outline" asChild className="h-8 text-sm">
              <Link href="/sign-up">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-none px-6 py-16 lg:px-16 xl:px-24">
        {/* Hero */}
        <div className="mb-14 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Politique de confidentialité
            </span>
            <span className="text-xs text-muted-foreground">v{VERSION}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Vos données,
            <br />
            notre responsabilité
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
          <div className="mt-6 rounded-xl border border-border/50 bg-card/60 px-5 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              La protection de vos données personnelles est une priorité pour
              prosendia. Cette politique explique avec transparence comment
              nous traitons vos informations, y compris celles transmises à
              notre IA (article 10) et via l&apos;API Facebook (article 11).
            </p>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          {/* Sticky table of contents — desktop only */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sommaire
              </p>
              {SECTIONS.map((s) => (
                <a
                  key={s.num}
                  href={`#${s.num}`}
                  className={`block rounded-lg px-3 py-1.5 text-[12px] leading-relaxed transition-colors ${
                    activeId === s.num
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.title}
                </a>
              ))}
            </div>
          </aside>

          {/* Sections */}
          <div className="grid gap-0">
            {SECTIONS.map((section) => (
              <div
                key={section.num}
                id={section.num}
                className="grid gap-6 border-t border-border/40 py-10 first:border-t-0 md:grid-cols-[100px_1fr] md:gap-16"
              >
                <div className="shrink-0">
                  <span className="select-none text-5xl font-bold leading-none tabular-nums text-border/40">
                    {section.num}
                  </span>
                </div>
                <div className="space-y-3 pb-2">
                  <h2 className="text-xl font-bold tracking-tight">
                    {section.title}
                  </h2>
                  <div className="whitespace-pre-line text-sm leading-[1.8] text-muted-foreground">
                    {section.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border/40 pt-12 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold">
              Questions sur vos données ?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              contact@genforus.com
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/terms">Conditions d&apos;utilisation</Link>
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
