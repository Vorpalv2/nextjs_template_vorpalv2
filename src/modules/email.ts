import type {Config,Files} from '../config.js';
export function email(c:Config):Files{
 if(c.email==='none')return{'src/email/.gitkeep':''};
 const f:Files={
 'src/email/send.ts':`import 'server-only';
import {Resend} from 'resend';
import type {ReactElement} from 'react';
import {required} from '@/lib/env';
export async function sendEmail({to,subject,react}:{to:string;subject:string;react:ReactElement}){const resend=new Resend(required('RESEND_API_KEY'));const{data,error}=await resend.emails.send({from:required('EMAIL_FROM'),to,subject,react});if(error)throw new Error(error.message);return data;}
`,
 'src/email/templates/account.tsx':`import {Html,Head,Preview,Body,Container,Heading,Text,Button} from 'react-email';
export function AccountEmail({title,url,label}:{title:string;url:string;label:string}){return <Html><Head/><Preview>{title}</Preview><Body style={{backgroundColor:'#f6f6f6',fontFamily:'Arial,sans-serif',padding:'40px 0'}}><Container style={{backgroundColor:'#ffffff',padding:40,borderRadius:12}}><Heading>{title}</Heading><Text>Your next chapter starts with a small step.</Text><Button href={url} style={{backgroundColor:'#181818',color:'#ffffff',padding:'14px 22px',borderRadius:6}}>{label}</Button><Text>If you did not request this email, you can ignore it.</Text></Container></Body></Html>;}
`,
 };
 if(c.auth!=='none'){
 f['src/app/api/email/route.ts']=`import {requireUser} from '@/auth/server';
import {sendEmail} from '@/email/send';
import {AccountEmail} from '@/email/templates/account';
import {required} from '@/lib/env';
import {checkOrigin,failure,HttpError} from '@/lib/http';
export async function POST(request:Request){try{checkOrigin(request);const user=await requireUser();if(!user.email)throw new HttpError(400,'Your account needs an email address.');const result=await sendEmail({to:user.email,subject:'Welcome to ${c.name}',react:AccountEmail({title:'A good place to begin.',url:new URL('/dashboard',required('APP_URL')).href,label:'Open workspace'})});return Response.json({id:result?.id});}catch(e){return failure(e);}}
`;
 f['src/components/email-example.tsx']=`'use client';
import {useState} from 'react';
export function EmailExample(){const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');async function send(){setBusy(true);try{const response=await fetch('/api/email',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage('Welcome email sent. Check your inbox.');}catch(e){setMessage(e instanceof Error?e.message:'Could not send email.');}finally{setBusy(false);}}return <div className="stack"><button className="primary-button" disabled={busy} onClick={send}>{busy?'Sending…':'Send welcome email'}</button><p role="status">{message}</p></div>;}
`;
 }
 return f;
}
