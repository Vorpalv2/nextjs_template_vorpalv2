import { z } from 'zod';

export const configSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens.'),
  kind: z.enum(['website', 'webapp', 'ai']).default('website'),
  database: z.enum(['none', 'supabase', 'neon', 'sqlite', 'mongodb']).default('none'),
  orm: z.enum(['auto', 'native', 'drizzle', 'prisma']).default('auto'),
  auth: z.enum(['none', 'supabase', 'better-auth', 'clerk']).default('none'),
  email: z.enum(['none', 'resend']).default('none'),
  query: z.boolean().default(false),
  ai: z.enum(['none', 'gateway', 'openai', 'anthropic', 'google']).default('none'),
  persistence: z.boolean().default(false),
  style: z.enum(['nova', 'vega', 'maia', 'lyra', 'mira']).default('nova'),
  baseColor: z.enum(['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe']).default('neutral'),
  accent: z.enum(['neutral', 'blue', 'violet', 'green', 'orange']).default('neutral'),
  radius: z.enum(['none', 'small', 'medium', 'large']).default('medium'),
  preset: z.string().regex(/^[a-zA-Z0-9-]+$/).optional(),
  ui: z.enum(['none', 'shadcn', 'aceternity', 'both']).default('shadcn'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  font: z.enum(['geist', 'inter', 'google', 'local', 'system']).default('geist'),
  fontFamily: z.string().regex(/^[A-Za-z][A-Za-z0-9 _-]*$/).optional(),
  fontPath: z.string().optional(),
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).default('npm'),
  git: z.boolean().default(true),
  github: z.string().optional(),
  install: z.boolean().default(true),
}).superRefine((c, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (c.auth === 'supabase' && c.database !== 'supabase') error('Supabase Auth requires the Supabase database preset.');
  if (c.auth === 'better-auth' && !['neon','sqlite','mongodb'].includes(c.database)) error('Better Auth requires Neon, SQLite, or MongoDB.');
  const orm = c.orm === 'auto' ? c.database === 'neon' || c.database === 'sqlite' ? 'drizzle' : 'native' : c.orm;
  if (['none','supabase'].includes(c.database) && orm !== 'native') error('This database choice uses its native client.');
  if (c.database === 'mongodb' && orm === 'drizzle') error('MongoDB supports its native driver or Prisma, not Drizzle.');
  if (['neon','sqlite'].includes(c.database) && orm === 'native') error('Neon and SQLite require Drizzle or Prisma.');
  if (c.preset && c.ui === 'none') error('A shadcn preset requires a UI library choice.');
  if (c.persistence && (c.ai === 'none' || c.database === 'none' || c.auth === 'none')) error('Saved conversations require AI, a database, and authentication.');
  if (c.font === 'google' && !c.fontFamily) error('A Google font family is required.');
  if (c.font === 'local' && (!c.fontPath || !/\.(woff2?|ttf|otf)$/i.test(c.fontPath))) error('Provide a local .woff2, .woff, .ttf or .otf font file.');
  if (c.github && !/^(https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?|git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?)$/.test(c.github)) error('Enter a GitHub HTTPS or SSH repository URL without credentials.');
  if (c.github && !c.git) error('Connecting a GitHub repository requires Git initialization.');
});
export type Config = z.infer<typeof configSchema>;
export function selectedOrm(c: Config): 'native' | 'drizzle' | 'prisma' {
  return c.orm === 'auto' ? c.database === 'neon' || c.database === 'sqlite' ? 'drizzle' : 'native' : c.orm;
}
export type Files = Record<string, string>;
export const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
