import { Module } from '@nestjs/common';
import { LlmProviderService } from './llm-provider.service';

@Module({
  providers: [LlmProviderService],
  exports: [LlmProviderService],
})
export class LlmModule {}
