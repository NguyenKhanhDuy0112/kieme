import { z } from 'zod';

export const VariableNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Variable name must be letters, digits or `_`');

/**
 * Proxy for every browser session of an environment [G-06].
 * `server`: `http://host:port`, `https://host:port` or `socks5://host:port`.
 * Host names are resolved by the proxy (DNS through the proxy), so internal
 * names only known on the other side work.
 */
export const ProxySchema = z
  .object({
    server: z
      .string()
      .regex(
        /^(https?|socks5):\/\/[^\s/:]+(:\d{1,5})?\/?$/,
        'Proxy must look like http://host:port or socks5://host:port',
      ),
    username: z.string().min(1).optional(),
    /** Name of the secret holding the password (never the password itself) [E-08]. */
    passwordSecret: VariableNameSchema.optional(),
    /** Hosts that skip the proxy, e.g. `localhost`, `.company.local`, `10.0.0.0/8`. */
    bypass: z.array(z.string().min(1)).default([]),
  })
  .superRefine((p, ctx) => {
    if (
      p.server.startsWith('socks5://') &&
      (p.username !== undefined || p.passwordSecret !== undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'SOCKS5 proxies with username/password are not supported by the browser',
        path: ['username'],
      });
    }
    if (p.passwordSecret !== undefined && p.username === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Password needs a username', path: ['username'] });
    }
  });
export type ProxySettings = z.infer<typeof ProxySchema>;

/** Environment (dev / staging / prod…) with its variables [E-02]. */
export const EnvSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.url().optional(),
  variables: z.record(VariableNameSchema, z.string()).default({}),
  /** Names of secrets this env expects; values never live in the env [E-08]. */
  secretNames: z.array(VariableNameSchema).default([]),
  /** Proxy used by every session of runs in this env [G-06]. */
  proxy: ProxySchema.optional(),
});
export type Env = z.infer<typeof EnvSchema>;

/** Decrypted secret values handed to the engine for one run [E-08]. */
export const SecretsSchema = z.record(VariableNameSchema, z.string());
export type Secrets = z.infer<typeof SecretsSchema>;
