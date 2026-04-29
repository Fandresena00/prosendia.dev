import { Global, Module } from '@nestjs/common';
import { InboxEventEmitter } from './gateways/inbox-sse.gateway.js';

@Global()
@Module({
  providers: [InboxEventEmitter],
  exports: [InboxEventEmitter],
})
export class InboxEventsModule {}
