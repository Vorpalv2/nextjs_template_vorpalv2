import type {Config,Files} from '../config.js';

// Only these generator-owned files may be removed by the generated reset command.
export const resetRemovals = [
  'src/app/(marketing)/setup/page.tsx',
  'src/app/(marketing)/effects/page.tsx',
  'src/app/(app)/dashboard/page.tsx',
  'src/app/(app)/chat/page.tsx',
  'src/app/(app)/email/page.tsx',
  'src/app/api/records/route.ts',
  'src/app/api/chat/route.ts',
  'src/app/api/conversations/route.ts',
  'src/app/api/email/route.ts',
  'src/app/api/health/route.ts',
  'src/components/records.tsx',
  'src/components/chat.tsx',
  'src/components/email-example.tsx',
  'src/components/query-status.tsx',
  'src/hooks/use-health.ts',
  'src/ai/tools.ts',
  'tests/navigation.spec.ts',
] as const;

export const resetReplacements = [
  'src/app/(marketing)/page.tsx',
  'src/config/navigation.ts',
  'src/app/(app)/layout.tsx',
  'README.md',
] as const;

export function starterReset(c:Config):Files {
  const home = `export default function Home(){return <main className="page"><h1>Welcome to ${c.name.replaceAll('<','&lt;').replaceAll('>','&gt;')}</h1><p>Start building in src/app/(marketing)/page.tsx.</p></main>;}\n`;
  const navigation = `// Add your routes here as you build.\nexport const navigation = [{label:'Home',href:'/'}] as const;\n`;
  const appLayout = c.auth==='none' ? null : `import {SiteShell} from '@/components/site-shell';\nimport {authConfigured,currentUser} from '@/auth/server';\nimport {redirect} from 'next/navigation';\nexport const dynamic='force-dynamic';\nexport default async function AppLayout({children}:{children:React.ReactNode}){if(!authConfigured())redirect('/');if(!await currentUser())redirect('/sign-in');return <SiteShell>{children}</SiteShell>;}\n`;
  const dashboardRedirect = c.auth==='none' ? null : `import {redirect} from 'next/navigation';\nexport default function Dashboard(){redirect('/');}\n`;
  const test = `import {test,expect} from '@playwright/test';\ntest('minimal home is available',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();});\n`;
  const replacements:Record<string,string>={
    'src/app/(marketing)/page.tsx':home,
    'src/config/navigation.ts':navigation,
    ...(appLayout?{'src/app/(app)/layout.tsx':appLayout}:{}),
    'tests/navigation.spec.ts':test,
    ...(dashboardRedirect?{'src/app/(app)/dashboard/page.tsx':dashboardRedirect}:{}),
  };
  const script=`import {createHash} from 'node:crypto';
import {readFile,writeFile,unlink,rmdir,readdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const manifest=JSON.parse(await readFile(path.join(root,'vorpal.starter-manifest.json'),'utf8'));
const config=JSON.parse(await readFile(path.join(root,'vorpal.config.json'),'utf8'));
const removals=${JSON.stringify(resetRemovals)};
const replacements=${JSON.stringify(replacements)};
const changed=[];
const skipped=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
async function original(name){
  const expected=manifest.files[name];
  if(!expected)return false;
  let actual;
  try{actual=await readFile(path.join(root,name),'utf8');}catch(error){if(error.code==='ENOENT')return false;throw error;}
  if(hash(actual)!==expected){skipped.push(name);return false;}
  return true;
}
async function prune(name){
  let dir=path.dirname(path.join(root,name));
  const stop=path.join(root,'src','app');
  while(dir.startsWith(stop+path.sep)){
    try{await rmdir(dir);}catch(error){if(error.code==='ENOTEMPTY'||error.code==='ENOENT')break;throw error;}
    dir=path.dirname(dir);
  }
}
async function sourceFiles(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const location=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await sourceFiles(location));
    else if(/\\.tsx?$/.test(entry.name))files.push(path.relative(root,location));
  }
  return files;
}
const candidates=new Set();
for(const name of removals)if(!replacements[name]&&await original(name))candidates.add(name);
const sources=await sourceFiles(path.join(root,'src'));
let preserved;
do{
  preserved=false;
  for(const name of sources){
    if(candidates.has(name))continue;
    const content=await readFile(path.join(root,name),'utf8');
    for(const match of content.matchAll(/['"]@\\/([^'"]+)['"]/g)){
      for(const extension of ['.ts','.tsx']){
        const imported='src/'+match[1]+extension;
        if(candidates.delete(imported)){skipped.push(imported+' (still imported)');preserved=true;}
      }
    }
  }
}while(preserved);
for(const name of removals){
  if(replacements[name]){if(!await original(name))continue;await writeFile(path.join(root,name),replacements[name]);}
  else{if(!candidates.has(name))continue;await unlink(path.join(root,name));await prune(name);}
  changed.push(name);
}
for(const [name,content] of Object.entries(replacements)){
  if(removals.includes(name)||!await original(name))continue;
  await writeFile(path.join(root,name),content);
  changed.push(name);
}
if(await original('README.md')){
  let backupExists=false;
  try{await readFile(path.join(root,'README.vorpal-starter.md'),'utf8');backupExists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(backupExists)skipped.push('README.md (setup guide backup already exists)');
  else{
    const originalReadme=await readFile(path.join(root,'README.md'),'utf8');
    await writeFile(path.join(root,'README.vorpal-starter.md'),originalReadme,{flag:'wx'});
    const selected=['database','auth','email','ai','query','theme','font'].map(key=>'- '+key+': '+config[key]).join('\\n');
    await writeFile(path.join(root,'README.md'),'# '+config.name+'\\n\\nA minimal Next.js project with your selected configuration.\\n\\n## Selected stack\\n\\n'+selected+'\\n\\n## Start\\n\\nCopy .env.example to .env.local, add the credentials for the services you selected, then run '+config.packageManager+' run dev. The home page is src/app/(marketing)/page.tsx. Create routes with '+config.packageManager+' run route -- my-page --group marketing.\\n\\nConfiguration remains under src/auth, src/database, src/ai, src/email, src/config, and the root setup files. Authentication screens and callbacks remain when selected. The original setup guide is in README.vorpal-starter.md.\\n');
    changed.push('README.md');
  }
}
console.log('Minimal starter ready. Updated or removed '+changed.length+' generated files.');
if(skipped.length)console.log('Kept customized files: '+skipped.join(', '));
`;
  return {'scripts/reset-starter.mjs':script};
}
