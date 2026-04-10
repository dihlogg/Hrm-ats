import { Logger } from "@nestjs/common";
import { Kafka, Message, Producer } from "kafkajs";
import { sleep } from "../utils/sleep";
import { IProducer } from "./interfaces/producer.interface";

export class KafkaProducer implements IProducer {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly logger: Logger;

  constructor(
    private readonly topic: string,
    broker: string
  ) {
    this.kafka = new Kafka({
      brokers: [broker],
    });
    this.producer = this.kafka.producer();
    this.logger = new Logger(topic);
  }

  async produce(messages: Message[] | Message) {
    const msgs = Array.isArray(messages) ? messages : [messages];
    await this.producer.send({
      topic: this.topic,
      messages: msgs,
    });
  }

  async connect() {
    try {
      await this.producer.connect();
    } catch (err) { 
      this.logger.error("Failed to connect to Kafka.", err);
      await sleep(5000);
      await this.connect();
    }
  }

  async disconnect() {
    await this.producer.disconnect();
  }
}
