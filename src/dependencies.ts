import {selectedOrm,type Config} from './config.js';
export function dependencies(c:Config){
 const prod=['next','react','react-dom','zod','clsx','tailwind-merge','server-only'];
 const dev=['typescript','@types/node','@types/react','@types/react-dom','tailwindcss','@tailwindcss/postcss','eslint','eslint-config-next','prettier','@playwright/test','ui-boundary-helper'];
 if(c.ui==='shadcn'||c.ui==='both')prod.push('class-variance-authority','radix-ui','lucide-react');
 if(c.ui==='aceternity'||c.ui==='both')prod.push('motion');
 if(c.theme==='system')prod.push('next-themes');
 if(c.query)prod.push('@tanstack/react-query');
 if(c.database==='supabase'){prod.push('@supabase/supabase-js');if(c.auth==='supabase')prod.push('@supabase/ssr');}
 const orm=selectedOrm(c);
 if(c.database==='neon'||c.database==='sqlite'){
  if(orm==='drizzle'){prod.push('drizzle-orm',c.database==='neon'?'@neondatabase/serverless':'@libsql/client');dev.push('drizzle-kit','dotenv');}
  if(orm==='prisma'){prod.push('@prisma/client',c.database==='neon'?'@prisma/adapter-pg':'@prisma/adapter-better-sqlite3');dev.push('prisma','dotenv');}
 }
 if(c.database==='mongodb'){if(orm==='prisma'){prod.push('@prisma/client');dev.push('prisma');}else prod.push('mongodb');}
 if(c.auth==='clerk')prod.push('@clerk/nextjs');
 if(c.auth==='better-auth'){
  prod.push('better-auth');
  if(c.database==='neon')prod.push('pg');
  if(c.database==='sqlite')prod.push('better-sqlite3');
  if(c.database==='mongodb')prod.push('mongodb','@better-auth/mongo-adapter');
 }
 if(prod.includes('pg'))dev.push('@types/pg');
 if(prod.includes('better-sqlite3'))dev.push('@types/better-sqlite3');
 if(c.email==='resend')prod.push('resend','react-email','@react-email/render');
 if(c.ai!=='none'){prod.push('ai','@ai-sdk/react');if(c.ai!=='gateway')prod.push('@ai-sdk/'+c.ai);}
 return {prod:[...new Set(prod)],dev:[...new Set(dev)]};
}
