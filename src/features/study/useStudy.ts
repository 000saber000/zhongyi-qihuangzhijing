import {useCallback,useEffect,useRef,useState} from 'react';
import {courses} from '../../data/catalog';
import {api,ApiError} from '../../lib/api';

type Records={bookmarks:string[];completed:string[]};
export type Session={user:{id:string;username:string;role:'user'|'admin';mustChangePassword:boolean};token:string;expiresAt:string};
const tokenKey='qihuang-session';
const empty:Records={bookmarks:[],completed:[]};
const lessonIds=new Set(courses.flatMap(c=>c.lessons.map((_,i)=>c.id+'-'+i)));
function readArray(key:string,allowed?:Set<string>):string[]{
 const value:unknown=JSON.parse(localStorage.getItem(key)??'null');return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&(allowed?allowed.has(id):/^[a-z][a-z0-9-]{2,79}$/.test(id))))]:[];
}
function readGuest(){
 try{return {data:{bookmarks:readArray('qihuang-bookmarks'),completed:readArray('qihuang-completed',lessonIds)},error:''};}
 catch{return {data:empty,error:'无法读取本地学习记录，请允许网站存储后重试。'};}
}
function savedSession():Session|null{
 try{const value=JSON.parse(sessionStorage.getItem(tokenKey)??'null');return value&&typeof value.user?.id==='string'&&typeof value.user?.username==='string'&&typeof value.expiresAt==='string'&&Number.isFinite(Date.parse(value.expiresAt))&&typeof value.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value.token)?{...value,user:{id:value.user.id,username:value.user.username,role:'user',mustChangePassword:false}}:null;}catch{return null;}
}
export function useStudy(){
 const [current,setCurrent]=useState<Session|null>(savedSession);
 const verified=useRef(!current),passwordChanging=useRef(false);
 const identity=useRef(current),epoch=useRef(0),revision=useRef(0),readNumber=useRef(0),pendingRef=useRef(new Set<string>());
 const [initialGuest]=useState(readGuest);const writeFailed=useRef(false);
 const [records,setRecords]=useState<Records>(()=>current?empty:initialGuest.data);
 const [loaded,setLoaded]=useState(!current&&!initialGuest.error),[status,setStatus]=useState<'local'|'loading'|'saving'|'synced'|'error'>(current?'loading':initialGuest.error?'error':'local');
 const [error,setError]=useState(current?'':initialGuest.error),[pending,setPending]=useState(new Set<string>()),[showImport,setShowImport]=useState(false),[authBusy,setAuthBusy]=useState(false);
 const [guest,setGuest]=useState(initialGuest.data);
 const installed=useRef(false);
 const matches=(id:number)=>id===epoch.current;
 const reset=useCallback((message='')=>{
  epoch.current++;revision.current++;identity.current=null;verified.current=false;setCurrent(null);pendingRef.current.clear();writeFailed.current=false;setPending(new Set());setShowImport(false);
  try{sessionStorage.removeItem(tokenKey);}catch{/* A restricted browser may not allow storage. */}
  const snapshot=readGuest();setGuest(snapshot.data);setRecords(snapshot.data);setLoaded(!snapshot.error);setStatus(snapshot.error?'error':'local');setError(snapshot.error||message);
 },[]);
 const failure=useCallback((cause:unknown,id:number,message?:string)=>{
  if(!matches(id))return;
  if(cause instanceof ApiError&&cause.status===401){reset('登录已过期，请重新登录。');return;}
  setStatus('error');setError(message??(cause instanceof Error?cause.message:'同步失败，请重试。'));
 },[reset]);
 const refresh=useCallback(async()=>{
  let session=identity.current;if(!session){const snapshot=readGuest();setGuest(snapshot.data);setRecords(snapshot.data);setLoaded(!snapshot.error);setStatus(snapshot.error?'error':'local');setError(snapshot.error);return;}if(passwordChanging.current||session.user.mustChangePassword||pendingRef.current.size)return;
  const id=epoch.current,version=revision.current,read=++readNumber.current;
  try{
   if(!verified.current){
    const data=await api<{user:Session['user'];expiresAt:string}>('/api/auth/me',{token:session.token});
    if(!installed.current||!matches(id)||revision.current!==version||read!==readNumber.current)return;
    session={...session,...data};verified.current=true;identity.current=session;setCurrent(session);offerImport(session);setError('');
    if(session.user.mustChangePassword){setLoaded(false);return;}
   }
   const data=await api<Records>('/api/study',{token:session.token});
   if(!installed.current||!matches(id)||revision.current!==version||read!==readNumber.current||pendingRef.current.size)return;
   setRecords(data);setLoaded(true);writeFailed.current=false;setStatus('synced');setError('');
  }catch(cause){if(installed.current&&matches(id)&&revision.current===version&&read===readNumber.current&&!pendingRef.current.size)failure(cause,id);}
 },[failure]);
 const offerImport=(session:Session)=>{
  if(session.user.mustChangePassword){setShowImport(false);return;}
  const snapshot=readGuest();setGuest(snapshot.data);const data=snapshot.data;
  let imported=false;try{imported=localStorage.getItem('qihuang-imported-'+session.user.id)==='true';}catch{/* Still offer an explicit import. */}
  setShowImport(!imported&&(data.bookmarks.length>0||data.completed.length>0));
 };
 useEffect(()=>{
  installed.current=true;
  if(identity.current)void refresh();
  return()=>{installed.current=false;};
 },[failure,refresh]);
 useEffect(()=>{
  if(!current)return;
  const wake=()=>{if(!document.hidden)void refresh();};
  const timer=setInterval(wake,30000);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[current,refresh]);
 const authenticate=async(username:string,password:string,register:boolean):Promise<boolean>=>{
  if(authBusy)return false;setAuthBusy(true);setError('');const id=epoch.current;
  try{
   const session=await api<Session>('/api/auth/'+(register?'register':'login'),{method:'POST',body:{username,password}});
   if(!matches(id))return false;
   try{sessionStorage.setItem(tokenKey,JSON.stringify(session));}catch{
    void api('/api/auth/logout',{method:'POST',token:session.token}).catch(()=>{});
    throw new Error('浏览器无法保存登录状态，请允许网站存储后重试。');
   }
   epoch.current++;revision.current++;writeFailed.current=false;verified.current=true;identity.current=session;setCurrent(session);setRecords(empty);setLoaded(false);setStatus('loading');setError('');
   pendingRef.current.clear();setPending(new Set());offerImport(session);void refresh();return true;
  }catch(cause){if(matches(id))setError(cause instanceof Error?cause.message:'登录失败，请重试。');return false;}
  finally{setAuthBusy(false);}
 };
 const logout=async()=>{
  const session=identity.current;reset();
  if(session){const id=epoch.current;try{await api('/api/auth/logout',{method:'POST',token:session.token});}catch{if(matches(id))setError('已退出此浏览器，但云端会话撤销失败；该会话将在到期后失效。');}}
 };
 const saveGuest=(next:Records)=>{
  setRecords(next);setGuest(next);
  try{localStorage.setItem('qihuang-bookmarks',JSON.stringify(next.bookmarks));localStorage.setItem('qihuang-completed',JSON.stringify(next.completed));setStatus('local');setError('');}
  catch{setStatus('error');setError('浏览器存储不可用，刷新后记录可能丢失。');}
 };
 const write=async(key:string,path:string,method:string,update:(data:Records)=>Records):Promise<boolean>=>{
  const session=identity.current;
  if(!loaded||session?.user.mustChangePassword||pendingRef.current.has('import'))return false;
  if(!session){saveGuest(update(records));return true;}
  if(pendingRef.current.has(key))return false;
  const id=epoch.current;if(!pendingRef.current.size){writeFailed.current=false;setError('');}revision.current++;pendingRef.current.add(key);setPending(new Set(pendingRef.current));setStatus('saving');
  try{
   await api(path,{method,token:session.token});
   if(!matches(id))return false;
   setRecords(update);setStatus(writeFailed.current?'error':'synced');return true;
  }catch(cause){if(matches(id))writeFailed.current=true;failure(cause,id,'保存失败，请重试。');return false;}
  finally{if(matches(id)){revision.current++;pendingRef.current.delete(key);setPending(new Set(pendingRef.current));}}
 };
 const toggleBookmark=(id:string)=>write('bookmark:'+id,'/api/bookmarks/'+encodeURIComponent(id),records.bookmarks.includes(id)?'DELETE':'PUT',data=>({...data,bookmarks:data.bookmarks.includes(id)?data.bookmarks.filter(value=>value!==id):[...data.bookmarks,id]}));
 const completeLesson=(id:string)=>write('lesson:'+id,'/api/completions/'+encodeURIComponent(id),'PUT',data=>({...data,completed:data.completed.includes(id)?data.completed:[...data.completed,id]}));
 const importGuest=async():Promise<boolean>=>{
  const session=identity.current;if(!session||session.user.mustChangePassword||pendingRef.current.size)return false;
  const id=epoch.current;revision.current++;pendingRef.current.add('import');setPending(new Set(pendingRef.current));setStatus('saving');setError('');
  try{
   const snapshot=readGuest();if(snapshot.error)throw new Error(snapshot.error);
   const data=await api<Records>('/api/study/import',{method:'POST',token:session.token,body:snapshot.data});
   if(!matches(id))return false;setRecords(data);setLoaded(true);setStatus('synced');setShowImport(false);
   try{localStorage.setItem('qihuang-imported-'+session.user.id,'true');}catch{setError('记录已导入，但浏览器无法记住导入选择。');}return true;
  }catch(cause){failure(cause,id);return false;}
  finally{if(matches(id)){revision.current++;pendingRef.current.delete('import');setPending(new Set(pendingRef.current));}}
 };
 const changePassword=async(currentPassword:string,newPassword:string):Promise<boolean>=>{
  const old=identity.current;if(!old||authBusy)return false;
  if(pendingRef.current.size){setError('请等待当前记录保存完成，再修改密码。');return false;}
  const id=epoch.current;passwordChanging.current=true;revision.current++;readNumber.current++;setAuthBusy(true);setError('');
  try{
   const session=await api<Session>('/api/auth/password',{method:'POST',token:old.token,body:{currentPassword,newPassword}});
   if(!matches(id)){void api('/api/auth/logout',{method:'POST',token:session.token}).catch(()=>{});return false;}
   try{sessionStorage.setItem(tokenKey,JSON.stringify(session));}catch{
    void api('/api/auth/logout',{method:'POST',token:session.token}).catch(()=>{});
    reset('密码已修改，但浏览器无法保存登录状态，请重新登录。');return false;
   }
   epoch.current++;revision.current++;verified.current=true;passwordChanging.current=false;identity.current=session;setCurrent(session);pendingRef.current.clear();setPending(new Set());setLoaded(false);setStatus('loading');setError('');offerImport(session);void refresh();return true;
  }catch(cause){failure(cause,id);return false;}finally{passwordChanging.current=false;setAuthBusy(false);}
 };
 return {sessionToken:current?.token,changePassword,user:current?.user??null,bookmarks:records.bookmarks,completed:records.completed,loaded,status,error,pending,guest,showImport,authBusy,authenticate,logout,toggleBookmark,completeLesson,importGuest,refresh,openImport:()=>setShowImport(true),dismissImport:()=>setShowImport(false)};
}
