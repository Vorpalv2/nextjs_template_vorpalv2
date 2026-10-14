import type {Config,Files} from '../config.js';
export function workspace(c:Config):Files{
 const remote=c.database!=='none'&&c.auth!=='none';
 const f:Files={};
 f['src/components/records.tsx']=`'use client';
import {useState${remote ? (c.query?'':',useEffect') : ',useSyncExternalStore,useMemo'}} from 'react';
import {Button} from '@/components/ui/button';
${remote&&c.query ? "import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';" : ''}
type RecordItem={id:string;title:string;done:boolean};
${!remote?`function subscribe(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener('vorpal-records-change',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('vorpal-records-change',callback);};}
function readSnapshot(){try{return localStorage.getItem('vorpal-records')||'[]';}catch{return '[]';}}
function parseRecords(snapshot:string|null):RecordItem[]{try{const parsed:unknown=JSON.parse(snapshot||'[]');return Array.isArray(parsed)?parsed.filter((v):v is RecordItem=>Boolean(v)&&typeof v.id==='string'&&typeof v.title==='string'&&typeof v.done==='boolean'):[];}catch{return [];}}`:''}
${remote ? `async function request(method='GET',body?:unknown):Promise<RecordItem[]>{const r=await fetch('/api/records',{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed.');return data;}`:''}
export function Records(){
 const[title,setTitle]=useState('');const[error,setError]=useState('');const[editingId,setEditingId]=useState<string|null>(null);const[editTitle,setEditTitle]=useState('');
 ${remote&&c.query ? `const client=useQueryClient();const query=useQuery({queryKey:['records'],queryFn:()=>request()});const items=query.data??[];const loading=query.isPending;
 const mutation=useMutation({mutationFn:({method,body}:{method:string;body:unknown})=>request(method,body),onSuccess:()=>client.invalidateQueries({queryKey:['records']})});const busy=mutation.isPending;
 async function change(method:string,body:unknown){setError('');try{await mutation.mutateAsync({method,body});return true;}catch(e){setError(e instanceof Error?e.message:'Could not save.');return false;}}` : remote ? `const[items,setItems]=useState<RecordItem[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;request().then(data=>{if(active)setItems(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function change(method:string,body:unknown){setBusy(true);setError('');try{setItems(await request(method,body));return true;}catch(e){setError(e instanceof Error?e.message:'Could not save.');return false;}finally{setBusy(false);}}` : `const snapshot=useSyncExternalStore(subscribe,readSnapshot,()=>null);const loading=snapshot===null;const busy=false;
 const items=useMemo(()=>parseRecords(snapshot),[snapshot]);
 async function change(method:string,body:{id?:string;title?:string;done?:boolean}){let next=items;if(method==='POST')next=[{id:crypto.randomUUID(),title:body.title!,done:false},...items];if(method==='PATCH')next=items.map(item=>item.id===body.id?{...item,...body}:item);if(method==='DELETE')next=items.filter(item=>item.id!==body.id);try{localStorage.setItem('vorpal-records',JSON.stringify(next));window.dispatchEvent(new Event('vorpal-records-change'));return true;}catch{setError('Your browser could not save this record.');return false;}}`}
 async function add(e:React.FormEvent){e.preventDefault();if(!title.trim())return;if(await change('POST',{title:title.trim()}))setTitle('');}
 async function saveEdit(e:React.FormEvent,id:string){e.preventDefault();const next=editTitle.trim();if(!next)return;if(await change('PATCH',{id,title:next})){setEditingId(null);setEditTitle('');}}
 return <div className="stack">${!remote?'<p className="notice">This example saves to this browser. Select both a database and authentication to generate private cloud-backed records.</p>':''}<form className="row" onSubmit={add}><label className="sr-only" htmlFor="record-title">New record</label><input className="input" id="record-title" placeholder="What would you like to work on?" value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} required/><Button disabled={busy||loading} type="submit">Add record</Button></form>{(error${remote&&c.query?'||query.error?.message':''})&&<p role="alert" className="error-message">{error${remote&&c.query?'||query.error?.message':''}}</p>}{loading?<p role="status">Loading your records…</p>:items.length===0?<div className="empty"><h2>A clean slate.</h2><p>Add your first record above. A small step is a good start.</p></div>:<div>{items.map(item=><div className="record" key={item.id}>{editingId===item.id?<form className="row record-edit" onSubmit={e=>saveEdit(e,item.id)}><label className="sr-only" htmlFor={'edit-'+item.id}>Edit record</label><input className="input" id={'edit-'+item.id} value={editTitle} onChange={e=>setEditTitle(e.target.value)} maxLength={200} autoFocus required onKeyDown={e=>{if(e.key==='Escape'){setEditingId(null);setEditTitle('');}}}/><Button type="submit" disabled={busy}>Save</Button><button type="button" className="subtle-button" onClick={()=>{setEditingId(null);setEditTitle('');}}>Cancel</button></form>:<><input type="checkbox" aria-label={'Mark '+item.title+' complete'} checked={item.done} disabled={busy} onChange={()=>change('PATCH',{id:item.id,done:!item.done})}/><span className={'record-title '+(item.done?'done':'')}>{item.title}</span><button className="subtle-button" disabled={busy} onClick={()=>{setEditingId(item.id);setEditTitle(item.title);}}>Edit</button><button className="subtle-button" disabled={busy} onClick={()=>change('DELETE',{id:item.id})}>Delete</button></>}</div>)}</div>}</div>;
}
`;
 f['src/app/(app)/dashboard/page.tsx']=`import {Records} from '@/components/records';
export default function Dashboard(){return <div className="page"><div className="page-heading"><div><p className="section-label">YOUR WORKSPACE</p><h1>Small steps. Good progress.</h1><p>A place to collect ideas and move them forward.</p></div></div><section className="panel" aria-label="Your records"><Records/></section></div>;}
`;
 if(remote)f['src/app/api/records/route.ts']=`import {z} from 'zod';
import {requireUser} from '@/auth/server';
import {listRecords,addRecord,updateRecord,deleteRecord} from '@/database/records';
import {checkOrigin,readBody,failure,HttpError} from '@/lib/http';
const title=z.string().trim().min(1).max(200);
const create=z.object({title});const update=z.object({id:z.uuid(),title:title.optional(),done:z.boolean().optional()});const remove=z.object({id:z.uuid()});
export async function GET(){try{const user=await requireUser();return Response.json(await listRecords(user.id),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
async function mutate(request:Request,method:string){try{checkOrigin(request);const user=await requireUser();const body=await readBody(request);if(method==='POST'){const v=create.safeParse(body);if(!v.success)throw new HttpError(400,'Enter a title between 1 and 200 characters.');await addRecord(user.id,v.data.title);}else if(method==='PATCH'){const v=update.safeParse(body);if(!v.success)throw new HttpError(400,'Invalid record update.');const{id,...patch}=v.data;await updateRecord(user.id,id,patch);}else{const v=remove.safeParse(body);if(!v.success)throw new HttpError(400,'Invalid record ID.');await deleteRecord(user.id,v.data.id);}return Response.json(await listRecords(user.id));}catch(e){return failure(e);}}
export const POST=(r:Request)=>mutate(r,'POST');export const PATCH=(r:Request)=>mutate(r,'PATCH');export const DELETE=(r:Request)=>mutate(r,'DELETE');
`;
 if(c.query&&!remote){f['src/hooks/use-health.ts']=`'use client';
import {useQuery} from '@tanstack/react-query';
export function useHealth(){return useQuery({queryKey:['health'],queryFn:async()=>{const response=await fetch('/api/health');if(!response.ok)throw new Error('Unable to reach the application.');return response.json() as Promise<{status:string}>;}});}
`;
 f['src/app/api/health/route.ts']=`export function GET(){return Response.json({status:'ok'});}\n`;
 f['src/components/query-status.tsx']=`'use client';\nimport {useHealth} from '@/hooks/use-health';\nexport function QueryStatus(){const query=useHealth();return <p className="status" role="status">{query.isPending?'Checking connection…':query.error?'Connection unavailable':'Application connected'}</p>;}\n`;
 f['src/app/(app)/dashboard/page.tsx']=f['src/app/(app)/dashboard/page.tsx'].replace("import {Records}","import {QueryStatus} from '@/components/query-status';\nimport {Records}").replace('<Records/>','<Records/><QueryStatus/>');}
 if(c.email==='resend'&&c.auth!=='none')f['src/app/(app)/email/page.tsx']=`import {EmailExample} from '@/components/email-example';\nexport default function Page(){return <div className="page"><h1>A note to your inbox.</h1><p>Send the welcome template to your signed-in email address.</p><EmailExample/></div>;}\n`;
 return f;
}
