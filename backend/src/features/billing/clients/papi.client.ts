/**
 * @file features/billing/clients/papi.client.ts
 *
 * FIX — verifyNotification() aligné sur la documentation Papi
 * ─────────────────────────────────────────────────────────────
 * La doc Papi confirme :
 *   `paymentReference`         = la référence que VOUS avez envoyée (notre VENDEO-xxx)
 *   `merchantPaymentReference` = référence interne du prestataire Papi
 *
 * Pour vérifier l'authenticité :
 *   - `paymentReference` doit correspondre à ce qu'on a stocké (papiReference en DB)
 *   - `notificationToken` doit correspondre au token reçu à la création du lien
 *
 * La vérification est maintenant documentée et alignée sur la spec officielle.
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
  /**
   * Papi retourne ici la référence que VOUS avez envoyée (champ `reference`).
   * C'est notre VENDEO-XXXXXXXX.
   */
  paymentReference:       string;
  description:            string;
  successUrl:             string;
  failureUrl:             string;
  notificationUrl:        string;
  payerEmail:             string | null;
  payerPhone:             string | null;
  /** Token à stocker pour vérifier les futures notifications. */
  notificationToken:      string;
  isTestMode:             boolean;
}

export interface PapiNotificationPayload {
  paymentStatus:            string;  // SUCCESS | PENDING | FAILED
  paymentMethod:            string;
  currency:                 string;
  amount:                   number;
  fee:                      number;
  clientName:               string;
  description:              string;
  /**
   * Référence interne du prestataire de paiement Papi.
   * PAS notre référence.
   */
  merchantPaymentReference: string;
  /**
   * Notre référence unique envoyée lors de la création du lien.
   * C'est notre VENDEO-XXXXXXXX.
   * Utiliser ce champ pour retrouver le paiement en DB.
   */
  paymentReference:         string;
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
    // isTestMode = true UNIQUEMENT en development
    // En production Render.com → false → vrai paiement + vrai webhook
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
      // `reference` = notre identifiant unique → sera retourné dans paymentReference
      reference,
      description:     `Abonnement VendeoAI ${planName} — ${reference}`.slice(0, 255),
      successUrl:      `${this.frontendUrl}/billing/success?ref=${reference}`,
      failureUrl:      `${this.frontendUrl}/billing/failure?ref=${reference}`,
      // L'URL de notification DOIT être accessible depuis internet
      // En dev local → utiliser ngrok ou un tunnel, pas localhost
      notificationUrl: `${this.backendUrl}/billing/webhook/papi`,
      validDuration:   PAPI_LINK_VALIDITY_MINUTES,
      provider:        papiProvider,
      payerPhone,
      isTestMode:      this.isTestMode,
      ...(this.isTestMode ? { testReason: 'VendeoAI sandbox' } : {}),
    };

    this.logger.log(
      `[PAYMENT_CREATE] Creating Papi link — ref=${reference} amount=${amount}MGA ` +
      `provider=${papiProvider} testMode=${this.isTestMode} ` +
      `notificationUrl=${body.notificationUrl}`,
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
          `[PAYMENT_CREATE_FAILED] Missing paymentLink or notificationToken — ` +
          `ref=${reference} response=${JSON.stringify(data)}`,
        );
        throw new PapiError(
          'Réponse Papi invalide: paymentLink ou notificationToken manquant',
        );
      }

      this.logger.log(
        `[PAYMENT_CREATED] Papi link ready — ref=${reference} ` +
        `papiPaymentRef="${data.paymentReference}" ` +
        `amount=${amount}MGA`,
      );

      return data;
    } catch (err) {
      if (err instanceof PapiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(
          `[PAYMENT_CREATE_FAILED] Timeout after ${TIMEOUT_MS / 1000}s — ref=${reference}`,
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
   * Selon la documentation officielle Papi :
   *   "Pour s'assurer que la notification est authentique, vérifiez que :
   *    - `paymentReference` correspond à la référence que vous avez envoyée.
   *    - `notificationToken` correspond à celui reçu dans la réponse de création."
   *
   * @param payload         Corps de la notification Papi
   * @param storedReference payment.papiReference en DB (notre VENDEO-xxx)
   * @param storedToken     payment.papiNotificationToken en DB
   */
  verifyNotification(
    payload:          PapiNotificationPayload,
    storedReference:  string,
    storedToken:      string | null | undefined,
  ): boolean {
    this.logger.debug(
      `[WEBHOOK_VERIFY] payload.paymentReference="${payload.paymentReference}" ` +
      `storedReference="${storedReference}" ` +
      `status="${payload.paymentStatus}" amount=${payload.amount}MGA`,
    );

    // Guard 1 — token présent en DB
    if (!storedToken) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] storedToken is null for ref="${storedReference}". ` +
        `Payment link save may have failed.`,
      );
      return false;
    }

    // Guard 2 — paymentReference correspond à notre référence (selon doc Papi)
    if (payload.paymentReference !== storedReference) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] paymentReference mismatch — ` +
        `payload="${payload.paymentReference}" stored="${storedReference}"`,
      );
      return false;
    }

    // Guard 3 — notificationToken correspond
    if (payload.notificationToken !== storedToken) {
      this.logger.error(
        `[WEBHOOK_VERIFY_FAILED] notificationToken mismatch for ref="${storedReference}"`,
      );
      return false;
    }

    this.logger.log(
      `[PAYMENT_VERIFIED] Notification authentic — ref="${storedReference}" ` +
      `status="${payload.paymentStatus}" amount=${payload.amount}MGA`,
    );

    return true;
  }
}
