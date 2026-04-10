import { Logger } from "@nestjs/common";
import {
  Consumer,
  ConsumerConfig,
  ConsumerSubscribeTopics,
  Kafka,
  KafkaMessage,
} from "kafkajs";
import * as retry from "async-retry";
import { IConsumer } from "./interfaces/consumer.interface";
import { sleep } from "../utils/sleep";
import { DlqService } from "./dlq/dlq-handler.service";

export class KafkaConsumer implements IConsumer {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly logger: Logger;

  constructor(
    private readonly topics: ConsumerSubscribeTopics,
    config: ConsumerConfig,
    broker: string,
    private readonly dlqService: DlqService
  ) {
    this.kafka = new Kafka({ brokers: [broker] });
    this.consumer = this.kafka.consumer(config);

    // logger setup topics
    const loggerName = Array.isArray(topics.topics)
      ? topics.topics.join(",")
      : String(topics.topics);
    this.logger = new Logger(`${loggerName}-${config.groupId}`);
  }

  async consume(onMessage: (message: KafkaMessage) => Promise<void>) {
    await this.consumer.subscribe(this.topics);

    await this.consumer.run({
      eachMessage: async ({ message, partition }) => {
        this.logger.debug(`Processing message partition: ${partition}`);

        try {
          await retry(async () => onMessage(message), {
            retries: 3,
            onRetry: (error, attempt) =>
              this.logger.error(`Retry ${attempt}/3 due to error:`, error),
          });
        } catch (err) {
          this.logger.error(`Failed completely. Pushing to DLQ.`, err);
          await this.addMessageToDlq(message);
        }
      },
    });
  }

  
  private async addMessageToDlq(message: KafkaMessage) {
    console.log("Add to DLQ", message.value?.toString());
  }

  async connect() {
    try {
      await this.consumer.connect();
    } catch (err) {
      this.logger.error("Failed to connect. Retry after 5s.", err);
      await sleep(5000);
      await this.connect();
    }
  }

  async disconnect() {
    await this.consumer.disconnect();
  }
}
