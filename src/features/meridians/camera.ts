import type {AcupointAnchor,Vec3} from './types';
export type CameraPose={position:Vec3;target:Vec3};
export type View='front'|'back'|'left'|'right';
export function fullBodyPose(view:View,aspect:number,height=1.78):CameraPose{
 const radius=Math.max(2.35,height/(2*Math.tan(Math.PI/8))*1.08,.9/(2*Math.tan(Math.PI/8)*aspect)*1.12);
 const direction:Vec3=view==='back'?[0,0,-1]:view==='left'?[1,0,0]:view==='right'?[-1,0,0]:[0,0,1];
 const target:Vec3=[0,height*.5,0];return {target,position:[direction[0]*radius,target[1],direction[2]*radius]};
}
export function cameraPose(anchor:AcupointAnchor,aspect:number,height=1.78):CameraPose{
 const length=Math.hypot(...anchor.viewDirection),relativeHeight=anchor.position[1]/height;
 // Chest/neck views need room above the selected point for the whole head.
 // Keep the original sightline to the anchor so the body cannot occlude it.
 const headroom=relativeHeight>=.68&&relativeHeight<.89&&Math.abs(anchor.viewDirection[1]/length)<.4
  ? (height+.025-anchor.position[1])/(Math.tan(Math.PI/8)*.88):0;
 const distance=Math.max(headroom,anchor.viewDistance*Math.max(1,.72/Math.max(.15,aspect)));
 return {target:anchor.position,position:anchor.position.map((p,i)=>p+anchor.viewDirection[i]/length*distance) as unknown as Vec3};
}
const spherical=(pose:CameraPose)=>{const [x,y,z]=pose.position.map((v,i)=>v-pose.target[i]),r=Math.hypot(x,y,z);return {r,phi:Math.acos(Math.max(-1,Math.min(1,y/r))),theta:Math.atan2(x,z)};};
export function interpolateOrbit(from:CameraPose,to:CameraPose,t:number):CameraPose{
 if(t>=1)return to;if(t<=0)return from;
 const a=spherical(from),b=spherical(to),u=t*t*(3-2*t),delta=Math.atan2(Math.sin(b.theta-a.theta),Math.cos(b.theta-a.theta));
 const theta=a.theta+delta*u,phi=a.phi+(b.phi-a.phi)*u,r=a.r+(b.r-a.r)*u;
 const target=from.target.map((v,i)=>v+(to.target[i]-v)*u) as unknown as Vec3;
 return {target,position:[target[0]+r*Math.sin(phi)*Math.sin(theta),target[1]+r*Math.cos(phi),target[2]+r*Math.sin(phi)*Math.cos(theta)]};
}
export function nearestVisibleMarker(hits:readonly {kind:'body'|'marker';distance:number;id?:string}[]):string|null{
 const first=[...hits].sort((a,b)=>a.distance-b.distance)[0];return first?.kind==='marker'?first.id??null:null;
}
export function advanceIdleRotation(speed:number,delta:number){
 // Integrate both eased speed and yaw over elapsed time. A small per-frame
 // clamp makes a slow device rotate slower; only cap unusually long stalls.
 const dt=Math.max(0,Math.min(delta,1)),decay=Math.exp(-2*dt),target=.11;
 return {speed:target+(speed-target)*decay,angle:target*dt+(speed-target)*(1-decay)/2};
}
