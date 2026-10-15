#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import {ask} from './prompts.js';
import {configSchema,json} from './config.js';
import {generateProject} from './generate.js';
import {managePackages} from './packages.js';
const help=`create-nextjs-vorpalv2 [directory] [options]

  --config <file>  Generate from a JSON configuration
  --yes           Use defaults (no questions)
  --no-install    Skip package installation and preset setup
  --no-git        Skip Git initialization
  --dry-run       Print validated selections without creating files
  --help          Show this help
  --version       Show generator version

Package manager:
  create-nextjs-vorpalv2 packages [directory]
  create-nextjs-vorpalv2 list packages [directory]

Examples:
  npx create-nextjs-vorpalv2@latest my-app
  npx create-nextjs-vorpalv2@latest my-app --yes
  npx create-nextjs-vorpalv2@latest my-app --config stack.json
`;
async function main(){
 const{values,positionals}=parseArgs({allowPositionals:true,options:{config:{type:'string'},yes:{type:'boolean'},'no-install':{type:'boolean'},'no-git':{type:'boolean'},'dry-run':{type:'boolean'},help:{type:'boolean'},version:{type:'boolean'}}});
 if(values.help){console.log(help);return;}if(values.version){console.log('0.2.0');return;}
 if(positionals[0]==='packages'||(positionals[0]==='list'&&positionals[1]==='packages')){await managePackages(path.resolve(positionals[positionals[0]==='list'?2:1]??'.'));return;}
 if(!values.yes&&!values.config&&!process.stdin.isTTY)throw new Error('Interactive setup needs a terminal. Use --yes or --config for automation.');
 let input:unknown;
 if(values.config)input=JSON.parse(await readFile(path.resolve(values.config),'utf8'));
 else if(values.yes)input={name:path.basename(path.resolve(positionals[0]??'my-app'))};
 else input=await ask(positionals[0]?path.basename(path.resolve(positionals[0])):undefined);
 const config=configSchema.parse({...input as object,...(values['no-install']?{install:false}:{}),...(values['no-git']?{git:false}: {})});
 if(values['dry-run']){console.log(json(config));return;}
 p.log.info('Resolving latest stable dependencies and generating your project…');
 const result=await generateProject(config,path.resolve(positionals[0]??config.name));
 p.outro(`Created ${result.target}\n\n${config.install?'':'Run '+config.packageManager+' install'+(config.ui==='none'?'.':' and then '+config.packageManager+' run setup:ui.')+'\n'}Copy .env.example to .env.local and connect your selected services.\nRun ${config.packageManager} run dev to start.\n${config.github?'GitHub remote connected. Nothing was pushed.':''}`);
}
main().catch(error=>{p.log.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
