// Uses the homepage's MIT-licensed shiyun-derived galaxy and relation builders.
// Copyright (c) 2026 Cohenjikan — 诗云 / Poetry Cloud; see third-party/SHIYUN-LICENSE.md.
import * as THREE from 'three';
import {subscribeKnowledge} from '../../data/catalog';
import {createGalaxy} from '../../three/Galaxy';
import {createKnowledgeCloud} from '../../three/KnowledgeClouds';
import {createRelationLight} from '../../three/RelationLight';
import {GALAXY,DECOR_RATE,SPIN_RATE} from '../../three/galaxyParams';
import {spaceNodes} from '../../three/knowledgeSpace';
import {discTexture} from '../../three/disc';

const radius=3.05,scale=radius/GALAXY.RADIUS;
export function createCourseNebula(onChange:()=>void){
 const root=new THREE.Group();root.name='miniature-homepage-universe';root.position.y=-.1;root.rotation.x=.22;
 const field=new THREE.Group();field.scale.setScalar(scale);root.add(field);
 const galaxy=createGalaxy('low',{pointScale:scale,farStars:false});field.add(galaxy.grp);
 // Textures cached by the homepage remain its own; this scene disposes only clones.
 const textures=new Set<THREE.Texture>();
 galaxy.grp.traverse(object=>{
  if(object instanceof THREE.Sprite&&object.material.map){object.material.map=object.material.map.clone();textures.add(object.material.map);}
 });
 const starTexture=discTexture().clone();textures.add(starTexture);
 let viewportScale=1;
 let clouds:ReturnType<typeof createKnowledgeCloud>,lines:ReturnType<typeof createRelationLight>,stars:THREE.Points;
 const release=(objects:THREE.Object3D[])=>{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  for(const object of objects)object.traverse(child=>{
   if(child instanceof THREE.Mesh||child instanceof THREE.Points||child instanceof THREE.Line){geometries.add(child.geometry);}
   const material=(child as THREE.Mesh).material;
   if(material)for(const item of Array.isArray(material)?material:[material])materials.add(item);
  });
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
 };
 const populate=()=>{
  if(clouds){field.remove(clouds,lines,stars);release([clouds,lines,stars]);}
  clouds=createKnowledgeCloud(null,'全部','low',scale*viewportScale);lines=createRelationLight(null);
  const geometry=new THREE.BufferGeometry(),positions:number[]=[],colors:number[]=[];
  for(const node of spaceNodes){positions.push(...node.position);const color=new THREE.Color(node.color);colors.push(color.r,color.g,color.b);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  stars=new THREE.Points(geometry,new THREE.PointsMaterial({size:80*scale*viewportScale/Math.tan(THREE.MathUtils.degToRad(20)),map:starTexture,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  field.add(clouds,lines,stars);onChange();
 };
 populate();const unsubscribe=subscribeKnowledge(populate);
 return {root,
  resize(mobile:boolean){
   viewportScale=mobile?.68:1;field.scale.setScalar(scale*viewportScale);
   galaxy.points.material.uniforms.uSize.value=8*scale*viewportScale;
   clouds.material.uniforms.uPointScale.value=scale*viewportScale;
   (stars.material as THREE.PointsMaterial).size=80*scale*viewportScale/Math.tan(THREE.MathUtils.degToRad(20));
  },
  update(delta:number,angle:number){root.rotation.y=angle;galaxy.points.rotation.y=angle*(DECOR_RATE/SPIN_RATE-1);clouds.material.uniforms.uTime.value+=delta;lines.material.uniforms.uTime.value+=delta;},
  dispose(){unsubscribe();release([root]);textures.forEach(texture=>texture.dispose());}
 };
}
