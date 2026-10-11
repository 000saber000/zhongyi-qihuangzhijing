import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {knowledge,knowledgeRevision,subscribeKnowledge,setPublishedKnowledge,type Knowledge} from '../../data/catalog';
import {api} from '../../lib/api';

let inFlight:Promise<void>|null=null;
export function useKnowledge(){
 const revision=useSyncExternalStore(subscribeKnowledge,knowledgeRevision);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!import.meta.env.VITE_API_BASE_URL)return;
  setLoading(true);
  try{
   if(!inFlight)inFlight=api<{items:Knowledge[]}>('/api/knowledge').then(data=>{
    if(!Array.isArray(data.items)||!data.items.length)throw new Error('发布目录暂时无法读取。');
    setPublishedKnowledge(data.items);
   }).finally(()=>{inFlight=null;});
   await inFlight;setError('');
  }catch{setError('云端内容暂未同步，当前显示已载入内容。');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const wake=()=>{if(!document.hidden)void refresh();};
  const timer=setInterval(wake,60000);window.addEventListener('focus',wake);
  return()=>{clearInterval(timer);window.removeEventListener('focus',wake);};
 },[refresh]);
 return {knowledge,revision,loading,error,refresh};
}
