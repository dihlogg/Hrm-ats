import { Module } from '@nestjs/common';
import { LlmProviderService } from './llm-provider.service';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [LlmProviderService, EmbeddingService],
  exports: [LlmProviderService, EmbeddingService],
})
export class LlmModule {}
