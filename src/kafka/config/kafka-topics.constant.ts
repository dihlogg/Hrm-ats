import 'dotenv/config'; // load .env

export const KAFKA_TOPICS = {
  CV_PARSING_REQUEST: process.env.KAFKA_CV_PARSING_REQUEST || '',
  CV_PARSING_REQUEST_DLQ: process.env.KAFKA_CV_PARSING_REQUEST_DLQ || '',
} as const;

export const KAFKA_DLQ_MAP: Record<string, string> = {
  [KAFKA_TOPICS.CV_PARSING_REQUEST]: KAFKA_TOPICS.CV_PARSING_REQUEST_DLQ,
};
