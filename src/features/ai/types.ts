export type AiStatus={enabled:boolean;remaining:number;dailyLimit:number;globalAvailable:boolean;resetTimezone:string};
export type Source={id:string;title:string;source:string;confidence:string};
export type ChatEvent={type:'meta';sources:Source[];remaining:number}|{type:'delta';text:string}|{type:'done'};
export type Message={role:'user'|'assistant';content:string};
export type Provider='deepseek'|'qwen'|'openai';
export type ModelConfig={provider:Provider;model:string;enabled:boolean;dailyLimit:number;globalDailyLimit:number;maxTokens:number;version:number;hasKey:boolean;encryptionReady:boolean};
export const providerLabels:Record<Provider,string>={deepseek:'DeepSeek',qwen:'通义千问',openai:'OpenAI'};
export function isAiOwner(user:{role:string;username:string;mustChangePassword:boolean}|null){return user?.role==='admin'&&user.username.toLowerCase()==='aidejiasinuo'&&!user.mustChangePassword;}
