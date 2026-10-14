# create-nextjs-vorpalv2

Interactive CLI for creating a Next.js app with optional auth, database, AI, email, themes, and route scaffolding. Choose your stack, appearance, and font to get a working application with polished starter screens.

```sh
npx create-nextjs-vorpalv2@latest my-app
```

To try the local implementation:

```sh
npm install
npm run build
node dist/cli.js my-app
```

## Choices

- Website, web app, or AI app starter
- Supabase, Neon, or no database
- Supabase Auth, Better Auth, Clerk, or no auth (compatible choices only)
- TanStack Query
- Resend and React Email templates
- AI SDK with AI Gateway, OpenAI, Anthropic, or Google; optional private conversation persistence
- shadcn styles, colors, corner radius, or an official preset code
- System/light/dark theme; dual mode includes a persistent reusable theme toggle
- Geist, Inter, custom Google font, local font, or system font
- npm, pnpm, yarn, or bun
- Local Git initialization and optional GitHub remote
- ui-boundary-helper development annotations, preconfigured
- Route scaffolding for `page.tsx`, `layout.tsx`, `template.tsx`, and `error.tsx`, with a navigation animation and editable navbar links
- `reset:starter` command to remove untouched demo pages and example endpoints while keeping selected configuration

Dependencies resolve to the latest non-prerelease, non-deprecated stable npm releases at generation time and are pinned exactly. TypeScript and ESLint are constrained by the selected Next.js lint toolchain’s peer ranges; the newest compatible stable release is selected and recorded in the generated README. Installation generates a lockfile. New upstream major releases can require template updates; review and test your selected stack before deploying.

## Supported database/auth combinations

| Database | Auth |
|---|---|
| None | None or Clerk |
| Supabase | None, Supabase Auth, or Clerk |
| Neon | None, Better Auth, or Clerk |

Database-only configurations include connection modules but use browser-local records in the example. Private cloud-backed CRUD requires both a database and auth. Persisted AI conversations require AI, a database and auth.

## Organized output

```text
src/
  app/
    layout.tsx                 # document and global providers
    (marketing)/               # landing page and setup
    (app)/                     # authenticated workspace and chat
    (auth)/                    # sign-in, sign-up, recovery
    api/                       # independently authorized endpoints
  config/navigation.ts         # navbar links and active-route behavior
  auth/                        # auth configuration and session helpers
  database/                    # connections, schema, data access, migrations
  ai/                          # model and example tool definitions
  email/                       # sender helper and React Email templates
  components/ui/               # editable official shadcn components
  hooks/
  fonts/
```

Unused capability folders retain a `.gitkeep` so the structure survives Git. Selected providers generate their actual setup code. Each project includes a selection-specific `.env.example` with credential names, documentation links and public/server-only labels, plus a matching setup screen and README. Real credentials are never collected by this generator.

## Route scaffolding

In a generated project, run `npm run route -- reports --group app` to create a route with working `page.tsx`, `layout.tsx`, `template.tsx`, and `error.tsx` files. The group can be `marketing`, `app`, `auth`, or `root`. During `npm run dev`, creating an empty route file anywhere under `src/app` fills its boilerplate automatically; creating an empty `page.tsx` also fills missing sibling route files. Existing nonempty files are left alone. New pages and nested layouts use React function components that stay on the server by default; `error.tsx` is a client component as Next.js requires.

Group templates animate route changes, including navigation among nested pages, while keeping the shared navbar in its layout. Edit `src/config/navigation.ts` to add or rename navbar links. Motion is disabled when the visitor prefers reduced motion.

To start with only your configuration, run `npm run reset:starter` inside a newly generated project. The command replaces the demo landing page with a small home page, removes example screens and API routes, and keeps the selected auth, database, AI, email, theme, font, and route-scaffolding setup. It preserves files you have edited and routes you created. Required auth screens and callbacks stay; an auth-enabled `/dashboard` redirect remains for existing sign-in settings. The original setup guide is saved as `README.vorpal-starter.md`.

## Package management

Inside a generated project:

```sh
npm run packages
# or, once published:
npx create-nextjs-vorpalv2@latest packages
npx create-nextjs-vorpalv2@latest list packages
```

Select any dependency to upgrade to latest stable, choose an older stable version, or remove it. The screen shows installed versions (falling back to manifest versions before installation). Changes use the selected package manager and update its lockfile. Removal warns about source references; it does not rewrite application code automatically.

## Automation

```sh
node dist/cli.js my-app --config stack.json --no-install --no-git
node dist/cli.js my-app --yes --dry-run
```

Example configuration:

```json
{
  "name": "my-app",
  "kind": "ai",
  "database": "supabase",
  "auth": "supabase",
  "query": true,
  "email": "resend",
  "ai": "gateway",
  "persistence": true,
  "theme": "system",
  "font": "geist",
  "style": "nova",
  "baseColor": "neutral",
  "accent": "violet",
  "radius": "medium",
  "packageManager": "npm",
  "git": true,
  "install": true
}
```

`--no-install` skips dependency installation and preset application. The generated project is usable after installing dependencies; run `npm run setup:ui` to apply the chosen official shadcn style/preset. Custom Google font names must be supported by `next/font/google`. Local font paths are copied into the generated project.

## Development

```sh
npm run check
npm pack --dry-run
```

The generator refuses populated destinations, validates incompatible combinations, avoids shell interpolation for user input, and never creates or pushes a remote repository. Service provisioning, credentials and database migrations remain explicit steps documented in the generated README. Live service tests require real credentials.

The generated AI example validates requests and bounds tool steps and output. Add shared usage quotas or platform rate limiting for a public paid endpoint.

## License

MIT. The bundled shadcn button is sourced through the official shadcn CLI and retains its MIT licensing.
