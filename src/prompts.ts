import * as p from '@clack/prompts';
import { configSchema, type Config } from './config.js';
function answer<T>(value: T): Exclude<T, symbol> { if (p.isCancel(value)) { p.cancel('Setup cancelled.'); process.exit(0); } return value as Exclude<T, symbol>; }
const select = async <T extends string>(message: string, values: readonly T[], initialValue?: T): Promise<T> => answer(await p.select<string>({message, options: values.map(value => ({value, label:value})), initialValue})) as T;
const confirm = async (message: string, initialValue = true) => answer(await p.confirm({message, initialValue}));
const text = async (message: string, placeholder?: string) => answer(await p.text({message, placeholder}));
export async function ask(name?: string): Promise<Config> {
  p.intro('VORPAL / Next.js, your way');
  const project = name ?? await text('Project name?', 'my-app');
  const kind = await select('What are you building?', ['website','webapp','ai'] as const);
  const ui = await select('UI components?', ['none','shadcn','aceternity','both'] as const, 'shadcn');
  const appearance = ui === 'none' ? 'recommended' : await select('Appearance setup?', ['recommended','customize','preset'] as const);
  let style: Config['style'] = 'nova', baseColor: Config['baseColor'] = 'neutral', accent: Config['accent'] = 'neutral', radius: Config['radius'] = 'medium', preset: string | undefined;
  if (appearance === 'preset') preset = await text('Paste your shadcn preset code (ui.shadcn.com/create)');
  if (appearance === 'customize') {
    style = await select('Component style?', ['nova','vega','maia','lyra','mira'] as const);
    baseColor = await select('Base color?', ['neutral','stone','zinc','mauve','olive','mist','taupe'] as const);
    accent = await select('Accent color?', ['neutral','blue','violet','green','orange'] as const);
    radius = await select('Corner radius?', ['none','small','medium','large'] as const);
  }
  const theme = await select('Theme mode?', ['system','light','dark'] as const, 'system');
  p.note('system includes light + dark, follows your device, and includes a reusable toggle.\nlight / dark lock the app to that mode.', 'Theme behavior');
  const font = await select('Font?', ['geist','inter','google','local','system'] as const);
  const fontFamily = font === 'google' ? await text('Google font family?', 'DM Sans') : undefined;
  const fontPath = font === 'local' ? await text('Path to your local font file?', './brand.woff2') : undefined;
  const database = await select('Database?', ['none','supabase','neon','sqlite','mongodb'] as const, kind === 'website' ? 'none' : 'supabase');
  const orm = database === 'neon' || database === 'sqlite' ? await select('ORM?', ['drizzle','prisma'] as const, 'drizzle') : database === 'mongodb' ? await select('Data access?', ['native','prisma'] as const, 'native') : 'native';
  const authChoices: Config['auth'][] = database === 'supabase' ? ['supabase','clerk','none'] : ['neon','sqlite','mongodb'].includes(database) ? ['better-auth','clerk','none'] : ['none','clerk'];
  const auth = await select('Authentication?', authChoices);
  const query = await confirm('Include TanStack Query?', kind !== 'website');
  const email = await select('Email integration? (credentials can be added later)', ['none','resend'] as const);
  const ai = await select('AI SDK model provider?', ['none','gateway','openai','anthropic','google'] as const, kind === 'ai' ? 'gateway' : 'none');
  const persistence = ai !== 'none' && database !== 'none' && auth !== 'none' ? await confirm('Save conversations to your database?') : false;
  const packageManager = await select('Package manager?', ['npm','pnpm','yarn','bun'] as const);
  const git = await confirm('Initialize Git?');
  const github = git ? (await text('GitHub repository URL? Leave blank to add later.') || undefined) : undefined;
  const install = await confirm(ui === 'none' ? 'Install dependencies now?' : 'Install dependencies and UI components now?');
  const config = configSchema.parse({name:project, kind, database, orm, auth, query, email, ai, persistence, ui, style,baseColor,accent,radius,preset,theme,font,fontFamily,fontPath,packageManager,git,github,install});
  p.note(Object.entries(config).filter(([,v]) => v !== undefined).map(([k,v]) => `${k}: ${v}`).join('\n'), 'Your project');
  if (!await confirm('Create this project?')) { p.cancel('Nothing created.'); process.exit(0); }
  return config;
}
