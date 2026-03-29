import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    KAFKA_BROKERS: z.string().default("localhost:9092"),
    RABBITMQ_URL: z.string().url().default("amqp://localhost:5672"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
