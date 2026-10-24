import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z
    .string()
    .url()
    .transform((value) => new URL(value).origin)
    .default("http://localhost:5173"),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/)
    .default("cocacars_admin"),
  MYSQL_USER: z.string().default("cocacars_app"),
  MYSQL_PASSWORD: z.string().default(""),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
});

export const config = envSchema.parse(process.env);
