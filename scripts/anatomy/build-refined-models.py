"""Build the refined paired jade teaching mannequins from pinned CC0 MPFB assets.
Run inside Blender: blender -b --python this-file -- --mpfb-source PATH --output DIR --sources DIR
"""
import argparse,sys,types,math,json,hashlib,os
from pathlib import Path
import bpy,addon_utils
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser=argparse.ArgumentParser();parser.add_argument('--mpfb-source',required=True);parser.add_argument('--output',required=True);parser.add_argument('--sources',required=True)
opts=parser.parse_args(args);output=Path(opts.output).resolve();sources=Path(opts.sources).resolve();output.mkdir(parents=True,exist_ok=True);sources.mkdir(parents=True,exist_ok=True)
source=Path(opts.mpfb_source).resolve()
bpy.context.preferences.filepaths.save_version=0
for name,path in [('bl_ext',str(source.parent)),('bl_ext.qihuang_local',str(source/'src'))]:
 module=types.ModuleType(name);module.__path__=[path];sys.modules[name]=module
# Sparse source checkouts can omit UI thumbnails; they are not exported model assets.
(source/'src/mpfb/data/targets/_images').mkdir(parents=True,exist_ok=True)
(source/'src/mpfb/data/skins').mkdir(parents=True,exist_ok=True)
addon_utils.enable('bl_ext.qihuang_local.mpfb',default_set=True,persistent=False)
from bl_ext.qihuang_local.mpfb.services.humanservice import HumanService
from bl_ext.qihuang_local.mpfb.services.targetservice import TargetService

def material(name,color,metallic=.04,roughness=.32):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Metallic'].default_value=metallic;bsdf.inputs['Roughness'].default_value=roughness
 return m

def look_at(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def eye_ball(location,radius,mat,name):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=radius,location=location)
 o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o

def joint_position(original,name):
 group=original.vertex_groups.get(name)
 if not group:return None
 indices=[v.index for v in original.data.vertices if any(x.group==group.index for x in v.groups)]
 if not indices:return None
 original.modifiers['Hide helpers'].show_viewport=False
 bpy.context.view_layer.update();obj=original.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
 point=sum((obj.matrix_world@mesh.vertices[i].co for i in indices),Vector())/len(indices)
 obj.to_mesh_clear();original.modifiers['Hide helpers'].show_viewport=True;bpy.context.view_layer.update();return point


manifest={}
for variant in ['male','female']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 macro=TargetService.get_default_macro_info_dict();macro.update({'gender':1. if variant=='male' else 0.,'age':.5,'muscle':.72 if variant=='male' else .43,'weight':.5,'cupsize':.32,'firmness':.6})
 macro['race']={'asian':.8,'caucasian':.1,'african':.1}
 original=HumanService.create_human(macro_detail_dict=macro,feet_on_ground=True)
 original.name='SourceHuman';original.scale*=((1.78 if variant=='male' else 1.70)/original.dimensions.z)
 bpy.context.view_layer.objects.active=original;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 joints={g.name:list(joint_position(original,g.name)) for g in original.vertex_groups if g.name.startswith('joint-')}
 eyes=[Vector(joints[name]) for name in ['joint-l-eye','joint-r-eye']]
 # Freeze evaluated shape and helper mask before making editable export geometry.
 depsgraph=bpy.context.evaluated_depsgraph_get();evaluated=original.evaluated_get(depsgraph)
 mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
 body=bpy.data.objects.new('TeachingBody',mesh);bpy.context.collection.objects.link(body);bpy.data.objects.remove(original,do_unlink=True)
 # Lower the arms into a relaxed teaching A-pose, using the same smooth deformation
 # for anatomical vertices and all hand/elbow landmarks used by the annotation pass.
 def relaxed(point):
  point=Vector(point);sign=1 if point.x>=0 else -1
  shoulder=Vector(joints['joint-l-shoulder' if sign>0 else 'joint-r-shoulder'])
  weight=max(0,min(1,(abs(point.x)-abs(shoulder.x)+.025)/.075)) if point.z>.86 else 0
  theta=-sign*math.radians(22)*weight;delta=point-shoulder
  return shoulder+Vector((delta.x*math.cos(theta)-delta.z*math.sin(theta),delta.y,delta.x*math.sin(theta)+delta.z*math.cos(theta)))
 for vertex in body.data.vertices:vertex.co=relaxed(vertex.co)
 for name,point in list(joints.items()):
  if any(part in name for part in ['elbow','hand','finger']):joints[name]=list(relaxed(point))
 body['model_variant']=variant;body['model_version']='v2';body['source']='MPFB CC0 core assets 3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf'
 jade=material('Carved jade face and hands',(.52,.68,.56),roughness=.23)
 eyejade=material('Carved jade eyes',(.70,.82,.70),roughness=.25)
 pupil=material('Deep jade pupils',(.055,.15,.12),roughness=.30)
 body.data.materials.clear();body.data.materials.append(jade)
 for p in body.data.polygons:p.use_smooth=True
 bpy.context.view_layer.objects.active=body;body.select_set(True)
 # Smooth the anatomical surface while preserving hand/foot definition and fixed pose.
 modifier=body.modifiers.new('Teaching surface smoothing','SUBSURF');modifier.levels=1
 bpy.context.view_layer.update()
 evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());smooth=bpy.data.meshes.new_from_object(evaluated,depsgraph=bpy.context.evaluated_depsgraph_get())
 old=body.data;body.modifiers.clear();body.data=smooth;bpy.data.meshes.remove(old)
 body.data.calc_loop_triangles()
 if len(body.data.loop_triangles)>43000:
  decimate=body.modifiers.new('Web geometry budget','DECIMATE');decimate.ratio=43000/len(body.data.loop_triangles)
  bpy.ops.object.modifier_apply(modifier=decimate.name)
 for p in body.data.polygons:p.use_smooth=True
 # The final mannequin is a continuous neutral anatomical jade surface.
 height=1.78 if variant=='male' else 1.70
 objects=[body]
 for i,point in enumerate(eyes):
  if point:
   objects.append(eye_ball(point,.011,eyejade,f'JadeEye{i}'))
   objects.append(eye_ball(point+Vector((0,-.009,0)),.005,pupil,f'JadePupil{i}'))
 # Apply every transform so exported vertex bounds use a consistent world frame.
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 filename=f'adult-{variant}-v2.glb'
 bpy.ops.export_scene.gltf(filepath=str(output/filename),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=False,export_animations=False)
 raw=(output/filename).read_bytes()
 manifest[variant]={'id':f'adult-{variant}-v2','variant':variant,'sourceFile':filename,'sha256':hashlib.sha256(raw).hexdigest(),'previewFiles':{v:f'{variant}-{v}.png' for v in ['front','side','back']},'height':height,'sourceCommit':'3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf','parameters':macro,'joints':{name:[point[0],point[2],-point[1]] for name,point in joints.items()}}
 # Genuine model previews; this scene is not part of the GLB.
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=False
 scene.render.resolution_x=480;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world.color=(.035,.045,.04);scene.view_settings.view_transform='AgX'
 world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.07,.055,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
 floor_mat=material('Ink-green floor',(.015,.045,.035),roughness=.75)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));bpy.context.object.data.materials.append(floor_mat)
 for name,location,energy,size in [('Key',(-2,-3,4),280,3),('Fill',(2,-1,2),140,2),('Rim',(1,2,3),350,2)]:
  light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size
  ob=bpy.data.objects.new(name,light);scene.collection.objects.link(ob);ob.location=location;look_at(ob,(0,0,.9))
 camera_data=bpy.data.cameras.new('PreviewCamera');camera=bpy.data.objects.new('PreviewCamera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
 camera_data.type='ORTHO';camera_data.ortho_scale=2.04;camera_data.lens=50
 for view,position in [('front',(0,-4,1.0)),('side',(4,0,1.0)),('back',(0,4,1.0))]:
  camera.location=position;look_at(camera,(0,0,height*.49));scene.render.filepath=str(output/f'{variant}-{view}.png');bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(sources/f'adult-{variant}-v2.blend'),compress=True)
 print('MODEL_COMPLETE',variant,manifest[variant]['sha256'],flush=True)
(output/'models.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
