import type {Config,Files} from '../config.js';
export function organize(c:Config,f:Files){
 const root=f['src/app/layout.tsx'];
 const header=root.slice(root.indexOf('<header'),root.indexOf('<main>')).replace(/<nav aria-label="Main navigation">.*?<\/nav>/,'<NavLinks/>');
 const footer=root.slice(root.indexOf('<footer'),root.indexOf('</Providers>'));
 const shell=`import Link from 'next/link';\nimport {NavLinks} from '@/components/nav-links';\n${c.theme==='system'?"import {ThemeToggle} from '@/components/theme-toggle';":''}\n${c.auth!=='none'?"import {AccountMenu} from '@/components/account-menu';":''}\nexport function SiteShell({children}:{children:React.ReactNode}){return <>${header}<main>{children}</main>${footer}</>;}\n`;
 f['src/components/site-shell.tsx']=shell;
 f['src/config/navigation.ts']=`// Add, remove, or rename items here; the header highlights the active route.
export const navigation = [
 {label:'Workspace',href:'/dashboard'},
 ${c.ai!=='none'?"{label:'Assistant',href:'/chat'},":''}
 {label:'Setup',href:'/setup'},
] as const;
`;
 f['src/components/nav-links.tsx']=`'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {navigation} from '@/config/navigation';
export function NavLinks(){const pathname=usePathname();return <nav className="main-nav" aria-label="Main navigation">{navigation.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+'/');return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={active?'active':undefined}>{item.label}</Link>;})}</nav>;}
`;
 f['src/components/route-transition.tsx']=`'use client';
import {usePathname} from 'next/navigation';
export function RouteTransition({children}:{children:React.ReactNode}){const pathname=usePathname();return <div key={pathname} className="route-transition">{children}</div>;}
`;
 f['src/app/layout.tsx']=root.replace(/import Link from 'next\/link';\n/,'').replace(/import \{ ThemeToggle \} from '@\/components\/theme-toggle';\n/,'').replace(/import \{ AccountMenu \} from '@\/components\/account-menu';\n/,'').replace('import type { Metadata }',"import {BoundaryProvider} from 'ui-boundary-helper';\nimport type { Metadata }").replace(root.slice(root.indexOf('<header'),root.indexOf('</Providers>')),'<BoundaryProvider debug={process.env.NODE_ENV === \'development\'}>{children}</BoundaryProvider>');
 f['src/app/(marketing)/page.tsx']=f['src/app/page.tsx'];delete f['src/app/page.tsx'];
 f['src/app/(marketing)/layout.tsx']=`import {SiteShell} from '@/components/site-shell';\nexport default function MarketingLayout({children}:{children:React.ReactNode}){return <SiteShell>{children}</SiteShell>;}\n`;
 f['src/app/(app)/layout.tsx']=`import {SiteShell} from '@/components/site-shell';\n${c.auth!=='none'?"import {authConfigured,currentUser} from '@/auth/server';\nimport {redirect} from 'next/navigation';\nimport Link from 'next/link';\nexport const dynamic='force-dynamic';":''}\nexport default async function AppLayout({children}:{children:React.ReactNode}){${c.auth!=='none'?`if(!authConfigured())return <SiteShell><div className="page"><h1>Connect your workspace.</h1><p>Add your authentication credentials to start using private features.</p><Link className="primary-button" href="/setup">Open setup</Link></div></SiteShell>;if(!await currentUser())redirect('/sign-in');`:''}return <SiteShell>{children}</SiteShell>;}\n`;
 f['src/app/(auth)/layout.tsx']=`import {SiteShell} from '@/components/site-shell';\n${c.auth!=='none'?"export const dynamic='force-dynamic';\n":''}export default function AuthLayout({children}:{children:React.ReactNode}){return <SiteShell>{children}</SiteShell>;}\n`;
 for(const group of ['marketing','app','auth']){
  f[`src/app/(${group})/template.tsx`]=`import {RouteTransition} from '@/components/route-transition';
export default function Template({children}:{children:React.ReactNode}){return <RouteTransition>{children}</RouteTransition>;}
`;
  f[`src/app/(${group})/error.tsx`]=f['src/app/error.tsx'];
 }
 f['src/hooks/.gitkeep']='';f['src/fonts/.gitkeep']='';
 f['next.config.ts']=`import type {NextConfig} from 'next';\nimport {withBoundaryDebug} from 'ui-boundary-helper/next';\nconst config:NextConfig={};\nexport default withBoundaryDebug(config);\n`;
 if(c.auth==='clerk')f['src/components/providers.tsx']=f['src/components/providers.tsx'].replace('<ClerkProvider>','<OptionalClerk>').replace('</ClerkProvider>','</OptionalClerk>')+`\nfunction OptionalClerk({children}:{children:React.ReactNode}){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return <>{children}</>;return <ClerkProvider appearance={{variables:{colorBackground:'var(--card)',colorForeground:'var(--foreground)',colorPrimary:'var(--primary)',fontFamily:'var(--font-app,Arial,sans-serif)',borderRadius:'var(--radius)'}}}>{children}</ClerkProvider>;}\n`;
 return f;
}
