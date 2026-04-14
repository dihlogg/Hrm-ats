import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ai: GoogleGenAI;
  private readonly embeddingModel: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.embeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
  }

  /**
   * Converts a text string into a numerical vector (embedding) using Gemini LLM
   * The resulting vector captures semantic meaning and can be compared
   * with other embeddings using cosine similarity.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('EMBEDDING_INPUT_EMPTY');
    }

    const truncatedText = text.slice(0, 8000);

    this.logger.debug(
      `Generating embedding with model: ${this.embeddingModel} (${truncatedText.length} chars)`,
    );

    const result = await this.ai.models.embedContent({
      model: this.embeddingModel,
      contents: truncatedText,
    });

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error('EMBEDDING_EMPTY_RESPONSE');
    }

    return values;
  }

  /**
   * Computes the Cosine Similarity between two embedding vectors.
   * Returns a value between -1 and 1, where:
   *   1  = identical semantic meaning
   *   0  = completely unrelated
   *  -1  = opposite meaning (rare for text)
   *
   * Formula: dotProduct(a, b) / (|a| * |b|)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(
        `COSINE_DIMENSION_MISMATCH: a=${a.length}, b=${b.length}`,
      );
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return Math.max(-1, Math.min(1, dotProduct / (magnitudeA * magnitudeB)));
  }
}
