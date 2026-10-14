import type {AcupointAnchor,AcupointDefinition,BodyModel,MeridianPath,Selection,Vec3} from './types';
const finite=(v:Vec3)=>v.length===3&&v.every(Number.isFinite);
const direction=(v:Vec3)=>finite(v)&&Math.hypot(...v)>.5;
export function validateRegistry(models:readonly BodyModel[],definitions:readonly AcupointDefinition[],anchors:readonly AcupointAnchor[],paths:readonly MeridianPath[]):string[]{
 const problems:string[]=[],modelMap=new Map(models.map(m=>[m.id,m])),defMap=new Map(definitions.map(d=>[d.knowledgeId,d]));
 if(modelMap.size!==models.length||defMap.size!==definitions.length)problems.push('duplicate model or definition');
 const keys=new Set<string>();
 for(const anchor of anchors){
  const key=`${anchor.modelId}:${anchor.knowledgeId}:${anchor.side}`,model=modelMap.get(anchor.modelId),def=defMap.get(anchor.knowledgeId);
  if(keys.has(key))problems.push('duplicate anchor '+key);keys.add(key);
  if(!model||!def)problems.push('unknown model or point '+key);
  if(model&&model.sha256!==anchor.modelSha256)problems.push('model hash mismatch '+key);
  if(def&&!def.sides.includes(anchor.side))problems.push('invalid side '+key);
  if(!finite(anchor.position)||!direction(anchor.outwardNormal)||!direction(anchor.viewDirection)||!Number.isFinite(anchor.viewDistance)||anchor.viewDistance<=0)problems.push('invalid vector or distance '+key);
  if(!anchor.review.source||!anchor.review.section||!anchor.review.checkedAt)problems.push('missing review '+key);
 }
 for(const model of models)for(const def of definitions)for(const side of def.sides){
  if(!keys.has(`${model.id}:${def.knowledgeId}:${side}`))problems.push(`missing anchor ${model.id}:${def.knowledgeId}:${side}`);
 }
 for(const path of paths){
  if(modelMap.get(path.modelId)?.sha256!==path.modelSha256)problems.push('path hash mismatch '+path.meridianId);
  if(path.points.length<2||!path.points.every(finite)||!path.review.source)problems.push('invalid path '+path.meridianId);
 }
 return problems;
}
export function getAnchor(anchors:readonly AcupointAnchor[],modelId:string,selection:Selection):AcupointAnchor|null{
 return selection?anchors.find(a=>a.modelId===modelId&&a.knowledgeId===selection.knowledgeId&&a.side===selection.side)??null:null;
}
