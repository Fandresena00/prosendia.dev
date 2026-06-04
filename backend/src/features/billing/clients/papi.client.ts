/**
 * @file features/billing/clients/papi.client.ts
 *
 * Client HTTP Papi — https://app.papi.mg
 * Docs : https://docs.papi.mg/docs/quickstart
 *
 * Auth header : Token: <API_KEY>
 * Endpoint    : POST https://app.papi.mg/dashboard/api/payment-links
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

const PAPI_BASE_URL    = 'https://app.papi.mg';
const PAPI_ENDPOINT    = '/dashboard/api/payment-links';
const TIMEOUT_MS       = 15_000;

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
        const msg  = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        const code = (json.error as { code?: string } | undefined)?.code;
        this.logger.error(`Papi ${res.status}: ${msg} [${code ?? '?'}]`);
        throw new PapiError(msg, code, res.status);
      }

      const data = (json.data ?? json) as PapiPaymentLinkData;

      if (!data.paymentLink || !data.notificationToken) {
        throw new PapiError('Réponse Papi invalide: paymentLink ou notificationToken manquant');
      }

      this.logger.log(`Papi link created — ref=${reference} amount=${amount}MGA`);
      return data;
    } catch (err) {
      if (err instanceof PapiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PapiError(`Timeout Papi après ${TIMEOUT_MS / 1000}s`);
      }
      throw new InternalServerErrorException(`Erreur Papi: ${String(err)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Verify notification ──────────────────────────────────────────────────

  verifyNotification(
    payload:           PapiNotificationPayload,
    expectedReference: string,
    expectedToken:     string,
  ): boolean {
    if (payload.paymentReference !== expectedReference) {
      this.logger.warn(`Papi notification: ref mismatch expected="${expectedReference}" got="${payload.paymentReference}"`);
      return false;
    }
    if (payload.notificationToken !== expectedToken) {
      this.logger.warn(`Papi notification: token mismatch ref=${expectedReference}`);
      return false;
    }
    return true;
  }
}
