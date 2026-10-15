import {Material,MeshPhysicalMaterial,MeshStandardMaterial} from 'three';

// Each mounted body owns its material; immutable cached textures remain shared.
export function createJadeMaterial(source:Material):MeshPhysicalMaterial{
 const original=source instanceof MeshStandardMaterial?source:null;
 const material=new MeshPhysicalMaterial({
  color:original?.color??'#c5d4b8',map:original?.map??null,vertexColors:original?.vertexColors??false,
  normalMap:original?.normalMap??null,normalScale:original?.normalScale,
  roughnessMap:original?.roughnessMap??null,metalnessMap:original?.metalnessMap??null,
  roughness:original?.roughness??.38,metalness:.025,clearcoat:.32,clearcoatRoughness:.3,
 });
 material.userData.xrayUniform={value:0};
 material.onBeforeCompile=shader=>{
  shader.uniforms.uJadeXray=material.userData.xrayUniform;
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uJadeXray;')
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float jadeRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.0);
    totalEmissiveRadiance+=uJadeXray*vec3(0.09,0.18,0.13)*(0.35+jadeRim);
    diffuseColor.a*=mix(1.0,0.50+jadeRim*1.25,uJadeXray);`);
 };
 return material;
}
