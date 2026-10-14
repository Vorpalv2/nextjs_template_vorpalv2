import { type Config, type Files } from '../config.js';
export function database(c: Config): Files {
 const f:Files = {};
 if(c.database === 'none') { f['src/database/.gitkeep']=''; return f; }
 if(c.database === 'supabase') {
 f['src/database/server.ts'] = c.auth === 'supabase' ? `import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {required} from '@/lib/env';
export async function database() {
 const jar=await cookies();
 return createServerClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),{cookies:{getAll:()=>jar.getAll(),setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Server Components cannot set cookies; proxy refreshes them. */}}}});
}
` : `import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {required} from '@/lib/env';
${c.auth === 'clerk' ? "import {auth} from '@clerk/nextjs/server';" : ''}
export async function database(){return createClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),{${c.auth === 'clerk' ? 'accessToken:async()=>(await auth()).getToken(),' : ''}auth:{persistSession:false,autoRefreshToken:false}});}
`;
 if(c.auth === 'supabase') f['src/database/browser.ts'] = `'use client';
import {createBrowserClient} from '@supabase/ssr';
export function database(){return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);}
`;
 f['supabase/migrations/0001_workspace.sql'] = `-- Apply in Supabase SQL Editor, or through your Supabase migration workflow.
create table public.records (id uuid primary key default gen_random_uuid(), owner_id text not null, title text not null check(char_length(title) between 1 and 200), done boolean not null default false, created_at timestamptz not null default now());
create index records_owner_idx on public.records(owner_id);
alter table public.records enable row level security;
grant select,insert,update,delete on public.records to authenticated;
create policy "Own records" on public.records for all to authenticated using ((select auth.jwt()->>'sub')=owner_id) with check ((select auth.jwt()->>'sub')=owner_id);
${c.persistence ? `create table public.conversations(id uuid primary key default gen_random_uuid(),owner_id text not null,title text not null check(char_length(title)<=200),messages jsonb not null default '[]'::jsonb,created_at timestamptz not null default now());
create index conversations_owner_idx on public.conversations(owner_id);
alter table public.conversations enable row level security;
grant select,insert,update,delete on public.conversations to authenticated;
create policy "Own conversations" on public.conversations for all to authenticated using ((select auth.jwt()->>'sub')=owner_id) with check ((select auth.jwt()->>'sub')=owner_id);` : ''}
`;
 f['src/database/records.ts'] = `import 'server-only';
import {database} from './server';
export async function listRecords(owner:string){const db=await database();const {data,error}=await db.from('records').select('*').eq('owner_id',owner).order('created_at',{ascending:false});if(error)throw error;return data;}
export async function addRecord(owner:string,title:string){const db=await database();const {data,error}=await db.from('records').insert({owner_id:owner,title}).select().single();if(error)throw error;return data;}
export async function updateRecord(owner:string,id:string,patch:{title?:string;done?:boolean}){const db=await database();const {data,error}=await db.from('records').update(patch).eq('owner_id',owner).eq('id',id).select().single();if(error)throw error;return data;}
export async function deleteRecord(owner:string,id:string){const db=await database();const {error}=await db.from('records').delete().eq('owner_id',owner).eq('id',id);if(error)throw error;}
`;
 if(c.persistence) f['src/database/conversations.ts'] = `import 'server-only';
import type {UIMessage} from 'ai';
import {database} from './server';
export async function listConversations(owner:string){const db=await database();const{data,error}=await db.from('conversations').select('id,title').eq('owner_id',owner).order('created_at',{ascending:false});if(error)throw error;return data;}
export async function getConversation(owner:string,id:string){const db=await database();const{data,error}=await db.from('conversations').select('*').eq('id',id).eq('owner_id',owner).maybeSingle();if(error)throw error;return data;}
export async function saveConversation(owner:string,id:string,title:string,messages:UIMessage[]){const db=await database();const existing=await getConversation(owner,id);if(existing){const{error}=await db.from('conversations').update({messages}).eq('id',id).eq('owner_id',owner);if(error)throw error;}else{const{error}=await db.from('conversations').insert({id,owner_id:owner,title,messages});if(error)throw error;}}
`;
 } else {
 f['src/database/schema.ts'] = `import {pgTable,uuid,text,boolean,timestamp,jsonb} from 'drizzle-orm/pg-core';
export const records=pgTable('records',{id:uuid('id').defaultRandom().primaryKey(),owner_id:text('owner_id').notNull(),title:text('title').notNull(),done:boolean('done').default(false).notNull(),created_at:timestamp('created_at').defaultNow().notNull()});
${c.persistence ? "export const conversations=pgTable('conversations',{id:uuid('id').defaultRandom().primaryKey(),owner_id:text('owner_id').notNull(),title:text('title').notNull(),messages:jsonb('messages').notNull().default([]),created_at:timestamp('created_at').defaultNow().notNull()});" : ''}
`;
 f['src/database/server.ts'] = `import 'server-only';
import {neon} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-http';
import {required} from '@/lib/env';
import * as schema from './schema';
export function database(){return drizzle(neon(required('DATABASE_URL')),{schema});}
`;
 f['drizzle.config.ts'] = `import {config} from 'dotenv';
import {defineConfig} from 'drizzle-kit';
config({path:'.env.local'});
export default defineConfig({schema:'./src/database/schema.ts',out:'./src/database/migrations',dialect:'postgresql',dbCredentials:{url:process.env.DATABASE_URL!}});
`;
 f['src/database/migrations/.gitkeep']='';
 f['src/database/records.ts'] = `import 'server-only';
import {and,eq,desc} from 'drizzle-orm';
import {database} from './server';
import {records} from './schema';
const owned=(owner:string,id:string)=>and(eq(records.owner_id,owner),eq(records.id,id));
export async function listRecords(owner:string){return database().select().from(records).where(eq(records.owner_id,owner)).orderBy(desc(records.created_at));}
export async function addRecord(owner:string,title:string){return(await database().insert(records).values({owner_id:owner,title}).returning())[0];}
export async function updateRecord(owner:string,id:string,patch:{title?:string;done?:boolean}){return(await database().update(records).set(patch).where(owned(owner,id)).returning())[0];}
export async function deleteRecord(owner:string,id:string){await database().delete(records).where(owned(owner,id));}
`;
 if(c.persistence) f['src/database/conversations.ts'] = `import 'server-only';
import type {UIMessage} from 'ai';
import {and,eq,desc} from 'drizzle-orm';
import {database} from './server';
import {conversations} from './schema';
export async function listConversations(owner:string){return database().select({id:conversations.id,title:conversations.title}).from(conversations).where(eq(conversations.owner_id,owner)).orderBy(desc(conversations.created_at));}
export async function getConversation(owner:string,id:string){return(await database().select().from(conversations).where(and(eq(conversations.id,id),eq(conversations.owner_id,owner))))[0]??null;}
export async function saveConversation(owner:string,id:string,title:string,messages:UIMessage[]){await database().insert(conversations).values({id,owner_id:owner,title,messages}).onConflictDoUpdate({target:conversations.id,set:{messages},setWhere:eq(conversations.owner_id,owner)});}
`;
 }
 return f;
}
