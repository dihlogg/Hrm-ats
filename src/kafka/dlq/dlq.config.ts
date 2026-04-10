import { KAFKA_DLQ_MAP } from "../config/kafka-topics.constant";

export function getDlqConfig(originalTopic: string) {
  const dlqTopic = KAFKA_DLQ_MAP[originalTopic];

  if (!dlqTopic) return null;

  return {
    originalTopic,
    dlqTopic,
  };
}
