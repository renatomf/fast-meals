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

// Os segredos do .env.example estão publicados no repositório: em produção, quem os usasse
// assinaria tokens com uma chave que qualquer um conhece e poderia forjar um admin.
const publicExampleSecrets = new Set([
  "sua-chave-secreta-aqui-trocar-em-producao",
  "sua-chave-refresh-aqui-trocar-em-producao",
]);

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
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    // Quantos proxies confiáveis existem na frente da API (o nginx do front no Docker).
    // Sem isso, atrás de um proxy todo cliente tem o IP dele e divide o mesmo limite.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    // Liga POST /api/dispatch/demo-scenario, que cria dados de demonstração. O compose liga
    // para a avaliação; sem a variável, a rota nem existe.
    DEMO_MODE: z.stringbool().default(false),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "deve ser diferente de JWT_SECRET",
      });
    }
    if (env.NODE_ENV !== "production") return;
    for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET"] as const) {
      if (publicExampleSecrets.has(env[key])) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "é o valor público do .env.example; gere um segredo (openssl rand -base64 48)",
        });
      }
    }
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
