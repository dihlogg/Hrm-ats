import { Injectable, Logger } from "@nestjs/common";
import { Message } from "kafkajs";
import { getDlqConfig } from "./dlq.config";
import { ProducerService } from "../producers/producer.service";

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(private readonly producerService: ProducerService) {}

  async sendToDlq(
    messages: Message[],
    originalTopic: string,
    error: Error,
    retryCount?: number
  ): Promise<void> {
    const config = getDlqConfig(originalTopic);
    if (!config) return;

    const dlqTopic = config.dlqTopic;

    const dlqMessages: Message[] = messages.map((msg) => {
      let originalPayload: any;
      try {
        originalPayload = JSON.parse(msg.value as string);
      } catch {
        originalPayload = msg.value?.toString() || "invalid_json";
      }

      return {
        key: msg.key,
        value: JSON.stringify({
          originalPayload,
          _dlqMetadata: {
            originalTopic,
            dlqTopic,
            retryCount,
            errorMessage: error.message,
            errorStack: error.stack,
            failedAt: new Date().toISOString(),
          },
        }),
        headers: msg.headers || {},
      };
    });

    try {
      await this.producerService.produceBatch(dlqTopic, dlqMessages);
      this.logger.warn(
        `Sent ${dlqMessages.length} message(s) to DLQ: ${dlqTopic}`
      );
    } catch (dlqError: any) {
      this.logger.error(`FAILED sending to DLQ ${dlqTopic}`, dlqError.stack);
    }
  }
}
