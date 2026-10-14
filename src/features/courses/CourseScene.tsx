import {useEffect,useRef,type MutableRefObject} from 'react';
import * as THREE from 'three';
import {courses} from '../../data/catalog';
import coverImage from '../../assets/jade/course-cloth.webp';
import {createCourseBook,type CourseBookModel} from './bookModel';
import type {CourseSelection,CourseVisualRef} from './sceneTypes';
import {createCourseNebula} from './courseNebula';

type Props={paused:boolean;reduced:boolean;highlight:string|null;books:MutableRefObject<(HTMLButtonElement|null)[]>;visual:CourseVisualRef;onReady:()=>void;onError:()=>void};
const angles=[140,-100,20].map(degrees=>degrees*Math.PI/180);
export default function CourseScene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const wake=useRef<()=>void>(()=>{});
 useEffect(()=>{wake.current();},[props.paused,props.reduced,props.highlight]);
 useEffect(()=>{
  const slot=host.current!;let disposed=false,frame=0,last=0,phase=0,arrival=0,entranceStarted=0;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{latest.current.onError();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','三维古籍与中医知识小星云');canvas.dataset.renderer='three';
  // Keep the WebGL surface in one DOM parent while the same shell enters/leaves the top layer.
  const shell=document.createElement('dialog');shell.className='course-canvas-shell';shell.setAttribute('role','presentation');shell.open=true;shell.append(canvas);slot.append(shell);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);
  const volumes:CourseBookModel[]=[],glowLevels=[0,0,0];
  const nebula=createCourseNebula(()=>request()),cloud=nebula.root;scene.add(cloud);
  const ringGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:180},(_,i)=>{const angle=i/180*Math.PI*2;return new THREE.Vector3(Math.cos(angle)*3.2,-.7,Math.sin(angle)*3.2);}));
  const ringMaterial=new THREE.LineBasicMaterial({color:'#aeae7b',transparent:true,opacity:.13});const ring=new THREE.LineLoop(ringGeometry,ringMaterial);scene.add(ring);
  scene.add(new THREE.HemisphereLight('#e3eddf','#18312a',2.4));
  const key=new THREE.DirectionalLight('#ffe8bd',3.3);key.position.set(-3,6,7);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:22});key.shadow.bias=-.0005;scene.add(key);
  const fill=new THREE.DirectionalLight('#9adbc8',1.15);fill.position.set(5,2,2);scene.add(fill);
  const glow=new THREE.PointLight('#d4e7a8',0,4,2);scene.add(glow);
  const floorGeometry=new THREE.PlaneGeometry(25,25),floorMaterial=new THREE.ShadowMaterial({opacity:.16});
  const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-1.05;floor.receiveShadow=true;scene.add(floor);
  let width=1,height=1,radius=3.2;
  const pointer={id:null as string|null,x:0,y:0},tilts=volumes.map(()=>new THREE.Vector2());
  let opening:{book:CourseBookModel;slot:HTMLElement;clock:Animation;from:THREE.Vector3;fromQuaternion:THREE.Quaternion;fromScale:number;scale:number}|null=null;
  const targetQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.10,-.18,-.025));
  const vector=new THREE.Vector3(),projected=new THREE.Vector3();
  const resize=()=>{
   if(disposed)return;const rect=(opening?.slot??slot).getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
   renderer.setSize(width,height,false);camera.aspect=width/height;
   if(opening){camera.fov=36;camera.position.set(0,0,8.5);camera.lookAt(0,0,0);const viewHeight=2*8.5*Math.tan(THREE.MathUtils.degToRad(18));opening.scale=Math.min(1.35,(width-38)/(3.25*height/viewHeight));}else{
    camera.fov=40;radius=width<600?2.15:3.2;
    const distance=Math.max(11.8,(radius*2+2)/(2*Math.tan(THREE.MathUtils.degToRad(20))*camera.aspect)+radius*.65);
    camera.position.set(0,distance*.38,distance*.925);camera.lookAt(0,.4,0);
    ring.scale.set(radius/3.2,1,radius/3.2);nebula.resize(width<600);
   }
   camera.updateProjectionMatrix();request();
  };
  const project=(book:CourseBookModel,index:number)=>{
   const button=latest.current.books.current[index];if(!button)return;
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(const x of [-.81,.81])for(const y of [-1.02,1.02])for(const z of [-.195,.195]){
    projected.set(x,y,z).applyMatrix4(book.root.matrixWorld).project(camera);
    const px=(projected.x+1)*width/2,py=(1-projected.y)*height/2;
    left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
   }
   Object.assign(button.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`,zIndex:String(Math.round(20+book.root.position.z*2)),visibility:'visible'});
  };
  function render(delta:number){
   const state=latest.current;let settling=false;
   if(opening){
    const p=Math.min(1,Number(opening.clock.currentTime??0)/1150),move=1-Math.pow(1-Math.min(1,p/.78),3),hinge=THREE.MathUtils.smoothstep(p,.16,.91);
    const book=opening.book;book.root.position.copy(opening.from).lerp(vector.set(-.75*opening.scale,0,0),move);
    book.root.quaternion.copy(opening.fromQuaternion).slerp(targetQuaternion,move);book.root.scale.setScalar(THREE.MathUtils.lerp(opening.fromScale,opening.scale,move));
    book.cover.rotation.y=hinge*Math.PI*.965;book.setOpacity(1);book.setGlow(.15);settling=true;
   }else{
    if(!state.paused)phase+=delta*Math.PI*2/120;
    nebula.update(state.paused?0:delta,phase*.55);
    volumes.forEach((book,index)=>{
     const angle=phase+angles[index];book.root.position.set(Math.cos(angle)*radius,.72+Math.sin(angle*2)*.08,Math.sin(angle)*radius);
     const tilt=tilts[index],tiltX=pointer.id===courses[index].id?pointer.x:0,tiltY=pointer.id===courses[index].id?pointer.y:0;
     tilt.x=state.reduced?0:THREE.MathUtils.damp(tilt.x,tiltX,14,delta);tilt.y=state.reduced?0:THREE.MathUtils.damp(tilt.y,tiltY,14,delta);
     if(Math.abs(tilt.x-tiltX)+Math.abs(tilt.y-tiltY)>.003&&!state.reduced)settling=true;
     book.root.rotation.set(-.035-tilt.y*.2,.26-Math.cos(angle)*.43+tilt.x*.4,Math.sin(angle)*.025);
     const entering=state.reduced?1:THREE.MathUtils.smoothstep(arrival-index*.16,0,.75);
     book.root.scale.setScalar(.88+.12*entering);book.setOpacity(entering);
     book.root.position.y-=(1-entering)*.2;
     const closed=book.cover.rotation.y;book.cover.rotation.y=state.reduced?0:THREE.MathUtils.damp(closed,0,10,delta);
     if(Math.abs(book.cover.rotation.y)>.001)settling=true;
     const lightTarget=state.highlight===courses[index].id?1:0;
     glowLevels[index]=state.reduced?lightTarget:THREE.MathUtils.damp(glowLevels[index],lightTarget,12,delta);
     book.setGlow(glowLevels[index]);if(Math.abs(glowLevels[index]-lightTarget)>.005)settling=true;
     book.root.updateMatrixWorld(true);project(book,index);
     if(entering<1)settling=true;
    });
    const index=courses.findIndex(course=>course.id===state.highlight);
    glow.intensity=index>=0?glowLevels[index]*1.6:0;if(index>=0)glow.position.copy(volumes[index].root.position).add(vector.set(-.5,.6,1.4));
   }
   renderer.render(scene,camera);canvas.dataset.ready=String(volumes.length===3&&(latest.current.reduced||arrival>=1.07));canvas.dataset.triangles=String(renderer.info.render.triangles);
   if(opening){canvas.dataset.coverCenterDepth=String(vector.set(-.75,0,0).applyMatrix4(opening.book.cover.matrix).z);canvas.dataset.coverTime=String(Number(opening.clock.currentTime??0));}else{delete canvas.dataset.coverCenterDepth;delete canvas.dataset.coverTime;}
   return settling;
  }
  function tick(now:number){
   frame=0;const delta=last?Math.min((now-last)/1000,.05):1/60;last=now;
   if(disposed)return;if(!entranceStarted)entranceStarted=now;arrival=(now-entranceStarted)/1000;const settling=render(delta);
   if(opening||!latest.current.paused||settling)frame=requestAnimationFrame(tick);else last=0;
  }
  function request(){if(!disposed&&!frame&&volumes.length)frame=requestAnimationFrame(tick);}
  wake.current=request;
  const observer=new ResizeObserver(resize);observer.observe(slot);
  const lost=(event:Event)=>{event.preventDefault();if(!disposed)latest.current.onError();};canvas.addEventListener('webglcontextlost',lost);
  const image=new Image();image.src=coverImage;
  void Promise.all([image.decode(),document.fonts.ready]).then(()=>{
   if(disposed)return;
   for(const course of courses){const book=createCourseBook(course,image);volumes.push(book);tilts.push(new THREE.Vector2());scene.add(book.root);}
   const handle={layer:shell,tilt(id:string|null,x:number,y:number){pointer.id=id;pointer.x=THREE.MathUtils.clamp(x,-.5,.5);pointer.y=THREE.MathUtils.clamp(y,-.5,.5);request();},open(selection:CourseSelection,destination:HTMLElement){
    const book=volumes[courses.findIndex(course=>course.id===selection.course.id)];
    const quaternion=camera.quaternion.clone().invert().multiply(book.root.quaternion);
    volumes.forEach(volume=>{volume.root.visible=volume===book;});cloud.visible=ring.visible=floor.visible=false;
    shell.close();shell.classList.add('course-opening');shell.setAttribute('role','dialog');shell.showModal();
    const clock=destination.animate([{opacity:1},{opacity:1}],{duration:1150,fill:'forwards'});
    opening={book,slot:shell,clock,from:new THREE.Vector3(),fromQuaternion:quaternion,fromScale:1,scale:1};
    observer.observe(shell);resize();
    const viewHeight=2*8.5*Math.tan(THREE.MathUtils.degToRad(18)),viewWidth=viewHeight*camera.aspect;
    const source=selection.origin;
    opening.from.set(((source.x+source.width/2)/width-.5)*viewWidth,(.5-(source.y+source.height/2)/height)*viewHeight,0);
    opening.fromScale=source.height/height*viewHeight/2;opening.scale=Math.min(1.35,(width-38)/(3.25*height/viewHeight));
    request();let canceled=false;
    return {finished:clock.finished.then(()=>{if(!canceled&&!disposed)render(0);}),cancel(){
     if(canceled)return;canceled=true;clock.cancel();observer.unobserve(shell);shell.close();shell.classList.remove('course-opening');shell.setAttribute('role','presentation');shell.removeAttribute('aria-label');shell.removeAttribute('aria-busy');shell.open=true;
     if(disposed)return;opening=null;volumes.forEach(volume=>{volume.root.visible=true;});cloud.visible=ring.visible=floor.visible=true;resize();render(1/60);request();
    }};
   }};
   latest.current.visual.current=handle;resize();render(1/60);latest.current.onReady();request();
  }).catch(()=>{if(!disposed)latest.current.onError();});
  return()=>{
   disposed=true;cancelAnimationFrame(frame);opening?.clock.cancel();observer.disconnect();wake.current=()=>{};latest.current.visual.current=null;
   canvas.removeEventListener('webglcontextlost',lost);shell.close();shell.remove();volumes.forEach(book=>book.dispose());
   nebula.dispose();ringGeometry.dispose();ringMaterial.dispose();floorGeometry.dispose();floorMaterial.dispose();key.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();
  };
 },[]);
 return <div className="course-3d-slot" ref={host}/>;
}
