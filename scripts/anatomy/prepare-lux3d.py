"""Normalize user-supplied Lux3D exports without reducing their geometry.
blender -b --python scripts/anatomy/prepare-lux3d.py -- --root . --male DIR --female DIR --sources DIR
Source folders contain MODEL.glb and RawDiffuseFilter.png. Originals stay unchanged.
"""
import bpy, sys, argparse, json, hashlib
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser()
for key in ['root','male','female','sources']:p.add_argument('--'+key,required=True)
p.add_argument('--skip-previews',action='store_true')
opts=p.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(opts.root).resolve();out=root/'src/assets/anatomy';sources=Path(opts.sources).resolve();sources.mkdir(parents=True,exist_ok=True)
manifest={}
def yup(v):return [round(v[0],6),round(v[2],6),round(-v[1],6)]
def look(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for variant,height in [('male',1.78),('female',1.70)]:
 source=Path(getattr(opts,variant)).resolve()
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source/'MODEL.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Imported glTF is converted to Blender Z-up; normalize evaluated WORLD bounds.
 coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)])
 scale=height/(hi.z-lo.z);offset=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for o in meshes:
  for vertex in o.data.vertices:vertex.co=(o.matrix_world@vertex.co-offset)*scale
  o.matrix_world.identity()
  for face in o.data.polygons:face.use_smooth=True
  o.name='TeachingBody'
  o.data.materials.clear()
  material=bpy.data.materials.new('Lux3D '+variant+' jade and sportswear');material.use_nodes=True
  shader=material.node_tree.nodes.get('Principled BSDF')
  texture=material.node_tree.nodes.new('ShaderNodeTexImage')
  texture.image=bpy.data.images.load(str(source/'RawDiffuseFilter.png'));texture.image.pack()
  material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
  shader.inputs['Roughness'].default_value=.38
  shader.inputs['Metallic'].default_value=.025
  shader.inputs['Coat Weight'].default_value=.28
  shader.inputs['Coat Roughness'].default_value=.3
  o.data.materials.append(material)
  o['asset_source']='User supplied Aholo Lux3D export'
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0]
 filename=f'adult-{variant}-v3.glb'
 bpy.ops.export_scene.gltf(filepath=str(out/filename),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=False,export_animations=False,export_image_format='JPEG',export_jpeg_quality=94)
 raw=(out/filename).read_bytes()
 # Individually estimated teaching landmarks, not a skeleton or clinical measurements.
 u=height/1.78
 landmarks={'joint-head':[0,1.603*u,.015*u],'joint-head-2':[0,height-.004,0],'joint-neck':[0,1.49*u,0]}
 for sign,letter in [(1,'l'),(-1,'r')]:
  values={'shoulder':(.205,1.377,0),'elbow':(.278,1.13,-.04),'hand':(.37,.85,-.025),'hand-2':(.35,.79,-.02),'finger-2-1':(.345,.75,-.01),'knee':(.123,.53,-.03),'ankle':(.15,.085,-.03),'foot-1':(.15,.042,.055),'toe-1-1':(.13,.027,.12),'toe-2-1':(.15,.025,.13)}
  if variant=='female':
   values.update({'shoulder':(.195,1.377,0),'elbow':(.235,1.17,-.04),'hand':(.318,.905,-.02),'hand-2':(.31,.84,.025),'finger-2-1':(.31,.80,.025),'knee':(.123,.545,-.03)})
  for name,(x,y,z) in values.items():landmarks[f'joint-{letter}-{name}']=[sign*x*u,y*u,z*u]
 manifest[variant]={'id':f'adult-{variant}-v3','variant':variant,'sourceFile':filename,'sha256':hashlib.sha256(raw).hexdigest(),'sourceSha256':hashlib.sha256((source/'MODEL.glb').read_bytes()).hexdigest(),'source':'User-provided Aholo Lux3D export; no third-party CC0 claim','previewFiles':{v:f'{variant}-{v}.png' for v in ['front','side','back']},'height':height,'joints':landmarks,'landmarkMethod':'Per-model visual teaching landmarks; not clinical validation'}
 bpy.ops.wm.save_as_mainfile(filepath=str(sources/f'adult-{variant}-v3.blend'),compress=True)
 if opts.skip_previews:continue
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False
 scene.render.resolution_x=480;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Jade preview world');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.065,.05,1)
 scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
 for name,loc,energy in [('Key',(-2,-3,3),550),('Fill',(2,-1,2),350),('Rim',(1,2,3),650)]:
  light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=3
  o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=loc;look(o,(0,0,.9))
 data=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=2.05
 for view,loc in [('front',(0,-4,height*.5)),('side',(4,0,height*.5)),('back',(0,4,height*.5))]:
  cam.location=loc;look(cam,(0,0,height*.5));scene.render.filepath=str(out/f'{variant}-{view}.png');bpy.ops.render.render(write_still=True)
 print('PREPARED',variant,len(raw),flush=True)
(out/'models.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
