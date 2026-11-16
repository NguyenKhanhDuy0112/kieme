import { z } from 'zod';

export const VariableNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Variable name must be letters, digits or `_`');

/** Environment (dev / staging / prod…) with its variables [E-02]. */
export const EnvSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.url().optional(),
  variables: z.record(VariableNameSchema, z.string()).default({}),
  /** Names of secrets this env expects; values never live in the env [E-08]. */
  secretNames: z.array(VariableNameSchema).default([]),
});
export type Env = z.infer<typeof EnvSchema>;

/** Decrypted secret values handed to the engine for one run [E-08]. */
export const SecretsSchema = z.record(VariableNameSchema, z.string());
export type Secrets = z.infer<typeof SecretsSchema>;
