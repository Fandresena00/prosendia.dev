import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { MemoryCacheService } from './memory-cache.service.js';

@Global()
@Module({
  providers: [
    MemoryCacheService,
    {
      provide: CacheService,
      useExisting: MemoryCacheService,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
