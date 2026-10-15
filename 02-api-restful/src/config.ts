import { z } from 'zod';

/**
 * Configuración leída del entorno (cargada con `node --env-file=.env`).
 * Si algo falta o es inválido, la app no arranca y explica qué variable falla
 * sin imprimir su valor.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url('DATABASE_URL debe ser una cadena de conexión postgresql://...'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
  /** Ruta opcional al certificado CA de Supabase para verificar TLS. */
  DATABASE_CA_CERT: z.string().optional(),
  CARD_FINGERPRINT_SECRET: z.string().min(32, 'CARD_FINGERPRINT_SECRET debe tener al menos 32 caracteres'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida. Revisa tu archivo .env:\n${problems}`);
  }
  return parsed.data;
}
