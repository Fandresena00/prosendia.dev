/**
 * @file lib/network-monitor.ts
 * @description Network and backend availability monitoring.
 *
 * Two-layer detection:
 *   Layer 1 — browser `online`/`offline` events (instant, but unreliable — a
 *             phone connected to Wi-Fi with no internet still fires "online")
 *   Layer 2 — backend health check ping (definitive, but async)
 *
 * Consumers subscribe via `networkMonitor.subscribe(callback)` to receive
 * status updates without re-rendering the whole app.
 *
 * Used by:
 *   - auth.store → when backend comes back, trigger session restoration
 *   - api-client → decide whether to retry or surface NetworkError
 */

import { env } from "./env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkStatus = "online" | "offline" | "unknown";

type Listener = (status: NetworkStatus) => void;

// ─── Monitor ──────────────────────────────────────────────────────────────────

class NetworkMonitor {
  private status: NetworkStatus = "unknown";
  private listeners: Set<Listener> = new Set();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /** Interval for backend health checks when browser reports "online" (ms) */
  private readonly HEALTH_CHECK_INTERVAL_MS = 15_000;

  /** Timeout for individual health check requests (ms) */
  private readonly HEALTH_CHECK_TIMEOUT_MS = 5_000;

  // ─── Initialization ──────────────────────────────────────────────────────

  /**
   * Sets up browser event listeners and runs an initial health check.
   * Call once at app boot. Safe to call multiple times (idempotent).
   */
  init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Sync with browser's view of connectivity
    this.setStatus(navigator.onLine ? "online" : "offline");

    window.addEventListener("online", this.handleBrowserOnline);
    window.addEventListener("offline", this.handleBrowserOffline);

    // Initial backend check
    void this.checkBackend();
  }

  destroy(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.handleBrowserOnline);
    window.removeEventListener("offline", this.handleBrowserOffline);
    this.stopHealthCheck();
  }

  // ─── Status accessors ────────────────────────────────────────────────────

  getStatus(): NetworkStatus {
    return this.status;
  }

  isOnline(): boolean {
    return this.status === "online";
  }

  isOffline(): boolean {
    return this.status === "offline";
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediately emit current status so the subscriber is up to date
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private setStatus(next: NetworkStatus): void {
    if (next === this.status) return;
    this.status = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private readonly handleBrowserOnline = (): void => {
    // Browser reports online, but backend might still be unreachable.
    // Check backend before declaring "online".
    void this.checkBackend();
    this.startHealthCheck();
  };

  private readonly handleBrowserOffline = (): void => {
    this.setStatus("offline");
    this.stopHealthCheck();
  };

  /**
   * Pings GET /api/health to verify the backend is actually reachable.
   * Falls back to "online" if the endpoint doesn't exist (2xx required).
   */
  private async checkBackend(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.HEALTH_CHECK_TIMEOUT_MS,
      );

      const response = await fetch(`${env.API_URL}/health`, {
        method: "GET",
        signal: controller.signal,
        credentials: "include",
        cache: "no-store",
      });

      clearTimeout(timeoutId);
      const reachable = response.ok;
      this.setStatus(reachable ? "online" : "offline");
      return reachable;
    } catch {
      // fetch threw — backend unreachable or aborted
      this.setStatus("offline");
      return false;
    }
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(() => {
      void this.checkBackend();
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Singleton — one monitor for the entire app
export const networkMonitor = new NetworkMonitor();
