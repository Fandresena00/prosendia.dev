/**
 * @file scripts/seed-super-admin.ts
 * @description Crée le compte SUPER_ADMIN unique de la plateforme.
 *
 * Idempotent : si un SUPER_ADMIN existe déjà, le script ne fait rien.
 * Un seul SUPER_ADMIN doit exister — la création se fait exclusivement
 * via ce script, jamais via l'API (AdminManagementController force
 * toujours role=ADMIN à la création).
 *
 * Utilise le même adapter PrismaPg que PrismaService (src/database/prisma.service.ts)
 * — un PrismaClient sans adapter ne fonctionnerait pas avec ce projet.
 *
 * Usage:
 *   pnpm seed:super-admin
 *
 * Variables requises (.env):
 *   DATABASE_URL=postgresql://...
 *   SUPER_ADMIN_EMAIL=admin@vendeoai.com
 *   SUPER_ADMIN_PASSWORD=motdepassefort
 */

import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client.js';

const PASSWORD_HASH_ROUNDS = 12;

// ─── Connexion Prisma (même pattern que PrismaService) ─────────────────────────

const connectionString = getRequiredEnv('DATABASE_URL');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Validation des variables d'environnement ──────────────────────────────────

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[SEED_SUPER_ADMIN] Variable d'environnement manquante: ${key}`,
    );
  }
  return value;
}

// ─── Seed ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const email = getRequiredEnv('SUPER_ADMIN_EMAIL');
  const password = getRequiredEnv('SUPER_ADMIN_PASSWORD');

  if (password.length < 12) {
    throw new Error(
      '[SEED_SUPER_ADMIN] SUPER_ADMIN_PASSWORD doit contenir au moins 12 caractères.',
    );
  }

  const existingSuperAdmin = await prisma.admin.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingSuperAdmin) {
    console.log(
      `[SEED_SUPER_ADMIN] Super admin déjà existant — ` +
        `email=${existingSuperAdmin.email} createdAt=${existingSuperAdmin.createdAt.toISOString()}. ` +
        `Aucune action effectuée.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    select: { id: true, email: true, createdAt: true },
  });

  console.log(
    `[SEED_SUPER_ADMIN] Super admin créé avec succès — ` +
      `id=${admin.id} email=${admin.email} createdAt=${admin.createdAt.toISOString()}`,
  );
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SEED_SUPER_ADMIN] Échec: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
