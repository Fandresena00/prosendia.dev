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
    title: "Introduction et acceptation",
    content: `Prosendia est édité par Genforus. Les présentes Conditions Générales d'Utilisation (« Conditions ») régissent l'accès et l'utilisation de la plateforme prosendia — site, tableau de bord, API et toute fonctionnalité associée (le « Service »).

En créant un compte ou en utilisant le Service de quelque manière que ce soit, vous acceptez sans réserve les présentes Conditions ainsi que notre Politique de confidentialité. Si vous n'acceptez pas ces Conditions, vous devez cesser immédiatement d'utiliser le Service.

Ces Conditions constituent un accord juridiquement contraignant entre vous (« l'Utilisateur ») et Genforus. Nous pouvons les modifier à tout moment ; les modifications substantielles vous seront notifiées par email ou notification dans l'application au moins 30 jours avant leur entrée en vigueur. Votre usage continu du Service après cette date vaut acceptation des nouvelles Conditions.`,
  },
  {
    num: "02",
    title: "Définitions",
    content: `Pour faciliter la lecture des présentes Conditions :

• « Utilisateur » ou « vous » désigne toute personne physique ou entreprise créant un compte sur prosendia.
• « Compte » désigne l'espace personnel associé à un Utilisateur, incluant ses pages connectées, sa configuration et ses données.
• « IA » désigne les modèles d'intelligence artificielle utilisés par prosendia pour analyser les conversations et générer des réponses.
• « Crédit » désigne l'unité de consommation associée à chaque appel à l'IA, décomptée selon le plan souscrit.
• « Abonnement » ou « Plan » désigne l'offre tarifaire choisie par l'Utilisateur (Gratuit, Pro, ou toute offre sur mesure).
• « Service » désigne l'ensemble de la plateforme prosendia telle que décrite à l'article 3.
• « Page(s) connectée(s) » désigne toute Page Facebook (et, ultérieurement, tout compte Messenger, Instagram ou WhatsApp Business) reliée à un Compte via les API officielles de Meta.`,
  },
  {
    num: "03",
    title: "Description du service",
    content: `Prosendia est une plateforme SaaS alimentée par l'intelligence artificielle qui permet aux entreprises de centraliser, automatiser et optimiser la gestion de leurs conversations sur les réseaux sociaux — en priorité Facebook et Messenger, avec Instagram et WhatsApp prévus dans une prochaine phase.

Concrètement, le Service permet notamment de :

• connecter une ou plusieurs Pages Facebook via une authentification OAuth officielle Meta ;
• recevoir et centraliser les messages privés et commentaires dans une boîte de réception unique ;
• générer des réponses automatiques ou semi-automatiques grâce à l'IA, sur la base du catalogue produits, des règles et du ton définis par l'Utilisateur ;
• reprendre la main manuellement sur toute conversation à tout moment (mode humain) ;
• consulter des statistiques d'utilisation, de performance et de conversion ;
• gérer les abonnements, crédits IA et moyens de paiement locaux.

Le Service est fourni « en l'état » et « selon disponibilité ». Nous mettons en œuvre des moyens raisonnables pour assurer sa continuité, sans toutefois garantir une disponibilité ininterrompue, notamment en raison de notre dépendance aux API tierces de Meta (voir article 5).`,
  },
  {
    num: "04",
    title: "Création et sécurité du compte",
    content: `Pour accéder au Service, vous devez créer un Compte en fournissant des informations exactes, complètes et à jour, et confirmer votre adresse email.

Vous vous engagez à :

• maintenir la confidentialité de vos identifiants de connexion ;
• assumer l'entière responsabilité de toute activité effectuée depuis votre Compte ;
• nous notifier immédiatement à contact@genforus.com de tout accès ou usage non autorisé constaté.

Vous devez être âgé d'au moins 18 ans et disposer de la capacité juridique de représenter l'entreprise pour laquelle vous utilisez le Service. Nous nous réservons le droit de suspendre ou de supprimer tout Compte fournissant de fausses informations ou violant les présentes Conditions.`,
  },
  {
    num: "05",
    title: "Intégration Facebook, Messenger et API Meta",
    content: `Prosendia s'appuie exclusivement sur les API officielles de Meta Platforms, Inc. (Graph API, Webhooks, Messenger Platform) pour se connecter à vos Pages. En connectant une Page, vous reconnaissez et acceptez que :

• la connexion s'effectue par le protocole OAuth officiel de Facebook — votre mot de passe Facebook n'est jamais transmis ni stocké par prosendia ;
• nous ne demandons que les permissions strictement nécessaires au fonctionnement du Service (gestion de Page, Messenger, commentaires, webhooks) ;
• votre utilisation reste également soumise aux Conditions d'utilisation et aux Standards de la communauté de Meta, ainsi qu'aux limitations qu'elle impose sur les messages automatisés (notamment la fenêtre de messagerie de 24 heures et les tags autorisés hors fenêtre) ;
• prosendia agit en tant que sous-traitant technique pour les données Facebook que vous nous autorisez à traiter, dans le seul but de fournir le Service ;
• prosendia n'est ni affilié à, ni approuvé, ni sponsorisé par Meta Platforms, Inc. ;
• l'accès à l'API peut être modifié, restreint ou révoqué par Meta à tout moment, indépendamment de notre volonté, ce qui peut affecter tout ou partie du Service.

Vous restez seul responsable du respect des politiques de Meta relatives à l'usage automatisé de ses plateformes, y compris en matière de contenu commercial et de sollicitation.`,
  },
  {
    num: "06",
    title: "Utilisation acceptable",
    content: `Vous acceptez d'utiliser prosendia uniquement à des fins légales et conformes à l'objet du Service. Sont notamment interdits :

• l'envoi de communications non sollicitées (spam) ou de sollicitations commerciales trompeuses ;
• toute violation des Conditions d'utilisation ou des Standards de la communauté de Meta / Facebook ;
• l'usurpation d'identité ou toute représentation trompeuse d'une personne ou d'une entité ;
• toute tentative de décompilation, rétro-ingénierie, extraction non autorisée de données ou exploitation abusive du Service ou de son IA ;
• la collecte de données de vos clients sans base légale ou consentement approprié ;
• la diffusion de contenus illicites, haineux, discriminatoires ou portant atteinte aux droits d'un tiers ;
• toute utilisation visant à contourner les limitations techniques, de sécurité ou de quota du Service.

Toute violation constatée peut entraîner la suspension immédiate du Compte, sans préjudice d'éventuelles poursuites judiciaires.`,
  },
  {
    num: "07",
    title: "Intelligence artificielle — fonctionnement et responsabilités",
    content: `L'IA de prosendia analyse le contexte de chaque conversation (historique, langue, intention, catalogue produits, règles définies par l'Utilisateur) afin de proposer ou d'envoyer une réponse adaptée. Trois modes sont disponibles : manuel (l'IA propose, vous validez), semi-automatique (l'IA répond uniquement dans les cas définis par vos règles) et automatique (l'IA répond directement, dans les limites que vous configurez).

Vous reconnaissez et acceptez que :

• l'IA peut, dans de rares cas, produire une réponse imprécise, incomplète ou inadaptée au contexte ;
• vous restez seul responsable des réponses envoyées à vos clients, y compris celles générées automatiquement par l'IA, et devez configurer des règles de supervision adaptées à votre activité ;
• prosendia ne garantit pas l'exactitude, l'exhaustivité ou la pertinence commerciale des réponses générées ;
• vous pouvez à tout moment reprendre la main sur une conversation ou désactiver l'automatisation, en tout ou partie.`,
  },
  {
    num: "08",
    title: "Abonnements, crédits et paiements",
    content: `Prosendia propose plusieurs formules d'abonnement (dont un plan Gratuit) accessibles depuis votre tableau de bord. Chaque appel à l'IA consomme des crédits, dont le volume dépend du plan souscrit.

• Les paiements des offres payantes s'effectuent via les opérateurs de paiement mobile disponibles à Madagascar (MVola, Orange Money) ; aucune donnée de carte bancaire n'est collectée par prosendia.
• Le renouvellement n'est pas automatique : chaque période d'abonnement doit être renouvelée manuellement par l'Utilisateur.
• Aucun remboursement n'est accordé pour une période ou des crédits partiellement utilisés, sauf erreur manifeste imputable à prosendia.
• Les tarifs peuvent évoluer, avec un préavis minimum de 30 jours pour les Utilisateurs déjà abonnés.
• En cas de défaut de paiement ou d'épuisement des crédits, l'accès aux fonctionnalités payantes peut être suspendu ou automatiquement ramené au plan Gratuit.

Le plan Gratuit est soumis aux limitations (nombre de Pages, volume de messages, crédits mensuels) indiquées sur notre page tarifaire, susceptibles d'évoluer.`,
  },
  {
    num: "09",
    title: "Disponibilité et maintenance",
    content: `Nous mettons en œuvre des moyens raisonnables pour assurer un service continu et de qualité, sans pouvoir garantir une disponibilité ininterrompue ou exempte d'erreurs. Des interruptions planifiées (maintenance, mise à jour) ou non planifiées (incident technique, panne d'un prestataire, indisponibilité de l'API Meta) peuvent survenir.

Dans la mesure du possible, les maintenances susceptibles d'affecter significativement le Service sont annoncées à l'avance via l'application ou par email.`,
  },
  {
    num: "10",
    title: "Limitation de responsabilité",
    content: `Dans les limites autorisées par la loi applicable, Genforus ne pourra être tenue responsable des dommages indirects, accessoires, spéciaux ou consécutifs, y compris la perte de profits, de données ou d'opportunités commerciales résultant de l'utilisation ou de l'impossibilité d'utiliser le Service.

Notre responsabilité totale envers vous, toutes causes confondues, ne pourra excéder le montant que vous avez payé pour le Service au cours des trois (3) derniers mois précédant le fait générateur.

Nous ne garantissons pas l'exactitude des réponses générées par l'IA ni la disponibilité continue des API tierces (Meta) dont dépend le Service. Vous êtes responsable de la supervision de vos automatisations avant toute communication à vos clients.`,
  },
  {
    num: "11",
    title: "Propriété intellectuelle",
    content: `L'ensemble des composants du Service — logiciel, interface, algorithmes, modèles de configuration IA, marques et logos prosendia — sont la propriété exclusive de Genforus ou de ses concédants de licence. Les présentes Conditions ne vous confèrent aucun droit de propriété intellectuelle sur le Service, à l'exception d'une licence d'usage limitée, personnelle et non transférable pour la durée de votre abonnement.

Vous conservez l'entière propriété de vos données, contenus, catalogues produits et conversations. En utilisant le Service, vous nous accordez une licence limitée, non exclusive et révocable pour les traiter dans le seul but de fournir et d'améliorer le Service.`,
  },
  {
    num: "12",
    title: "Suspension et résiliation",
    content: `Vous pouvez résilier votre Compte à tout moment depuis les paramètres de votre profil. La suppression prend effet immédiatement pour l'accès au Service ; vos données sont supprimées selon les délais décrits dans notre Politique de confidentialité.

Genforus se réserve le droit de suspendre ou de résilier votre accès, avec ou sans préavis selon la gravité des faits, en cas de :

• violation des présentes Conditions ou des politiques de Meta ;
• non-paiement des sommes dues ;
• comportement frauduleux, abusif ou mettant en danger la sécurité du Service ou d'autres Utilisateurs ;
• injonction d'une autorité légale compétente.`,
  },
  {
    num: "13",
    title: "Modifications du service et des conditions",
    content: `Le Service évolue continuellement : fonctionnalités, plans tarifaires et limites peuvent être ajoutés, modifiés ou retirés à tout moment, dans un souci d'amélioration continue.

Les présentes Conditions peuvent être mises à jour selon les modalités décrites à l'article 1. La version en vigueur est toujours disponible sur cette page, avec sa date de dernière mise à jour.`,
  },
  {
    num: "14",
    title: "Droit applicable et règlement des litiges",
    content: `Les présentes Conditions sont régies par le droit malgache. Avant toute procédure judiciaire, les parties s'engagent à tenter une résolution amiable du litige, notamment par échange avec notre équipe support.

À défaut de résolution amiable, tout litige relatif à l'interprétation ou à l'exécution des présentes Conditions sera soumis à la juridiction exclusive des tribunaux compétents de Madagascar.`,
  },
  {
    num: "15",
    title: "Contact",
    content: `Pour toute question relative aux présentes Conditions d'utilisation :

contact@genforus.com — Questions générales, juridiques et contractuelles
WhatsApp : +261 37 51 127 31
https://prosendia.ai — Site officiel`,
  },
];

export default function TermsPage() {
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
              href="/privacy"
              className="hidden text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Confidentialité
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
              Conditions d&apos;utilisation
            </span>
            <span className="text-xs text-muted-foreground">v{VERSION}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Règles d&apos;utilisation
            <br />
            de prosendia
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
          <div className="mt-6 rounded-xl border border-border/50 bg-card/60 px-5 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              En créant un compte ou en utilisant prosendia, vous acceptez les
              présentes conditions. Nous vous recommandons de les lire
              attentivement, en particulier les articles relatifs à l&apos;IA
              (07) et aux paiements (08).
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
                className="group grid gap-6 border-t border-border/40 py-10 first:border-t-0 md:grid-cols-[100px_1fr] md:gap-16"
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
              Des questions sur ces conditions ?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Contactez-nous à contact@genforus.com
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
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
