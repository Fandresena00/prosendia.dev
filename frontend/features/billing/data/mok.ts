/**
 * @file features/billing/data/mock.ts
 * @description Mock data for billing plans and payment history.
 */

import { HistoryItem, Plan } from "../types/billing.types";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    price: 0,
    desc: "Pour découvrir VendeoAI",
    current: true,
    features: [
      "1 page Facebook",
      "500 messages/mois",
      "Réponses basiques",
      "Support email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29000,
    desc: "Pour les vendeurs actifs",
    current: false,
    popular: true,
    features: [
      "3 pages Facebook",
      "Messages illimités",
      "IA avancée",
      "Analytics complets",
      "Support prioritaire",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 79000,
    desc: "Pour les grandes équipes",
    current: false,
    features: [
      "Pages illimitées",
      "API personnalisée",
      "Intégrations avancées",
      "Support 24/7",
      "Formation équipe",
    ],
  },
];

export const HISTORY: HistoryItem[] = [
  {
    id: "INV-2024-004",
    date: "01 Avr 2024",
    plan: "Pro",
    amount: 29000,
    method: "MVola",
    status: "paid",
  },
  {
    id: "INV-2024-003",
    date: "01 Mar 2024",
    plan: "Pro",
    amount: 29000,
    method: "Orange Money",
    status: "paid",
  },
  {
    id: "INV-2024-002",
    date: "01 Fév 2024",
    plan: "Pro",
    amount: 29000,
    method: "MVola",
    status: "paid",
  },
  {
    id: "INV-2024-001",
    date: "01 Jan 2024",
    plan: "Starter",
    amount: 9000,
    method: "MVola",
    status: "paid",
  },
];
