export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string){super(message);}
}
const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
export async function api<T>(path:string,options:{method?:string;body?:unknown;token?:string}={}):Promise<T>{
 if(!base)throw new ApiError(0,'NOT_CONFIGURED','云端服务尚未配置，请稍后再试。');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(base+path,{method:options.method??'GET',signal:controller.signal,headers:{...(options.token?{Authorization:'Bearer '+options.token}:{}),...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});
  if(response.status===204)return undefined as T;
  const data=await response.json();
  if(!response.ok)throw new ApiError(response.status,data?.error?.code??'REQUEST_FAILED',data?.error?.message??'云端请求失败，请重试。');
  return data as T;
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(0,'NETWORK_ERROR','云端连接失败，请重试。首次连接可能需要较长时间。');}finally{clearTimeout(timeout);}
}
