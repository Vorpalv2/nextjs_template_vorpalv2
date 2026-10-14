import type {Config,Files} from '../config.js';

const routeScript=String.raw`import {writeFile,readdir,mkdir,open} from 'node:fs/promises';
import {resolve,relative,join,basename,isAbsolute,sep} from 'node:path';

const appDir=resolve(process.cwd(),'src/app');
const defaultGroup='__DEFAULT_GROUP__';
const names=['page.tsx','layout.tsx','template.tsx','error.tsx'];

function routeTitle(directory){const part=basename(directory).replace(/[\[\]()@]/g,'').replace(/[-_]/g,' ');return part?part.replace(/\b\w/g,character=>character.toUpperCase()):'New page';}
function boilerplate(file){const title=routeTitle(resolve(file,'..'));const name=basename(file);
 if(name==='page.tsx')return "export default function Page(){return <section className=\"page\"><h1>"+title+"</h1><p>Make this page your own.</p></section>;}\n";
 if(name==='layout.tsx')return resolve(file)===join(appDir,'layout.tsx')
  ?"export default function RootLayout({children}:{children:React.ReactNode}){return <html lang=\"en\"><body>{children}</body></html>;}\n"
  :"export default function Layout({children}:{children:React.ReactNode}){return <>{children}</>;}\n";
 if(name==='template.tsx')return "import {RouteTransition} from '@/components/route-transition';\nexport default function Template({children}:{children:React.ReactNode}){return <RouteTransition>{children}</RouteTransition>;}\n";
 if(name==='error.tsx')return "'use client';\nexport default function Error({reset}:{error:Error & {digest?:string};reset:()=>void}){return <div className=\"page\" role=\"alert\"><h1>Something went wrong.</h1><p>Try this page again.</p><button className=\"primary-button\" onClick={reset}>Try again</button></div>;}\n";
 throw new Error('Unsupported route file: '+name);
}
function insideApp(file){const rel=relative(appDir,resolve(file));return rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);}
export async function scaffoldFile(file){if(!insideApp(file)||!names.includes(basename(file)))return false;
 const handle=await open(file,'r+');try{const stat=await handle.stat();if(stat.size!==0)return false;await handle.writeFile(boilerplate(file));return true;}finally{await handle.close();}}
async function createMissing(file){try{await writeFile(file,boilerplate(file),{flag:'wx'});return true;}catch(error){if(error.code!=='EEXIST')throw error;return false;}}
async function fillPageSiblings(directory){for(const name of ['layout.tsx','template.tsx','error.tsx'])await createMissing(join(directory,name));}
async function scanDirectory(directory){for(const entry of await readdir(directory,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const file=join(directory,entry.name);if(entry.isDirectory())await scanDirectory(file);else if(entry.isFile()&&names.includes(entry.name)){const filled=await scaffoldFile(file);if(filled&&entry.name==='page.tsx')await fillPageSiblings(directory);}}}
export async function scanRoutes(){await scanDirectory(appDir);}
function routeDirectory(route,group){if(!route||isAbsolute(route)||route.includes('\\'))throw new Error('Use a relative route name.');const parts=route.split('/');if(parts.some(part=>!part||part==='.'||part==='..'||!/^[a-zA-Z0-9_@()[\]-]+$/.test(part)))throw new Error('Invalid route name.');
 const segment=group==='root'?'':group==='marketing'||group==='app'||group==='auth'?'('+group+')':null;if(segment===null)throw new Error('Group must be marketing, app, auth, or root.');const target=resolve(appDir,segment,...parts);if(!insideApp(target))throw new Error('Route must stay inside src/app.');return target;}
export async function createRoute(route,group=defaultGroup){const directory=routeDirectory(route,group);await mkdir(directory,{recursive:true});const created=[];for(const name of names){const file=join(directory,name);if(await createMissing(file))created.push(relative(appDir,file));else if(await scaffoldFile(file))created.push(relative(appDir,file));}return created;}
async function main(){const [command,route,...rest]=process.argv.slice(2);
 if(command==='create'){const groupIndex=rest.indexOf('--group');const group=groupIndex>=0?rest[groupIndex+1]:defaultGroup;const created=await createRoute(route,group);console.log(created.length?'Created:\n'+created.map(item=>'  src/app/'+item).join('\n'):'Route files already contain content. Nothing was overwritten.');return;}
 if(command==='watch'){let active=false;const scan=async()=>{if(active)return;active=true;try{await scanRoutes();}catch(error){console.error('[vorpal routes]',error);}finally{active=false;}};await scan();console.log('[vorpal routes] Watching blank page, layout, template and error files.');setInterval(scan,600);return;}
 throw new Error('Usage: node scripts/scaffold-routes.mjs create <route> [--group marketing|app|auth|root] | watch');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
`;

export function routeScaffolding(c:Config):Files{
 const defaultGroup=c.kind==='website'?'marketing':'app';
 return {
  'scripts/scaffold-routes.mjs':routeScript.replace('__DEFAULT_GROUP__',defaultGroup),
  'scripts/dev.mjs':`import {spawn} from 'node:child_process';
const watcher=spawn(process.execPath,['scripts/scaffold-routes.mjs','watch'],{stdio:'inherit'});
const next=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...process.argv.slice(2)],{stdio:'inherit'});
const stop=()=>{watcher.kill();next.kill();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
next.on('exit',(code,signal)=>{watcher.kill();process.exitCode=code??(signal?1:0);});
`,
 };
}
