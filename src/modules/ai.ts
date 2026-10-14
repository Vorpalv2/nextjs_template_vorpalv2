import type {Config,Files} from '../config.js';
export function artificialIntelligence(c:Config):Files{
 if(c.ai==='none')return{'src/ai/.gitkeep':''};
 const provider={gateway:{key:'AI_GATEWAY_API_KEY',import:"import {gateway} from 'ai';",call:'gateway'},openai:{key:'OPENAI_API_KEY',import:"import {openai} from '@ai-sdk/openai';",call:'openai'},anthropic:{key:'ANTHROPIC_API_KEY',import:"import {anthropic} from '@ai-sdk/anthropic';",call:'anthropic'},google:{key:'GOOGLE_GENERATIVE_AI_API_KEY',import:"import {google} from '@ai-sdk/google';",call:'google'}}[c.ai];
 const f:Files={
 'src/ai/model.ts':`import 'server-only';\n${provider.import}\nimport {required} from '@/lib/env';\nexport function getModel(){required('${provider.key}');return ${provider.call}(required('AI_MODEL'));}\n`,
 'src/ai/tools.ts':`import {tool} from 'ai';
import {z} from 'zod';
export const tools={calculate:tool({description:'Perform arithmetic on two numbers. Use this for calculations.',inputSchema:z.object({operation:z.enum(['add','subtract','multiply','divide']),a:z.number(),b:z.number()}),execute:async({operation,a,b})=>{if(operation==='divide'&&b===0)return{error:'Cannot divide by zero.'};const result=operation==='add'?a+b:operation==='subtract'?a-b:operation==='multiply'?a*b:a/b;return{result};}})};
`,
 'src/app/api/chat/route.ts':`import {streamText,convertToModelMessages,createUIMessageStreamResponse,toUIMessageStream,isStepCount,validateUIMessages} from 'ai';
import {z} from 'zod';
import {getModel} from '@/ai/model';
import {tools} from '@/ai/tools';
import {checkOrigin,readBody,failure,HttpError} from '@/lib/http';
${c.auth!=='none' ? "import {requireUser} from '@/auth/server';" : ''}
${c.persistence ? "import {getConversation,saveConversation} from '@/database/conversations';" : ''}
export const maxDuration=60;
export async function POST(request:Request){try{
 checkOrigin(request);${c.auth!=='none'?'const user=await requireUser();':''}
 const body=await readBody(request);const parsed=z.object({messages:z.array(z.unknown()).min(1).max(100),conversationId:z.uuid().optional()}).safeParse(body);if(!parsed.success)throw new HttpError(400,'Invalid chat request.');
 let messages;try{messages=await validateUIMessages({messages:parsed.data.messages,tools});}catch{throw new HttpError(400,'Invalid messages.');}
 if(messages.some(m=>m.role==='system'))throw new HttpError(400,'System messages are not accepted.');
 ${c.persistence?`const id=parsed.data.conversationId??crypto.randomUUID();const existing=await getConversation(user.id,id);
 // Never accept a different user's conversation: RLS/owner checks cover both reads and writes.
 const title=messages.find(m=>m.role==='user')?.parts.filter(p=>p.type==='text').map(p=>p.text).join('').slice(0,120)||'New conversation';
 await saveConversation(user.id,id,existing?.title??title,messages);`:''}
 const result=streamText({model:getModel(),system:'You are a concise, helpful assistant. Use the calculate tool for arithmetic.',messages:await convertToModelMessages(messages),tools,stopWhen:isStepCount(5),maxOutputTokens:2048,abortSignal:request.signal});
 return createUIMessageStreamResponse({stream:toUIMessageStream({stream:result.stream,originalMessages:messages,${c.persistence ? `onEnd:async({messages:complete,isAborted})=>{if(!isAborted)await saveConversation(user.id,id,title,complete);},` : ''}onError:()=> 'The assistant could not complete this response. Check your model and provider configuration.'})});
 }catch(e){return failure(e);}}
`,
 'src/components/chat.tsx':`'use client';
import {useState,useMemo${c.persistence&&!c.query?',useEffect':''}} from 'react';
import {useChat} from '@ai-sdk/react';
import {DefaultChatTransport,type UIMessage} from 'ai';
${c.persistence&&c.query ? "import {useQuery,useQueryClient} from '@tanstack/react-query';" : ''}
${c.persistence ? `type Conversation={id:string;title:string};
async function load<T>(path:string):Promise<T>{const r=await fetch(path);const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}`:''}
function ChatSession({id,initialMessages=[],onSaved}:{id:string;initialMessages?:UIMessage[];onSaved?:()=>void}){
 const[input,setInput]=useState('');const transport=useMemo(()=>new DefaultChatTransport({api:'/api/chat',body:{conversationId:id}}),[id]);
 const{messages,sendMessage,status,error,stop}=useChat({id,messages:initialMessages,transport,onFinish:()=>onSaved?.()});const busy=status==='submitted'||status==='streaming';
 async function submit(e:React.FormEvent){e.preventDefault();const text=input.trim();if(!text||busy)return;setInput('');await sendMessage({text});}
 return <div><div className="messages" aria-live="polite">{messages.length===0?<div className="empty"><h2>What are you thinking about?</h2><p>Explore an idea, ask a question, or try “What is 128 × 24?”</p></div>:messages.map(message=><div className="message" data-role={message.role} key={message.id}><strong>{message.role==='user'?'You':'Assistant'}</strong>{message.parts.map((part,i)=>part.type==='text'?<span key={i}>{part.text}</span>:part.type.startsWith('tool-')?<p className="tool-result" key={i}>Tool: {part.type.slice(5)} · {'state' in part?String(part.state):'running'}</p>:null)}</div>)}</div>{error&&<p className="error-message" role="alert">{error.message}</p>}{status==='submitted'&&<p role="status">Thinking…</p>}<form className="composer" onSubmit={submit}><label className="sr-only" htmlFor="message">Your message</label><textarea className="input" id="message" value={input} maxLength={8000} onChange={e=>setInput(e.target.value)} placeholder="Ask something…" required/>{busy?<button type="button" className="subtle-button" onClick={()=>stop()}>Stop</button>:<button className="primary-button" disabled={!input.trim()}>Send</button>}</form></div>;
}
export function Chat(){
 const[id${c.persistence?',setId':''}]=useState(()=>crypto.randomUUID());
 ${c.persistence ? `const[initial,setInitial]=useState<UIMessage[]>([]);const[error,setError]=useState('');const[opening,setOpening]=useState(false);
 ${c.query ? `const client=useQueryClient();const query=useQuery({queryKey:['conversations'],queryFn:()=>load<Conversation[]>('/api/conversations')});const conversations=query.data??[];
 const refresh=()=>{void client.invalidateQueries({queryKey:['conversations']});};` : `const[conversations,setConversations]=useState<Conversation[]>([]);
 const refresh=()=>{load<Conversation[]>('/api/conversations').then(setConversations).catch(e=>setError(e.message));};useEffect(()=>{let active=true;load<Conversation[]>('/api/conversations').then(data=>{if(active)setConversations(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);`}
 async function open(id:string){setOpening(true);setError('');try{const data=await load<{messages:UIMessage[]}>('/api/conversations?id='+id);setInitial(data.messages);setId(id);}catch(e){setError(e instanceof Error?e.message:'Could not load conversation.');}finally{setOpening(false);}}
 return <div className="chat-layout"><aside className="chat-sidebar"><button className="subtle-button" disabled={opening} onClick={()=>{setInitial([]);setId(crypto.randomUUID());}}>New conversation</button>{conversations.map(item=><button className="conversation" disabled={opening} key={item.id} onClick={()=>open(item.id)}>{item.title}</button>)}</aside><div>{(error${c.query?'||query.error?.message':''})&&<p role="alert" className="error-message">{error${c.query?'||query.error?.message':''}}</p>}{opening?<p role="status">Opening conversation…</p>:<ChatSession key={id} id={id} initialMessages={initial} onSaved={refresh}/>}</div></div>;` : 'return <ChatSession id={id} key={id}/>;'}
}
`,
 'src/app/(app)/chat/page.tsx':`import {Chat} from '@/components/chat';\nexport default function Page(){return <div className="page"><p className="section-label">A LITTLE HELP, WHEN YOU NEED IT</p><h1>Room to think.</h1><Chat/></div>;}\n`,
 };
 if(c.persistence)f['src/app/api/conversations/route.ts']=`import {z} from 'zod';
import {requireUser} from '@/auth/server';
import {listConversations,getConversation} from '@/database/conversations';
import {failure,HttpError} from '@/lib/http';
export async function GET(request:Request){try{const user=await requireUser();const id=new URL(request.url).searchParams.get('id');if(id&&!z.uuid().safeParse(id).success)throw new HttpError(400,'Invalid conversation ID.');const data=id?await getConversation(user.id,id):await listConversations(user.id);if(id&&!data)throw new HttpError(404,'Conversation not found.');return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
`;
 return f;
}
