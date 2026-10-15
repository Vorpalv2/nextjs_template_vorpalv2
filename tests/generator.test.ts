import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {configSchema} from '../src/config.js';
import {renderProject,generateProject} from '../src/generate.js';
import {dependencies} from '../src/dependencies.js';
import {stableVersions} from '../src/packages.js';
import {format} from 'prettier';
import {setTimeout as delay} from 'node:timers/promises';
const versions=(names:string[])=>Object.fromEntries(names.map(n=>[n,'1.0.0']));
function render(input:unknown){const c=configSchema.parse(input);const deps=dependencies(c);return renderProject(c,versions([...deps.prod,...deps.dev]));}

test('rejects incompatible provider selections',()=>{
 for(const input of [{database:'neon',auth:'supabase'},{database:'supabase',auth:'better-auth'},{database:'mongodb',orm:'drizzle'},{database:'sqlite',orm:'native'},{database:'supabase',orm:'prisma'},{persistence:true},{ai:'gateway',database:'neon',persistence:true},{git:false,github:'https://github.com/user/repo'},{github:'https://token@github.com/user/repo'}])assert.throws(()=>configSchema.parse({name:'example',...input}));
});
test('database and UI choices include only compatible code and packages',()=>{
 for(const [database,orm,driver] of [['sqlite','drizzle','@libsql/client'],['sqlite','prisma','@prisma/adapter-better-sqlite3'],['mongodb','native','mongodb'],['mongodb','prisma','@prisma/client'],['neon','prisma','@prisma/adapter-pg']] as const){
  const f=render({name:'example',database,orm,auth:'better-auth',ui:'none'});const p=JSON.parse(f['package.json']);
  assert.ok(p.dependencies[driver],`${database}/${orm}: missing ${driver}`);
  assert.equal(p.scripts['setup:ui'],undefined);assert.equal(f['components.json'],undefined);
  assert.equal(p.dependencies['radix-ui'],undefined);assert.equal(p.dependencies['class-variance-authority'],undefined);
  assert.ok(f['src/database/server.ts']);assert.match(f['README.md'],new RegExp(`- ORM: ${orm}`));
 }
 const effects=render({name:'example',ui:'aceternity'});const p=JSON.parse(effects['package.json']);
 assert.ok(p.dependencies.motion);assert.equal(p.dependencies['radix-ui'],undefined);
 assert.match(effects['scripts/setup-ui.mjs'],/@aceternity\/layout-text-flip/);
 assert.match(effects['src/app/(marketing)/effects/page.tsx'],/LayoutTextFlip/);
});
test('only selected dependencies and env vars are included',()=>{
 const f=render({name:'example',database:'neon',auth:'better-auth',email:'resend',ai:'openai',query:true});const p=JSON.parse(f['package.json']);
 assert.ok(p.dependencies['@neondatabase/serverless']);assert.ok(p.dependencies['@ai-sdk/openai']);assert.ok(p.devDependencies['ui-boundary-helper']);assert.equal(p.dependencies['@supabase/supabase-js'],undefined);assert.equal(p.dependencies['@clerk/nextjs'],undefined);
 assert.match(f['.env.example'],/OPENAI_API_KEY=""/);assert.doesNotMatch(f['.env.example'],/CLERK_SECRET_KEY|SUPABASE_URL|AI_GATEWAY_API_KEY/);
});
test('route groups preserve the root document and private boundary',()=>{
 const f=render({name:'example',database:'supabase',auth:'supabase'});
 assert.ok(f['src/app/(marketing)/page.tsx']);assert.equal(f['src/app/page.tsx'],undefined);assert.match(f['src/app/layout.tsx'],/<html/);assert.doesNotMatch(f['src/app/(marketing)/layout.tsx'],/<html/);assert.match(f['src/app/(app)/layout.tsx'],/currentUser/);assert.ok(f['src/app/(auth)/sign-in/page.tsx']);
});
test('dual mode has persistent provider and toggle; fixed modes exclude them',()=>{
 const dual=render({name:'example',theme:'system'});assert.match(dual['src/components/providers.tsx'],/ThemeProvider/);assert.match(dual['src/components/theme-toggle.tsx'],/setTheme/);
 for(const mode of ['light','dark']){const f=render({name:'example',theme:mode});assert.equal(f['src/components/theme-toggle.tsx'],undefined);assert.equal(JSON.parse(f['package.json']).dependencies['next-themes'],undefined);assert.doesNotMatch(f['src/components/providers.tsx'],/ThemeProvider/);}
});
test('ownership checks are present for both database backends',()=>{
 for(const database of ['supabase','neon']){const f=render({name:'example',database,auth:'clerk',ai:'gateway',persistence:true});assert.match(f['src/app/api/records/route.ts'],/requireUser/);assert.match(f['src/app/api/chat/route.ts'],/requireUser/);assert.match(f['src/database/records.ts'],/owner/);assert.match(f['src/database/conversations.ts'],/owner/);if(database==='supabase'){assert.match(f['supabase/migrations/0001_workspace.sql'],/enable row level security/);assert.match(f['supabase/migrations/0001_workspace.sql'],/with check/);assert.match(f['src/database/server.ts'],/getToken/);}}
});
test('all supported selections produce parseable source and internal imports resolve',async()=>{
 const stacks=[['none','none'],['none','clerk'],['supabase','none'],['supabase','supabase'],['supabase','clerk'],['neon','none'],['neon','better-auth'],['neon','clerk'],['sqlite','none'],['sqlite','better-auth'],['sqlite','clerk'],['mongodb','none'],['mongodb','better-auth'],['mongodb','clerk']];
 for(const[database,auth]of stacks)for(const theme of ['light','dark','system']){
 const f=render({name:'example',database,auth,theme,query:true,ai:'gateway',email:'resend',persistence:database!=='none'&&auth!=='none',font:'system'});
 for(const[name,content]of Object.entries(f)){
 if(/\.(tsx?|mjs|json|css)$/.test(name))await format(content,{filepath:name});
 for(const match of content.matchAll(/from ['"](@\/[^'"]+)['"]/g)){const target='src/'+match[1].slice(2);assert.ok(['.ts','.tsx','/index.ts','/index.tsx'].some(ext=>f[target+ext]!==undefined),`${name} imports missing ${target}`);}
 }
 }
});
test('will not overwrite a populated destination',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'vorpal-test-'));await writeFile(path.join(root,'important.txt'),'keep');await assert.rejects(generateProject({name:'example',install:false,git:false},root,{resolve:async n=>versions(n)}),/not empty/);assert.equal(await readFile(path.join(root,'important.txt'),'utf8'),'keep');
});
test('no-install generation writes configuration without executing commands',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'vorpal-test-'));const target=path.join(root,'example');const result=await generateProject({name:'example',install:false,git:false,font:'system'},target,{resolve:async n=>versions(n),execute:async()=>{throw new Error('Unexpected execution');}});assert.ok(result.files.length>20);assert.ok((await readdir(target)).includes('.env.example'));assert.equal(JSON.parse(await readFile(path.join(target,'vorpal.config.json'),'utf8')).schemaVersion,1);
});
test('reset command removes only untouched demo files and keeps selected configuration',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'vorpal-reset-'));
 const target=path.join(root,'example');
 await generateProject({name:'example',font:'system',database:'neon',auth:'better-auth',ai:'openai',email:'resend',install:false,git:false},target,{resolve:async n=>versions(n)});
 const customRoute=path.join(target,'src/app/(marketing)/mine/page.tsx');
 await mkdir(path.dirname(customRoute),{recursive:true});
 await writeFile(customRoute,"import {Records} from '@/components/records';\nexport default function Mine(){return <Records/>;}\n");
 const customComponent=path.join(target,'src/components/chat.tsx');
 await writeFile(customComponent,'// customized chat\n');
 const output=execFileSync(process.execPath,['scripts/reset-starter.mjs'],{cwd:target,encoding:'utf8'});
 assert.match(output,/Kept customized files: src\/components\/chat.tsx/);
 assert.equal(await readFile(customRoute,'utf8'),"import {Records} from '@/components/records';\nexport default function Mine(){return <Records/>;}\n");
 assert.equal(await readFile(customComponent,'utf8'),'// customized chat\n');
 assert.ok((await readFile(path.join(target,'src/components/records.tsx'),'utf8')).includes('Records'));
 assert.match(await readFile(path.join(target,'src/app/(marketing)/page.tsx'),'utf8'),/Welcome to example/);
 assert.match(await readFile(path.join(target,'src/config/navigation.ts'),'utf8'),/Home/);
 assert.match(await readFile(path.join(target,'src/app/(app)/dashboard/page.tsx'),'utf8'),/redirect\('\/'\)/);
 assert.ok((await readFile(path.join(target,'src/app/api/auth/[...all]/route.ts'),'utf8')).includes('toNextJsHandler'));
 assert.ok((await readFile(path.join(target,'src/ai/model.ts'),'utf8')).includes('getModel'));
 await assert.rejects(readFile(path.join(target,'src/app/api/chat/route.ts'),'utf8'),{code:'ENOENT'});
 await assert.rejects(readFile(path.join(target,'src/app/(marketing)/setup/page.tsx'),'utf8'),{code:'ENOENT'});
 assert.match(await readFile(path.join(target,'README.vorpal-starter.md'),'utf8'),/Database setup/);
 execFileSync(process.execPath,['scripts/reset-starter.mjs'],{cwd:target});
});
test('stable downgrade choices exclude prereleases and deprecated versions',()=>{assert.deepEqual(stableVersions({name:'test','dist-tags':{latest:'2.0.0'},versions:{'1.0.0':{version:'1.0.0'},'2.0.0':{version:'2.0.0'},'3.0.0-beta.1':{version:'3.0.0-beta.1'},'1.5.0':{version:'1.5.0',deprecated:'unsafe'}}}),['2.0.0','1.0.0']);});

test('route command creates function boilerplate and preserves existing page content',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'vorpal-routes-'));const f=render({name:'example',font:'system'});const script=path.join(root,'scripts/scaffold-routes.mjs');await mkdir(path.dirname(script),{recursive:true});await writeFile(script,f['scripts/scaffold-routes.mjs']);
 execFileSync(process.execPath,[script,'create','reports','--group','app'],{cwd:root});const route=path.join(root,'src/app/(app)/reports');
 assert.match(await readFile(path.join(route,'page.tsx'),'utf8'),/export default function Page.*<h1>Reports<\/h1>/);
 assert.match(await readFile(path.join(route,'layout.tsx'),'utf8'),/export default function Layout/);
 assert.match(await readFile(path.join(route,'template.tsx'),'utf8'),/RouteTransition/);
 assert.match(await readFile(path.join(route,'error.tsx'),'utf8'),/reset/);
 await writeFile(path.join(route,'page.tsx'),'// my own page\n');execFileSync(process.execPath,[script,'create','reports','--group','app'],{cwd:root});assert.equal(await readFile(path.join(route,'page.tsx'),'utf8'),'// my own page\n');
});

test('dev watcher fills a new blank page and sibling route files',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'vorpal-watch-'));const f=render({name:'example',font:'system'});const script=path.join(root,'scripts/scaffold-routes.mjs');const route=path.join(root,'src/app/(marketing)/notes');await mkdir(path.dirname(script),{recursive:true});await writeFile(script,f['scripts/scaffold-routes.mjs']);await mkdir(route,{recursive:true});await writeFile(path.join(route,'page.tsx'),'');
 const watcher=spawn(process.execPath,[script,'watch'],{cwd:root,stdio:'ignore'});
 try{let content='';for(let i=0;i<20&&!content;i++){await delay(100);content=await readFile(path.join(route,'page.tsx'),'utf8');}assert.match(content,/export default function Page/);assert.ok((await readdir(route)).includes('template.tsx'));assert.ok((await readdir(route)).includes('error.tsx'));}
 finally{watcher.kill();}
});
