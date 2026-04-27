/**
 * @file src/common/cache/cache.service.ts
 * @description Abstract cache contract to keep business services decoupled
 * from the underlying cache backend.
 */

export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  abstract del(key: string): Promise<void>;
}
