/**
 * @file config/nav.config.ts
 * @description Centralized navigation configuration for the workspace sidebar.
 *
 * Adding a new page = add one object here. Nothing else changes.
 *
 * Future extensions already modeled:
 *   - `badge`         → notification count (static or dynamic)
 *   - `plan`          → lock item behind a plan (FREE / PRO / ENTERPRISE)
 *   - `disabled`      → grey-out without removing (feature flag / coming soon)
 *   - `external`      → opens in a new tab
 */

import type { Plan } from "@/features/auth/schemas/user.schema";
import {
  IconBrandFacebook,
  IconBuildingStore,
  IconCreditCard,
  IconHome,
  IconMessageCircle,
  IconSettings,
} from "@tabler/icons-react";
import type { ElementType } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NavItem {
  title: string;
  url: string;
  icon: ElementType;
  /** Badge value — pass a string for static, or a store selector key for dynamic */
  badge?: string;
  /** Minimum plan required to access this item (undefined = always visible) */
  plan?: Plan;
  /** Prevents navigation — useful for "coming soon" features */
  disabled?: boolean;
  /** Opens in a new tab */
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── Config ────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: IconHome,
      },
      {
        title: "Inbox",
        url: "/inbox",
        icon: IconMessageCircle,
        badge: "3",
      },
    ],
  },
  {
    label: "Automatisation",
    items: [
      {
        title: "Posts & Commentaires",
        url: "/posts-comments",
        icon: IconBrandFacebook,
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        title: "Profil Business",
        url: "/business-profile",
        icon: IconBuildingStore,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        title: "Gestions des pages",
        url: "/facebook-page",
        icon: IconBrandFacebook,
      },
      {
        title: "Paramètres",
        url: "/settings",
        icon: IconSettings,
      },
    ],
  },
  {
    label: "Compte",
    items: [
      {
        title: "Facturation",
        url: "/billing",
        icon: IconCreditCard,
      },
    ],
  },
];
