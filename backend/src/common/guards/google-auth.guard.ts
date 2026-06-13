/**
 * @file src/common/guards/google-auth.guard.ts
 * @description Guard Passport pour les routes Google OAuth.
 *
 * Utilisé sur :
 *   GET /auth/google           → démarre le flow OAuth
 *   GET /auth/google/callback  → traite le retour Google
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
