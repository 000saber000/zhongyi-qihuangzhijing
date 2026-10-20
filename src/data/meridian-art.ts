// Visible surface routes calibrated to the front, back and side album illustrations.
// Coordinates share the illustration's 260 x 260 viewport; internal branches are omitted.
export type MeridianArt={view:'front'|'back'|'side';points:[number,number][];focus:[number,number]};
export const meridianArt:Record<string,MeridianArt>={
 'meridian-stomach':{view:'front',points:[[135,20],[137,34],[139,51],[148,71],[147,96],[144,120],[143,145],[150,171],[148,193],[148,218],[150,243]],focus:[148,204]},
 'meridian-lung':{view:'front',points:[[130,73],[144,65],[156,69],[166,86],[175,109],[185,132],[197,153]],focus:[176,110]},
 'meridian-largeintestine':{view:'front',points:[[200,158],[193,143],[180,120],[172,97],[162,75],[149,60],[140,45],[135,29]],focus:[178,115]},
 'meridian-spleen':{view:'front',points:[[140,244],[138,223],[137,201],[137,181],[139,163],[134,144],[134,122],[141,103],[157,89]],focus:[137,193]},
 'meridian-heart':{view:'front',points:[[131,81],[146,77],[157,84],[169,108],[181,132],[193,153],[197,165]],focus:[174,118]},
 'meridian-smallintestine':{view:'front',points:[[65,166],[75,146],[87,124],[95,102],[103,81],[112,68],[122,54],[122,38],[118,27]],focus:[87,124]},
 'meridian-bladder':{view:'back',points:[[133,17],[142,20],[143,34],[138,51],[141,74],[141,102],[142,126],[144,151],[146,172],[146,193],[145,215],[150,236],[155,245]],focus:[144,141]},
 'meridian-kidney':{view:'front',points:[[143,245],[139,235],[137,220],[137,202],[136,184],[137,165],[134,149],[135,126],[135,106],[136,86],[143,69]],focus:[136,185]},
 'meridian-pericardium':{view:'front',points:[[133,83],[148,80],[160,86],[165,99],[174,119],[184,142],[194,165]],focus:[174,119]},
 'meridian-sanjiao':{view:'front',points:[[200,164],[192,147],[181,126],[173,106],[163,83],[152,68],[141,54],[139,40],[143,29],[138,18]],focus:[181,126]},
 'meridian-gallbladder':{view:'side',points:[[134,17],[145,25],[144,38],[139,49],[147,62],[155,78],[155,99],[154,119],[151,143],[152,165],[147,191],[148,216],[153,239],[153,246]],focus:[153,129]},
 'meridian-liver':{view:'front',points:[[139,246],[141,236],[138,221],[136,204],[138,186],[137,169],[133,149],[132,129],[135,111],[143,99]],focus:[136,204]},
 'meridian-du':{view:'back',points:[[130,149],[131,131],[130,112],[130,92],[130,73],[131,55],[131,37],[134,21],[131,8]],focus:[130,98]},
 'meridian-ren':{view:'front',points:[[130,150],[130,131],[130,110],[130,91],[130,72],[130,56],[130,43],[130,36]],focus:[130,106]},
 'meridian-chong':{view:'front',points:[[136,150],[138,133],[137,112],[139,93],[141,75],[135,60]],focus:[137,112]},
 'meridian-dai':{view:'front',points:[[108,96],[113,93],[130,92],[149,94],[152,98],[145,101],[130,102],[113,100],[108,96]],focus:[150,98]}
};

type Point=[number,number];
function bezier(a:Point,b:Point,c:Point,d:Point,t:number):Point{const s=1-t;return [s*s*s*a[0]+3*s*s*t*b[0]+3*s*t*t*c[0]+t*t*t*d[0],s*s*s*a[1]+3*s*s*t*b[1]+3*s*t*t*c[1]+t*t*t*d[1]];}
const number=(n:number)=>Math.round(n*100)/100;
export function meridianStroke(points:Point[]){
 const samples:Point[]=[points[0]];let center=`M${points[0].join(' ')}`;
 for(let i=0;i<points.length-1;i++){
  const previous=points[Math.max(0,i-1)],a=points[i],d=points[i+1],next=points[Math.min(points.length-1,i+2)];
  const b:Point=[a[0]+(d[0]-previous[0])*.15,a[1]+(d[1]-previous[1])*.15],c:Point=[d[0]-(next[0]-a[0])*.15,d[1]-(next[1]-a[1])*.15];
  center+=`C${[...b,...c,...d].map(number).join(' ')}`;
  for(let n=1;n<=10;n++)samples.push(bezier(a,b,c,d,n/10));
 }
 const left:Point[]=[],right:Point[]=[];
 samples.forEach((point,i)=>{
  const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,t=i/(samples.length-1);
  const pressure=(.14+1.45*Math.pow(Math.sin(Math.PI*t),.65))*(1+.06*Math.sin(t*31));
  left.push([point[0]-dy/length*pressure,point[1]+dx/length*pressure]);right.push([point[0]+dy/length*pressure,point[1]-dx/length*pressure]);
 });
 const outline=[...left,...right.reverse()];
 return {center,samples,ribbon:`M${outline.map(point=>point.map(number).join(' ')).join('L')}Z`};
}
