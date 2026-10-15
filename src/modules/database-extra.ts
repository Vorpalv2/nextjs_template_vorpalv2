import {selectedOrm,type Config,type Files} from '../config.js';

export function sqliteDatabase(c:Config):Files {
 const f:Files={
  'src/database/schema.ts':`import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{id:text('id').primaryKey().$defaultFn(()=>crypto.randomUUID()),owner_id:text('owner_id').notNull(),title:text('title').notNull(),done:integer('done',{mode:'boolean'}).notNull().default(false),created_at:integer('created_at',{mode:'timestamp_ms'}).notNull().$defaultFn(()=>new Date())});
${c.persistence?`export const conversations=sqliteTable('conversations',{id:text('id').primaryKey(),owner_id:text('owner_id').notNull(),title:text('title').notNull(),messages:text('messages',{mode:'json'}).$type<import('ai').UIMessage[]>().notNull(),created_at:integer('created_at',{mode:'timestamp_ms'}).notNull().$defaultFn(()=>new Date())});`:''}
`,
  'src/database/server.ts':`import 'server-only';
import {createClient} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import {required} from '@/lib/env';
import * as schema from './schema';
let client:ReturnType<typeof createClient>|undefined;
export function database(){client??=createClient({url:required('DATABASE_URL')});return drizzle(client,{schema});}
`,
  'drizzle.config.ts':`import {config} from 'dotenv';
import {defineConfig} from 'drizzle-kit';
config({path:'.env.local'});
export default defineConfig({schema:'./src/database/schema.ts',out:'./src/database/migrations',dialect:'sqlite',dbCredentials:{url:process.env.DATABASE_URL!}});
`,
  'src/database/migrations/.gitkeep':'',
  'src/database/records.ts':`import 'server-only';
import {and,eq,desc} from 'drizzle-orm';
import {database} from './server';
import {records} from './schema';
const owned=(owner:string,id:string)=>and(eq(records.owner_id,owner),eq(records.id,id));
export async function listRecords(owner:string){return database().select().from(records).where(eq(records.owner_id,owner)).orderBy(desc(records.created_at));}
export async function addRecord(owner:string,title:string){return(await database().insert(records).values({owner_id:owner,title}).returning())[0];}
export async function updateRecord(owner:string,id:string,patch:{title?:string;done?:boolean}){return(await database().update(records).set(patch).where(owned(owner,id)).returning())[0];}
export async function deleteRecord(owner:string,id:string){await database().delete(records).where(owned(owner,id));}
`,
 };
 if(c.persistence)f['src/database/conversations.ts']=`import 'server-only';
import type {UIMessage} from 'ai';
import {and,eq,desc} from 'drizzle-orm';
import {database} from './server';
import {conversations} from './schema';
export async function listConversations(owner:string){return database().select({id:conversations.id,title:conversations.title}).from(conversations).where(eq(conversations.owner_id,owner)).orderBy(desc(conversations.created_at));}
export async function getConversation(owner:string,id:string){return(await database().select().from(conversations).where(and(eq(conversations.id,id),eq(conversations.owner_id,owner))))[0]??null;}
export async function saveConversation(owner:string,id:string,title:string,messages:UIMessage[]){const db=database();const existing=await getConversation(owner,id);if(existing)await db.update(conversations).set({messages}).where(and(eq(conversations.id,id),eq(conversations.owner_id,owner)));else await db.insert(conversations).values({id,owner_id:owner,title,messages});}
`;
 return f;
}

export function mongoDatabase(c:Config):Files {
 const f:Files={
  'src/database/server.ts':`import 'server-only';
import {MongoClient} from 'mongodb';
import {required} from '@/lib/env';
let client:MongoClient|undefined;
export function database(){client??=new MongoClient(required('DATABASE_URL'));return client.db();}
`,
  'src/database/records.ts':`import 'server-only';
import {database} from './server';
type RecordDocument={_id:string;owner_id:string;title:string;done:boolean;created_at:Date};
const collection=()=>database().collection<RecordDocument>('records');
const result=(row:RecordDocument)=>({id:row._id,owner_id:row.owner_id,title:row.title,done:row.done,created_at:row.created_at});
export async function listRecords(owner:string){return(await collection().find({owner_id:owner}).sort({created_at:-1}).toArray()).map(result);}
export async function addRecord(owner:string,title:string){const row:RecordDocument={_id:crypto.randomUUID(),owner_id:owner,title,done:false,created_at:new Date()};await collection().insertOne(row);return result(row);}
export async function updateRecord(owner:string,id:string,patch:{title?:string;done?:boolean}){const row=await collection().findOneAndUpdate({_id:id,owner_id:owner},{$set:patch},{returnDocument:'after'});return row?result(row):null;}
export async function deleteRecord(owner:string,id:string){await collection().deleteOne({_id:id,owner_id:owner});}
`,
 };
 if(c.persistence)f['src/database/conversations.ts']=`import 'server-only';
import type {UIMessage} from 'ai';
import {database} from './server';
type Conversation={_id:string;owner_id:string;title:string;messages:UIMessage[];created_at:Date};
const collection=()=>database().collection<Conversation>('conversations');
export async function listConversations(owner:string){return collection().find({owner_id:owner},{projection:{_id:1,title:1}}).sort({created_at:-1}).map(row=>({id:row._id,title:row.title})).toArray();}
export async function getConversation(owner:string,id:string){const row=await collection().findOne({_id:id,owner_id:owner});return row?{id:row._id,title:row.title,messages:row.messages}:null;}
export async function saveConversation(owner:string,id:string,title:string,messages:UIMessage[]){await collection().updateOne({_id:id,owner_id:owner},{$set:{messages},$setOnInsert:{title,created_at:new Date()}},{upsert:true});}
`;
 return f;
}

export function prismaDatabase(c:Config):Files {
 const mongo=c.database==='mongodb';
 const provider=mongo?'mongodb':c.database==='sqlite'?'sqlite':'postgresql';
 const prismaImport=mongo?'@prisma/client':'@/generated/prisma/client';
 const schema=`generator client {\n  provider = "${mongo?'prisma-client-js':'prisma-client'}"${mongo?'':'\n  output = "../src/generated/prisma"'}\n}\n\ndatasource db {\n  provider = "${provider}"${mongo?'\n  url = env("DATABASE_URL")':''}\n}\n\nmodel Record {\n  id String @id @default(uuid())${mongo?' @map("_id")':''}\n  owner_id String\n  title String\n  done Boolean @default(false)\n  created_at DateTime @default(now())\n  @@index([owner_id])\n}\n${c.persistence?'\nmodel Conversation {\n  id String @id @default(uuid())'+(mongo?' @map("_id")':'')+'\n  owner_id String\n  title String\n  messages Json\n  created_at DateTime @default(now())\n  @@index([owner_id])\n}\n':''}`;
 const adapter=c.database==='sqlite'?`import {PrismaBetterSqlite3} from '@prisma/adapter-better-sqlite3';\nconst adapter=()=>new PrismaBetterSqlite3({url:required('DATABASE_URL')});`:c.database==='neon'?`import {PrismaPg} from '@prisma/adapter-pg';\nconst adapter=()=>new PrismaPg({connectionString:required('DATABASE_URL')});`:'';
 const f:Files={
  'prisma/schema.prisma':schema,
  ...(mongo?{}:{'prisma.config.ts':`import {config} from 'dotenv';\nimport {defineConfig} from 'prisma/config';\nconfig({path:'.env.local'});\nexport default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations'},datasource:{url:process.env.DATABASE_URL}});\n`}),
  'src/database/server.ts':`import 'server-only';
import {PrismaClient} from '${prismaImport}';
${mongo?"import {required} from '@/lib/env';":`import {required} from '@/lib/env';\n${adapter}`}
const globalForPrisma=globalThis as unknown as {vorpalPrisma?:PrismaClient};
export function database(){${mongo?"required('DATABASE_URL');":''}return globalForPrisma.vorpalPrisma??=new PrismaClient(${mongo?'':`{adapter:adapter()}`});}
`,
  'src/database/records.ts':`import 'server-only';
import {database} from './server';
export async function listRecords(owner:string){return database().record.findMany({where:{owner_id:owner},orderBy:{created_at:'desc'}});}
export async function addRecord(owner:string,title:string){return database().record.create({data:{owner_id:owner,title}});}
export async function updateRecord(owner:string,id:string,patch:{title?:string;done?:boolean}){await database().record.updateMany({where:{id,owner_id:owner},data:patch});return database().record.findFirst({where:{id,owner_id:owner}});}
export async function deleteRecord(owner:string,id:string){await database().record.deleteMany({where:{id,owner_id:owner}});}
`,
 };
 if(c.persistence)f['src/database/conversations.ts']=`import 'server-only';
import type {UIMessage} from 'ai';
import {database} from './server';
export async function listConversations(owner:string){return database().conversation.findMany({where:{owner_id:owner},select:{id:true,title:true},orderBy:{created_at:'desc'}});}
export async function getConversation(owner:string,id:string){const row=await database().conversation.findFirst({where:{id,owner_id:owner}});return row?{...row,messages:row.messages as UIMessage[]}:null;}
export async function saveConversation(owner:string,id:string,title:string,messages:UIMessage[]){const db=database();const existing=await db.conversation.findFirst({where:{id,owner_id:owner}});const data=JSON.parse(JSON.stringify(messages));if(existing)await db.conversation.updateMany({where:{id,owner_id:owner},data:{messages:data}});else await db.conversation.create({data:{id,owner_id:owner,title,messages:data}});}
`;
 return f;
}

export function alternativeDatabase(c:Config):Files|null {
 if(selectedOrm(c)==='prisma')return prismaDatabase(c);
 if(c.database==='sqlite')return sqliteDatabase(c);
 if(c.database==='mongodb')return mongoDatabase(c);
 return null;
}
