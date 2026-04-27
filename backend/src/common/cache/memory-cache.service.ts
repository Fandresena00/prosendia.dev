import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service.js';

interface MemoryCacheEntry<T> {
  value: T;
  timeout?: NodeJS.Timeout;
}

@Injectable()
export class MemoryCacheService extends CacheService {
  private readonly cache = new Map<string, MemoryCacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    return (entry?.value as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const existing = this.cache.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    const entry: MemoryCacheEntry<T> = { value };

    if (ttlSeconds && ttlSeconds > 0) {
      entry.timeout = setTimeout(() => {
        this.cache.delete(key);
      }, ttlSeconds * 1000);
    }

    this.cache.set(key, entry as MemoryCacheEntry<unknown>);
  }

  async del(key: string): Promise<void> {
    const existing = this.cache.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    this.cache.delete(key);
  }
}
