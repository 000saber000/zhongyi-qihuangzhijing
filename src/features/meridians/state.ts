import type {Knowledge} from '../../data/catalog';
import type {AcupointDefinition,ModelVariant,Selection} from './types';
export const preferenceKey='qihuang.body.variant.v1';
export function readVariant(storage:Pick<Storage,'getItem'>|null):ModelVariant{try{return storage?.getItem(preferenceKey)==='female'?'female':'male';}catch{return 'male';}}
export type BodyState={variant:ModelVariant;displayedVariant:ModelVariant|null;selection:Selection;requestId:number;status:'loading'|'ready'|'error'};
export const initialState=(variant:ModelVariant):BodyState=>({variant,displayedVariant:null,selection:null,requestId:1,status:'loading'});
export type BodyAction={type:'request';variant:ModelVariant}|{type:'ready'|'failed';requestId:number}|{type:'select';selection:Selection};
export function reduceBodyState(state:BodyState,action:BodyAction):BodyState{
 if(action.type==='select')return {...state,selection:action.selection};
 if(action.type==='request')return {...state,variant:action.variant,status:'loading',requestId:state.requestId+1};
 if(action.requestId!==state.requestId)return state;
 return {...state,status:action.type==='ready'?'ready':'error',displayedVariant:action.type==='ready'?state.variant:state.displayedVariant};
}
export function visiblePoints(definitions:readonly AcupointDefinition[],knowledge:readonly Knowledge[],meridian:string,query:string){
 const items=new Map(knowledge.map(k=>[k.id,k])),q=query.trim().toLowerCase();
 return definitions.flatMap(definition=>{const k=items.get(definition.knowledgeId);return k&&(meridian==='all'||(definition.meridianId??'extra')===meridian)&&`${k.title} ${k.subtitle} ${k.tags.join(' ')} ${definition.referenceCode}`.toLowerCase().includes(q)?[{definition,knowledge:k}]:[];});
}
