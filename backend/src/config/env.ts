import { z } from "zod";

const durationUnitsMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// "15m", "7d": o formato do .env.example, convertido para milissegundos.
const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'use um número seguido de s, m, h ou d (ex.: "15m", "7d")')
  .transform((value) => {
    const unit = value.slice(-1) as keyof typeof durationUnitsMs;
    return Number(value.slice(0, -1)) * durationUnitsMs[unit];
  });

const secret = z.string().min(32, "precisa de pelo menos 32 caracteres");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "deve ser uma connection string do PostgreSQL"),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    JWT_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    JWT_EXPIRES_IN: duration.prefault("15m"),
    JWT_REFRESH_EXPIRES_IN: duration.prefault("7d"),
  })
  .refine((env) => env.JWT_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ["JWT_REFRESH_SECRET"],
    message: "deve ser diferente de JWT_SECRET",
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${problems}\nCopy .env.example to .env and adjust the values.`,
  );
}
