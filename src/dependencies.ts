import type {Config} from './config.js';
export function dependencies(c:Config){
 const prod=['next','react','react-dom','zod','clsx','tailwind-merge','class-variance-authority','radix-ui','lucide-react','server-only'];
 const dev=['typescript','@types/node','@types/react','@types/react-dom','tailwindcss','@tailwindcss/postcss','eslint','eslint-config-next','prettier','@playwright/test','ui-boundary-helper'];
 if(c.theme==='system')prod.push('next-themes');
 if(c.query)prod.push('@tanstack/react-query');
 if(c.database==='supabase'){prod.push('@supabase/supabase-js');if(c.auth==='supabase')prod.push('@supabase/ssr');}
 if(c.database==='neon'){prod.push('@neondatabase/serverless','drizzle-orm');dev.push('drizzle-kit','dotenv');}
 if(c.auth==='clerk')prod.push('@clerk/nextjs');
 if(c.auth==='better-auth'){prod.push('better-auth','pg');dev.push('@types/pg');}
 if(c.email==='resend')prod.push('resend','react-email','@react-email/render');
 if(c.ai!=='none'){prod.push('ai','@ai-sdk/react');if(c.ai!=='gateway')prod.push('@ai-sdk/'+c.ai);}
 return {prod,dev};
}
