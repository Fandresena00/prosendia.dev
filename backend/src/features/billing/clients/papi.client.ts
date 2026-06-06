/**
 * @file features/billing/clients/papi.client.ts
 *
 * FIXES
 * ─────
 * 1. verifyNotification() — le paramètre `expectedReference` doit être
 *    `payment.papiReference` (DB), pas `payload.paymentReference` (reçu).
 *    L'ancienne version comparait le payload avec lui-même → toujours true.
 *    Maintenant la méthode accepte les deux séparément et compare correctement.
 *
 * 2. Logs détaillés à chaque étape de la vérification pour éviter les
 *    échecs silencieux.
 *
 * 3. Vérification du token null/vide avant comparaison — un token vide
 *    ne doit jamais être accepté comme valide.
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAPI_LINK_VALIDITY_MINUTES,
  PROVIDER_TO_PAPI,
} from '../billing.constants.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PapiCreatePaymentLinkRequest {
  amount:          number;
  clientName:      string;
  reference:       string;
  description:     string;
  successUrl:      string;
  failureUrl:      string;
  notificationUrl: string;
  validDuration:   number;
  provider?:       string;
  payerEmail?:     string;
  payerPhone?:     string;
  isTestMode?:     boolean;
  testReason?:     string;
}

export interface PapiPaymentLinkData {
  amount:                 number;
  currency:               string;
  linkCreationDateTime:   number;
  linkExpirationDateTime: number;
  paymentLink:            string;
  clientName:             string;
  paymentReference:       string;
  description:            string;
  successUrl:             string;
  failureUrl:             string;
  notificationUrl:        string;
  payerEmail:             string | null;
  payerPhone:             string | null;
  notificationToken:      string;
  isTestMode:             boolean;
}

export interface PapiNotificationPayload {
  paymentStatus:            string;   // SUCCESS | PENDING | FAILED
  paymentMethod:            string;
  currency:                 string;
  amount:                   number;
  fee:                      number;
  clientName:               string;
  description:              string;
  merchantPaymentReference: string;
  paymentReference:         string;   // référence Papi interne
  notificationToken:        string;
  message:                  string;
  payerEmail:               string | null;
  payerPhone:               string | null;
}

export class PapiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PapiError';
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

const PAPI_BASE_URL = 'https://app.papi.mg';
const PAPI_ENDPOINT = '/dashboard/api/payment-links';
const TIMEOUT_MS    = 15_000;

@Injectable()
export class PapiClient {
  private readonly logger = new Logger(PapiClient.name);
  private readonly apiKey:      string;
  private readonly frontendUrl: string;
  private readonly backendUrl:  string;
  private readonly isTestMode:  boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey      = config.getOrThrow<string>('papiApiKey');
    this.frontendUrl = config.getOrThrow<string>('frontendUrl');
    this.backendUrl  = config.getOrThrow<string>('backendUrl');
    this.isTestMode  = config.get<string>('nodeEnv') !== 'production';
  }

  // ─── Create payment link ──────────────────────────────────────────────────

  async createPaymentLink(
    reference:  string,
    amount:     number,
    provider:   string,
    payerName:  string,
    payerPhone: string,
    planName:   string,
  ): Promise<PapiPaymentLinkData> {
    const papiProvider = PROVIDER_TO_PAPI[provider];
    if (!papiProvider) {
      throw new PapiError(`Fournisseur non supporté: ${provider}`);
    }

    const body: PapiCreatePaymentLinkRequest = {
      amount,
      clientName:      payerName,
      reference,
      description:     `Abonnement VendeoAI ${planName} — ${reference}`.slice(0, 255),
      successUrl:      `${this.frontendUrl}/billing/success?ref=${reference}`,
      failureUrl:      `${this.frontendUrl}/billing/failure?ref=${reference}`,
      notificationUrl: `${this.backendUrl}/billing/webhook/papi`,
      validDuration:   PAPI_LINK_VALIDITY_MINUTES,
      provider:        papiProvider,
      payerPhone,
      isTestMode:      this.isTestMode,
      ...(this.isTestMode ? { testReason: 'VendeoAI sandbox' } : {}),
    };

    this.logger.log(
      `[PAYMENT_CREATE] Creating Papi link — ref=${reference} amount=${amount}MGA ` +
      `provider=${papiProvider} testMode=${this.isTestMode}`,
    );

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${PAPI_BASE_URL}${PAPI_ENDPOINT}`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token':        this.apiKey,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        const msg  = (json.error as { message?: string } | undefined)?.message
          ?? `HTTP ${res.status}`;
        const code = (json.error as { code?: string } | undefined)?.code;
        this.logger.error(
          `[PAYMENT_CREATE_FAILED] Papi HTTP ${res.status} — ref=${reference} ` +
          `msg="${msg}" code=${code ?? '?'}`,
        );
        throw new PapiError(msg, code, res.status);
      }

      const data = (json.data ?? json) as PapiPaymentLinkData;

      if (!data.paymentLink || !data.notificationToken) {
        this.logger.error(
          `[PAYMENT_CREATE_FAILED] Papi response missing paymentLink or ` +
          `notificationToken — ref=${reference} response=${JSON.stringify(data)}`,
        );
        throw new PapiError(
          'Réponse Papi invalide: paymentLink ou notificationToken manquant',
        );
      }

      this.logger.log(
        `[PAYMENT_CREATED] Papi link ready — ref=${reference} ` +
        `amount=${amount}MGA paymentLink=${data.paymentLink.slice(0, 60)}…`,
      );

      return data;
    } catch (err) {
      if (err instanceof PapiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(
          `[PAYMENT_CREATE_FAILED] Papi timeout after ${TIMEOUT_MS / 1000}s — ref=${reference}`,
        );
        throw new PapiError(`Timeout Papi après ${TIMEOUT_MS / 1000}s`);
      }
      this.logger.error(
        `[PAYMENT_CREATE_FAILED] Unexpected error — ref=${reference} err=${String(err)}`,
      );
      throw new InternalServerErrorException(`Erreur Papi: ${String(err)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Verify notification ──────────────────────────────────────────────────

  /**
   * Vérifie l'authenticité d'une notification Papi.
   *
   * FIX : la vérification doit comparer :
   *   - payload.paymentReference  VS  storedReference (payment.papiReference en DB)
   *   - payload.notificationToken VS  storedToken (payment.papiNotificationToken en DB)
   *
   * L'ancienne version passait payload.paymentReference comme expectedReference,
   * ce qui rendait la comparaison tautologique (ref === ref → toujours true).
   *
   * @param payload          Corps de la notification Papi
   * @param storedReference  Valeur de payment.papiReference en base (ex: "VENDEO-ABCD1234")
   * @param storedToken      Valeur de payment.papiNotificationToken en base
   */
  verifyNotification(
    payload:          PapiNotificationPayload,
    storedReference:  string,
    storedToken:      string | null | undefined,
  ): boolean {
    this.logger.debug(
      `[WEBHOOK_VERIFY] Verifying notification — ` +
      `payloadRef="${payload.paymentReference}" storedRef="${storedReference}" ` +
      `status="${payload.paymentStatus}" amount=${payload.amount}`,
    );

    // ── Guard 1: token doit être présent en DB ─────────────────────────────
    if (!storedToken) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] storedToken is null/empty for ref="${storedReference}". ` +
        `Payment link may not have been fully saved. ` +
        `payloadRef="${payload.paymentReference}"`,
      );
      return false;
    }

    // ── Guard 2: comparer la référence payload VS référence DB ────────────
    // FIX: on compare payload.paymentReference avec storedReference (DB)
    // PAS avec payload.paymentReference lui-même.
    if (payload.paymentReference !== storedReference) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] Reference mismatch — ` +
        `payload="${payload.paymentReference}" stored="${storedReference}"`,
      );
      return false;
    }

    // ── Guard 3: comparer le token payload VS token DB ─────────────────────
    if (payload.notificationToken !== storedToken) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] Token mismatch for ref="${storedReference}". ` +
        `Expected token from DB does not match payload token.`,
      );
      return false;
    }

    this.logger.log(
      `[PAYMENT_VERIFIED] Notification verified — ref="${storedReference}" ` +
      `status="${payload.paymentStatus}" amount=${payload.amount}MGA`,
    );

    return true;
  }
}
