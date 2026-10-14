import * as p from '@clack/prompts';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import {run} from './process.js';

type Metadata={name:string;'dist-tags':Record<string,string>;versions:Record<string,{version:string;deprecated?:string;dependencies?:Record<string,string>;peerDependencies?:Record<string,string>}>};
const cache=new Map<string,Promise<Metadata>>();
export function metadata(name:string):Promise<Metadata>{
 if(!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name))throw new Error('Invalid package name: '+name);
 let promise=cache.get(name);if(!promise){promise=(async()=>{const response=await fetch('https://registry.npmjs.org/'+encodeURIComponent(name),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error('Cannot read '+name+' from npm ('+response.status+').');return await response.json() as Metadata;})();cache.set(name,promise);}return promise;
}
export function stableVersions(info:Metadata,includeDeprecated=false){return Object.keys(info.versions).filter(v=>semver.valid(v)&&!semver.prerelease(v)&&(includeDeprecated||!info.versions[v].deprecated)).sort(semver.rcompare);}
export async function latestStable(name:string){const info=await metadata(name);const tagged=info['dist-tags'].latest;if(tagged&&semver.valid(tagged)&&!semver.prerelease(tagged)&&!info.versions[tagged]?.deprecated)return tagged;const latest=stableVersions(info)[0];if(!latest)throw new Error('No stable release found for '+name);return latest;}
async function toolchainRanges(configVersion:string){
 const constraints:Record<string,string[]>={eslint:[],typescript:[]};const seen=new Set<string>();
 async function inspect(name:string,version:string,depth:number):Promise<void>{
  if(seen.has(name+'@'+version))return;seen.add(name+'@'+version);
  const info=await metadata(name);const release=info.versions[version];if(!release)throw new Error('Missing npm metadata for '+name+'@'+version);
  for(const target of ['eslint','typescript'])if(release.peerDependencies?.[target])constraints[target].push(release.peerDependencies[target]);
  if(depth>0)await Promise.all(Object.entries(release.dependencies??{}).filter(([n])=>/eslint/.test(n)).map(async([n,range])=>{const pkg=await metadata(n);const match=stableVersions(pkg).find(v=>semver.satisfies(v,range));if(match)await inspect(n,match,depth-1);}));
 }
 await inspect('eslint-config-next',configVersion,2);return constraints;
}
async function compatibleToolchainVersions(target:'eslint'|'typescript',configVersion:string){const info=await metadata(target);const ranges=(await toolchainRanges(configVersion))[target];return stableVersions(info,true).filter(v=>ranges.every(range=>semver.satisfies(v,range)));}
export async function resolveVersions(names:string[]){
 const entries=await Promise.all(names.map(async name=>[name,await latestStable(name)] as const));const versions=Object.fromEntries(entries);
 if(versions['eslint-config-next']){
  for(const target of ['eslint','typescript'] as const)if(versions[target]){const match=(await compatibleToolchainVersions(target,versions['eslint-config-next']))[0];if(!match)throw new Error('No stable '+target+' version satisfies the Next.js lint toolchain.');versions[target]=match;}
 }
 return versions;
}
function answer<T>(v:T):Exclude<T,symbol>{if(p.isCancel(v)){p.cancel('No further changes.');process.exit(0);}return v as Exclude<T,symbol>;}
async function references(root:string,name:string){const found:string[]=[];async function visit(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.next','.git','dist'].includes(entry.name)||entry.isSymbolicLink())continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(tsx?|[cm]?jsx?)$/.test(file)){const source=await readFile(file,'utf8');if(source.includes(`'${name}`)||source.includes(`"${name}`))found.push(path.relative(root,file));}}}await visit(root);return found;}
export async function managePackages(root:string){
 const readManifest=async()=>JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 const first=await readManifest();if(!first.dependencies&&!first.devDependencies)throw new Error('No dependencies found in this project.');
 p.intro('VORPAL / Packages');
 while(true){
 const manifest=await readManifest();const all={...manifest.dependencies,...manifest.devDependencies} as Record<string,string>;
 const configVersion=semver.valid(all['eslint-config-next']??'')??semver.minVersion(all['eslint-config-next']??'')?.version;
 const rows=await Promise.all(Object.entries(all).map(async([name,declared])=>{let installed:string|undefined;try{installed=JSON.parse(await readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;}catch{/* Dependency may not be installed yet. */}let latest:string|undefined;try{latest=configVersion&&(name==='eslint'||name==='typescript')?(await compatibleToolchainVersions(name,configVersion))[0]:await latestStable(name);}catch{/* Show unavailable; don't hide the rest of the list. */}return{name,current:installed??declared,latest};}));
 p.note(rows.map(r=>`${r.name.padEnd(32)} | ${r.current.padEnd(12)} | ${r.latest??'unavailable'}`).join('\n'),'Package                          | Current      | Latest stable');
 const name=answer(await p.select({message:'Choose a package',options:[...rows.map(r=>({value:r.name,label:r.name,hint:`${r.current} → ${r.latest??'unavailable'}`})),{value:'__exit',label:'Done'}]}));if(name==='__exit'){p.outro('Package review complete.');return;}
 const row=rows.find(r=>r.name===name)!;
 const action=answer(await p.select({message:name,options:[{value:'latest',label:'Upgrade to latest stable',hint:row.latest},{value:'older',label:'Downgrade to a stable release'},{value:'remove',label:'Remove package'},{value:'back',label:'Back'}]}));if(action==='back')continue;
 let version=row.latest;
 if(action==='older'){
 const info=await metadata(name);const current=semver.valid(row.current)??semver.minVersion(row.current)?.version;
 const compatible=configVersion&&(name==='eslint'||name==='typescript')?new Set(await compatibleToolchainVersions(name,configVersion)):null;
 const versions=stableVersions(info,true).filter(v=>current&&semver.lt(v,current)&&(!compatible||compatible.has(v)));if(!versions.length){p.log.warn('No older compatible stable versions are available.');continue;}
 version=answer(await p.select({message:'Choose an older stable version',options:versions.map(value=>({value,label:value,hint:info.versions[value].deprecated?'Deprecated by publisher':undefined}))}));
 }
 const pm=manifest.packageManager?.split('@')[0]??(await readFile(path.join(root,'vorpal.config.json'),'utf8').then(s=>JSON.parse(s).packageManager).catch(()=> 'npm'));
 if(!['npm','pnpm','yarn','bun'].includes(pm))throw new Error('Unsupported package manager.');
 if(action==='remove'){
 const used=await references(root,name);if(used.length)p.log.warn('Still imported by:\n'+used.join('\n')+'\nRemoving it requires updating this code before the app can build.');
 if(!answer(await p.confirm({message:'Remove '+name+'?',initialValue:false})))continue;
 await run(pm,[pm==='npm'?'uninstall':'remove',name],root);
 }else{
 if(!version){p.log.warn('Registry metadata unavailable. Try again later.');continue;}
 const release=(await metadata(name)).versions[version];if(release?.deprecated)p.log.warn('Publisher notice: '+release.deprecated);
 if(!answer(await p.confirm({message:`Set ${name} to ${version}?`,initialValue:true})))continue;
 const dev=Boolean(manifest.devDependencies?.[name]);
 await run(pm,[pm==='npm'?'install':'add',`${name}@${version}`,pm==='npm'?'--save-exact':'--exact',...(dev?[pm==='npm'?'--save-dev':'--dev']:[])],root);
 }
 p.log.success('Updated package.json and the lockfile. Run typecheck, lint and build to verify compatibility.');
 }
}
