import {format} from 'prettier';
import {mkdir,writeFile,readFile,readdir,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {configSchema,selectedOrm,type Config,type Files,json} from './config.js';
import {core} from './modules/core.js';
import {styles} from './modules/styles.js';
import {database} from './modules/database.js';
import {authentication} from './modules/auth.js';
import {workspace} from './modules/workspace.js';
import {email} from './modules/email.js';
import {artificialIntelligence} from './modules/ai.js';
import {documentation} from './modules/documentation.js';
import {organize} from './modules/layouts.js';
import {buttonSource,plainButtonSource} from './modules/button.js';
import {routeScaffolding} from './modules/route-scaffolding.js';
import {starterReset,resetRemovals,resetReplacements} from './modules/reset-starter.js';
import {dependencies} from './dependencies.js';
import {resolveVersions,metadata,stableVersions} from './packages.js';
import {run} from './process.js';
export function renderProject(input:unknown,versions:Record<string,string>):Files {
 const c=configSchema.parse(input);const deps=dependencies(c);
 for(const name of [...deps.prod,...deps.dev])if(!versions[name])throw new Error('Missing resolved version for '+name);
 const orm=selectedOrm(c);
 const manifest={name:c.name,version:'0.1.0',private:true,scripts:{dev:'node scripts/dev.mjs',route:'node scripts/scaffold-routes.mjs create','reset:starter':'node scripts/reset-starter.mjs',build:'next build',start:'next start',lint:'eslint .',format:'prettier --write .',typecheck:'tsc --noEmit','test:e2e':'playwright test',...(c.ui!=='none'?{'setup:ui':'node scripts/setup-ui.mjs'}:{}),packages:'npx create-nextjs-vorpalv2@latest packages',...(orm==='drizzle'?{'db:generate':'drizzle-kit generate','db:migrate':'drizzle-kit migrate'}:{}),...(orm==='prisma'?{'db:generate':'prisma generate','db:migrate':c.database==='mongodb'?'prisma db push':'prisma migrate dev','postinstall':'prisma generate'}:{}),...(c.auth==='better-auth'&&c.database!=='mongodb'?{'auth:migrate':'npx auth@latest migrate --config src/auth/migrate.ts'}:{})},dependencies:Object.fromEntries(deps.prod.map(n=>[n,versions[n]])),devDependencies:Object.fromEntries(deps.dev.map(n=>[n,versions[n]]))};
 let f:Files={...core(c),...database(c),...authentication(c),...workspace(c),...email(c),...artificialIntelligence(c),...documentation(c),...routeScaffolding(c),...starterReset(c),'src/app/globals.css':styles(c),'src/components/ui/button.tsx':c.ui==='shadcn'||c.ui==='both'?buttonSource:plainButtonSource,'package.json':json(manifest),'vorpal.config.json':json({schemaVersion:1,...c,fontPath:c.font==='local'?'src/fonts/brand'+path.extname(c.fontPath!):undefined,install:undefined,github:undefined,git:undefined})};
 if(c.ui==='aceternity'||c.ui==='both')f['src/app/(marketing)/effects/page.tsx']=`import {LayoutTextFlip} from '@/components/ui/layout-text-flip';\nexport default function Effects(){return <div className="page"><h1>Build something that feels alive.</h1><div className="row"><LayoutTextFlip text="Create" words={['websites','web apps','new ideas']}/></div></div>;}\n`;
 f=organize(c,f);
 f['README.md']+='\n## Toolchain compatibility\n\nTypeScript: `'+versions.typescript+'`. ESLint: `'+versions.eslint+'`. These are the latest stable releases satisfying the selected Next.js lint toolchain peer ranges. Other direct dependencies use their latest stable releases at generation time.\n';
 f['README.md']+='\n## Routes and navigation\n\nRun `'+c.packageManager+' run route -- reports'+(c.kind==='website'?' --group marketing':' --group app')+'` to create a route with `page.tsx`, `layout.tsx`, `template.tsx`, and `error.tsx`. Use `--group marketing`, `app`, `auth`, or `root` to choose its location. Running `'+c.packageManager+' run dev` also watches `src/app`: when you create an empty route file, it fills that file with boilerplate; an empty new `page.tsx` also gets its missing sibling layout, template, and error files. Existing nonempty files are never overwritten.\n\nNew pages and nested layouts use React function components and remain server components by default. `error.tsx` is a client component as required by Next.js. The route templates animate page changes and honor reduced-motion preferences. Edit `src/config/navigation.ts` to add your navbar links; the header highlights the current route.\n';
 f['README.md']+='\n## Minimal starter\n\nRun `'+c.packageManager+' run reset:starter` to remove the generated demo screens and example API routes. It keeps your selected integration configuration, required authentication routes, theme, font, and route scaffolding. Customized files and routes you created are left alone. The original setup guide is saved as `README.vorpal-starter.md`.\n';
 if(c.ui!=='none')f['scripts/setup-ui.mjs']=`// Applies the selected component registry setup; safe to rerun before customizing UI files.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);};
const runner=${JSON.stringify(c.packageManager==='npm'?['npx',['--yes','shadcn@latest']]:c.packageManager==='pnpm'?['pnpm',['dlx','shadcn@latest']]:c.packageManager==='yarn'?['yarn',['dlx','shadcn@latest']]:['bunx',['--bun','shadcn@latest']])};
const shadcn=args=>run(runner[0],[...runner[1],...args]);
const originalLayout=readFileSync('src/app/layout.tsx','utf8');
const originalCss=readFileSync('src/app/globals.css','utf8');
shadcn(['init','--preset',${JSON.stringify(c.preset??c.style)},'--base','radix','--force','--no-reinstall','--yes']);
// Keep the user's explicit next/font choice and root provider structure.
writeFileSync('src/app/layout.tsx',originalLayout);
${!c.preset ? `const css=readFileSync('src/app/globals.css','utf8');
const config=JSON.parse(readFileSync('components.json','utf8'));config.tailwind.baseColor=${JSON.stringify(c.baseColor)};writeFileSync('components.json',JSON.stringify(config,null,2)+'\\n');
const theme=originalCss.slice(originalCss.indexOf(':root'),originalCss.indexOf('@theme inline'));
writeFileSync('src/app/globals.css',css+'\\n/* Selected Vorpal appearance */\\n'+theme);` : ''}
${c.ui==='aceternity'||c.ui==='both'?`const registry=JSON.parse(readFileSync('components.json','utf8'));registry.registries??={};registry.registries['@aceternity']='https://ui.aceternity.com/registry/{name}.json';writeFileSync('components.json',JSON.stringify(registry,null,2)+'\\n');
if(!existsSync('src/components/ui/layout-text-flip.tsx'))shadcn(['add','@aceternity/layout-text-flip','--yes']);
const flip=readFileSync('src/components/ui/layout-text-flip.tsx','utf8').replace('}, []);','}, [duration, words.length]);');writeFileSync('src/components/ui/layout-text-flip.tsx',flip);`:''}
// shadcn may add dependencies using version ranges: pin them to installed versions.
const manifest=JSON.parse(readFileSync('package.json','utf8'));
// The component generator is a development tool; its transitive dependencies do not belong in the production graph.
if(manifest.dependencies?.shadcn){manifest.devDependencies??={};manifest.devDependencies.shadcn=manifest.dependencies.shadcn;delete manifest.dependencies.shadcn;}
for(const section of ['dependencies','devDependencies'])for(const name of Object.keys(manifest[section]??{})){try{const pkg=JSON.parse(readFileSync('node_modules/'+name+'/package.json','utf8'));manifest[section][name]=pkg.version;}catch{}}
writeFileSync('package.json',JSON.stringify(manifest,null,2)+'\\n');
run(${JSON.stringify(c.packageManager)},['install']);
`;
 return f;
}
export async function generateProject(input:unknown,target:string,{resolve=resolveVersions,execute=run}:{resolve?:(names:string[])=>Promise<Record<string,string>>;execute?:typeof run}={}){
 const c=configSchema.parse(input);target=path.resolve(target);
 let exists=false;try{const entries=await readdir(target);exists=true;if(entries.length)throw new Error('Destination is not empty. Choose a new folder; existing files are never overwritten.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(c.font==='local')await access(path.resolve(c.fontPath!));
 const deps=dependencies(c);const versions=await resolve([...deps.prod,...deps.dev]);
 if(selectedOrm(c)==='prisma'&&resolve===resolveVersions){
  const [prismaInfo,clientInfo]=await Promise.all([metadata('prisma'),metadata('@prisma/client')]);
  const major=c.database==='mongodb'?'6':'7';
  const compatible=stableVersions(prismaInfo).find(version=>version.startsWith(major+'.')&&Boolean(clientInfo.versions[version]));
  if(!compatible)throw new Error('No compatible Prisma '+major+'.x release is available for '+c.database+'.');
  versions.prisma=compatible;versions['@prisma/client']=compatible;
  const adapter=c.database==='neon'?'@prisma/adapter-pg':c.database==='sqlite'?'@prisma/adapter-better-sqlite3':undefined;
  if(adapter){const info=await metadata(adapter);if(info.versions[compatible])versions[adapter]=compatible;else{const match=stableVersions(info).find(version=>version.startsWith(major+'.'));if(!match)throw new Error('No compatible '+adapter+' release is available.');versions[adapter]=match;}}
 }
 const files=renderProject(c,versions);
 for(const [name,content] of Object.entries(files)){if(/\.(tsx?|mjs|json|css|md)$/.test(name))files[name]=await format(content,{filepath:name,singleQuote:true});}
 files['vorpal.starter-manifest.json']=json({schemaVersion:1,files:Object.fromEntries([...resetRemovals,...resetReplacements].filter(name=>files[name]!==undefined).map(name=>[name,createHash('sha256').update(files[name]).digest('hex')]))});
 // Reject races with another process creating files in the destination.
 if(exists&&(await readdir(target)).length)throw new Error('Destination changed during setup. Nothing was written.');
 await mkdir(target,{recursive:true});
 for(const[name,content]of Object.entries(files)){const location=path.join(target,name);await mkdir(path.dirname(location),{recursive:true});await writeFile(location,content,{flag:'wx'});}
 if(c.font==='local')await copyFile(path.resolve(c.fontPath!),path.join(target,'src/fonts/brand'+path.extname(c.fontPath!)));
 if(c.install){await execute(c.packageManager,['install'],target);if(c.ui!=='none')await execute(c.packageManager,['run','setup:ui'],target);}
 if(c.git){await execute('git',['init','-b','main'],target);if(c.github)await execute('git',['remote','add','origin',c.github],target);}
 return {target,files:Object.keys(files),config:c};
}
