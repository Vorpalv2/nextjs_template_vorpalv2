import type { Config, Files } from '../config.js';
export function authentication(c:Config):Files {
 const f:Files={};
 if(c.auth==='none') { f['src/auth/.gitkeep']=''; f['src/auth/server.ts']=`import 'server-only';\nexport async function currentUser():Promise<{id:string;email?:string}|null>{return null;}\n`; return f; }
 const readiness = c.auth==='supabase' ? `process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : c.auth==='clerk' ? `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY` : `process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET`;
 f['src/auth/server.ts']=`import 'server-only';
import {HttpError} from '@/lib/http';
import {SetupError} from '@/lib/env';
${c.auth==='supabase' ? "import {database} from '@/database/server';" : c.auth==='clerk' ? "import {auth,currentUser as clerkUser} from '@clerk/nextjs/server';" : "import {getAuth} from './config';\nimport {headers} from 'next/headers';"}
export const authConfigured=()=>Boolean(${readiness});
export async function currentUser():Promise<{id:string;email?:string}|null>{
 if(!authConfigured())return null;
 ${c.auth==='supabase' ? "const db=await database();const{data,error}=await db.auth.getUser();if(error||!data.user)return null;return{id:data.user.id,email:data.user.email};" : c.auth==='clerk' ? "const{userId}=await auth();if(!userId)return null;const user=await clerkUser();return{id:userId,email:user?.primaryEmailAddress?.emailAddress};" : "const session=await getAuth().api.getSession({headers:await headers()});return session?{id:session.user.id,email:session.user.email}:null;"}
}
export async function requireUser(){if(!authConfigured())throw new SetupError('${c.auth==='supabase'?'NEXT_PUBLIC_SUPABASE_URL':c.auth==='clerk'?'CLERK_SECRET_KEY':'BETTER_AUTH_SECRET'}');const user=await currentUser();if(!user)throw new HttpError(401,'Please sign in to continue.');return user;}
`;
 if(c.auth==='clerk') {
 f['src/proxy.ts']=`import {clerkMiddleware} from '@clerk/nextjs/server';
import {NextResponse,type NextRequest,type NextFetchEvent} from 'next/server';
const middleware=clerkMiddleware();
export default function proxy(req:NextRequest,event:NextFetchEvent){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||!process.env.CLERK_SECRET_KEY)return NextResponse.next();return middleware(req,event);}
export const config={matcher:['/((?!_next|.*\\\\..*).*)','/api/(.*)']};
`;
 for(const [route,component] of [['sign-in','SignIn'],['sign-up','SignUp']])f[`src/app/(auth)/${route}/[[...${route}]]/page.tsx`]=`import {${component}} from '@clerk/nextjs';
import Link from 'next/link';
export default function Page(){if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||!process.env.CLERK_SECRET_KEY)return <div className="auth-page"><h1>Connect your account.</h1><p>Add your Clerk keys to .env.local to enable authentication.</p><Link href="/setup">Open setup →</Link></div>;return <div className="auth-page"><${component}/></div>;}
`;
 f['src/components/account-menu.tsx']=`'use client';
import {UserButton,useUser} from '@clerk/nextjs';
import Link from 'next/link';
function ConnectedAccount(){const{isSignedIn}=useUser();return isSignedIn?<UserButton/>:<Link href="/sign-in">Sign in</Link>;}
export function AccountMenu(){return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<ConnectedAccount/>:<Link href="/setup">Connect auth</Link>;}
`;
 } else {
 if(c.auth==='better-auth') {
 f['src/auth/config.ts']=`import 'server-only';
import {betterAuth} from 'better-auth';
import {nextCookies} from 'better-auth/next-js';
import {Pool} from 'pg';
import {required} from '@/lib/env';
${c.email==='resend' ? "import {sendEmail} from '@/email/send';\nimport {AccountEmail} from '@/email/templates/account';" : ''}
function createAuth(){return betterAuth({database:new Pool({connectionString:required('DATABASE_URL')}),secret:required('BETTER_AUTH_SECRET'),baseURL:required('BETTER_AUTH_URL'),emailAndPassword:{enabled:true,${c.email==='resend' ? "sendResetPassword:async({user,url})=>{await sendEmail({to:user.email,subject:'Reset your password',react:AccountEmail({title:'A fresh start.',url,label:'Reset password'})});}," : ''}},${c.email==='resend' ? "emailVerification:{sendVerificationEmail:async({user,url})=>{await sendEmail({to:user.email,subject:'Verify your email',react:AccountEmail({title:'Welcome aboard.',url,label:'Verify email'})});}}," : ''}rateLimit:{enabled:true,storage:'database'},plugins:[nextCookies()]});}
let instance:ReturnType<typeof createAuth>|undefined;
export function getAuth(){return instance??=createAuth();}
`;
 f['src/auth/client.ts']=`'use client';\nimport {createAuthClient} from 'better-auth/react';\nexport const authClient=createAuthClient();\n`;
 f['src/app/api/auth/[...all]/route.ts']=`import {toNextJsHandler} from 'better-auth/next-js';
import {getAuth} from '@/auth/config';
import {failure} from '@/lib/http';
export async function GET(request:Request){try{return toNextJsHandler(getAuth()).GET(request);}catch(e){return failure(e);}}
export async function POST(request:Request){try{return toNextJsHandler(getAuth()).POST(request);}catch(e){return failure(e);}}
`;
 // The auth CLI reads this module after .env.local is loaded by the migration script.
 f['src/auth/migrate.ts']=`import {config} from 'dotenv';
import {betterAuth} from 'better-auth';
import {Pool} from 'pg';
config({path:'.env.local'});
export const auth=betterAuth({database:new Pool({connectionString:process.env.DATABASE_URL}),secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BETTER_AUTH_URL,emailAndPassword:{enabled:true},rateLimit:{enabled:true,storage:'database'}});
`;
 } else {
 f['src/proxy.ts']=`import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return response;
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await db.auth.getClaims();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/dashboard/:path*','/chat/:path*','/api/:path*','/auth/:path*','/reset-password']};
`;
 f['src/app/(auth)/auth/callback/route.ts']=`import {NextResponse} from 'next/server';
import {database} from '@/database/server';
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');if(code){const db=await database();const{error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(url.searchParams.get('next')==='/reset-password'?'/reset-password':'/dashboard',url.origin));}return NextResponse.redirect(new URL('/sign-in?error=callback',url.origin));}
`;
 }
 f['src/components/auth-form.tsx']=`'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
${c.auth==='supabase' ? "import {database} from '@/database/browser';" : "import {authClient} from '@/auth/client';"}
type Mode='sign-in'|'sign-up'|'forgot-password'|'reset-password';
export function AuthForm({mode}:{mode:Mode}){
 const router=useRouter();
 const[error,setError]=useState('');const[notice,setNotice]=useState('');const[busy,setBusy]=useState(false);
 const titles={'sign-in':'Welcome back.','sign-up':'Make yourself at home.','forgot-password':'A fresh start.','reset-password':'Choose a new password.'};
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setNotice('');const form=new FormData(e.currentTarget);const email=String(form.get('email')||'');const password=String(form.get('password')||'');
 try{
 ${c.auth==='supabase' ? `const db=database();
 const result=mode==='sign-in'?await db.auth.signInWithPassword({email,password}):mode==='sign-up'?await db.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/auth/callback'}}):mode==='forgot-password'?await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/auth/callback?next=/reset-password'}):await db.auth.updateUser({password});
 if(result.error)throw result.error;
 if(mode==='forgot-password'||mode==='sign-up'){setNotice('Check your inbox for the next step. If email confirmation is disabled, you can sign in now.');}else{router.push('/dashboard');router.refresh();}` : `const result=mode==='sign-in'?await authClient.signIn.email({email,password}):mode==='sign-up'?await authClient.signUp.email({email,password,name:String(form.get('name')||email)}):mode==='forgot-password'?await authClient.requestPasswordReset({email,redirectTo:window.location.origin+'/reset-password'}):await authClient.resetPassword({newPassword:password,token:new URLSearchParams(window.location.search).get('token')||''});
 if(result.error)throw new Error(result.error.message||'Authentication failed.');
 if(mode==='forgot-password')setNotice('If that account exists, a reset link is on its way.');else {router.push('/dashboard');router.refresh();}`}
 }catch(e){setError(e instanceof Error?e.message:'Authentication failed.');}finally{setBusy(false);}}
 return <div className="auth-page"><h1>{titles[mode]}</h1><p>Your ideas have a place here.</p><form className="stack" onSubmit={submit}>{mode==='sign-up'&&<label className="label">Name<input className="input" name="name" autoComplete="name" required/></label>}{mode!=='reset-password'&&<label className="label">Email<input className="input" name="email" type="email" autoComplete="email" required/></label>}{mode!=='forgot-password'&&<label className="label">Password<input className="input" name="password" type="password" minLength={8} autoComplete={mode==='sign-in'?'current-password':'new-password'} required/></label>}{error&&<p role="alert" className="error-message">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}<button className="primary-button" disabled={busy}>{busy?'Please wait…':mode==='sign-in'?'Sign in':mode==='sign-up'?'Create account':mode==='forgot-password'?'Send reset link':'Update password'}</button><div className="auth-links"><Link href={mode==='sign-in'?'/sign-up':'/sign-in'}>{mode==='sign-in'?'Create an account':'Back to sign in'}</Link>${c.auth==='supabase'||c.email==='resend' ? `<Link href="/forgot-password">Forgot password?</Link>` : ''}</div></form></div>;
}
`;
 for(const mode of ['sign-in','sign-up',...(c.auth==='supabase'||c.email==='resend'?['forgot-password','reset-password']:[])])f[`src/app/(auth)/${mode}/page.tsx`]=`import {AuthForm} from '@/components/auth-form';\nexport default function Page(){return <AuthForm mode="${mode as 'sign-in'}"/>;}\n`;
 f['src/components/account-menu.tsx']=`'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
${c.auth==='supabase' ? "import {database} from '@/database/browser';" : "import {authClient} from '@/auth/client';"}
export function AccountMenu(){const[signedIn,setSignedIn]=useState(false);const router=useRouter();
 useEffect(()=>{${c.auth==='supabase' ? "if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return;const db=database();db.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));const{data}=db.auth.onAuthStateChange((_event,session)=>setSignedIn(Boolean(session)));return()=>data.subscription.unsubscribe();" : "authClient.getSession().then(({data})=>setSignedIn(Boolean(data?.user)));"}},[]);
 async function signOut(){${c.auth==='supabase'?'await database().auth.signOut();':'await authClient.signOut();'}router.push('/');router.refresh();}
 return signedIn?<button className="subtle-button" onClick={signOut}>Sign out</button>:<Link href="/sign-in">Sign in</Link>;
}
`;
 }
 return f;
}
