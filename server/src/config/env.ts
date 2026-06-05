import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  TOKEN_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z
    .union([z.string(), z.boolean()])
    .default("false")
    .transform((value) => {
      if (typeof value === "boolean") return value;
      return value.toLowerCase() === "true";
    })
});

export const env = EnvSchema.parse(process.env);
