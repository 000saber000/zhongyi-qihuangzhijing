import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Texture,Color} from 'three';
import {createJadeMaterial} from '../model-material';

test('face and neck vertex colors survive the shared jade material conversion',()=>{
 const source=new MeshStandardMaterial({vertexColors:true});
 const material=createJadeMaterial(source);
 assert.equal(material.vertexColors,true);
 material.dispose();source.dispose();
});

test('jade shading preserves the source UV maps and clothing colors without mutating cached materials',()=>{
 const texture=new Texture(),normal=new Texture();
 const source=new MeshStandardMaterial({map:texture,normalMap:normal,color:'#c8dab9',roughness:.38});
 const material=createJadeMaterial(source);
 assert.equal(material.map,texture);assert.equal(material.normalMap,normal);
 assert(material.color.equals(new Color('#c8dab9')));
 material.opacity=.25;material.color.set('#ffffff');
 assert.equal(source.opacity,1);assert(source.color.equals(new Color('#c8dab9')));
 assert.equal(material.userData.xrayUniform.value,0);
 material.dispose();source.dispose();texture.dispose();normal.dispose();
});
