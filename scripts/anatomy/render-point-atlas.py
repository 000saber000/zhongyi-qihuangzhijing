"""Render distinct learning-card images from the actual body and point anchors.
blender -b --threads 2 --python scripts/anatomy/render-point-atlas.py -- --root . --out DIR
Combine the PNG cells with Pillow outside Blender; retain transparency.
"""
import sys,argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--out',required=True);p.add_argument('--pack',action='store_true')
opts=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]);root=Path(opts.root).resolve();out=Path(opts.out);out.mkdir(parents=True,exist_ok=True)
if opts.pack:
 from PIL import Image
 points=[d for d in json.loads((root/'src/features/meridians/acupoints.json').read_text()) if d.get('detailLevel')=='detail']
 atlas=Image.new('RGBA',(1400,2240))
 for index,point in enumerate(points):
  cell=Image.open(out/f'{index:02d}-{point["referenceCode"]}.png').convert('RGBA')
  if cell.size!=(280,280):raise ValueError('Unexpected cell size')
  atlas.paste(cell,((index%5)*280,(index//5)*280))
 atlas.save(root/'src/assets/jade/cards-acupoints-expanded.webp',quality=90,method=6)
 print('ATLAS_PACKED',len(points));sys.exit(0)
import bpy
from mathutils import Vector
manifest=json.loads((root/'src/assets/anatomy/models.manifest.json').read_text());model=manifest['male']
points=[d for d in json.loads((root/'src/features/meridians/acupoints.json').read_text()) if d.get('detailLevel')=='detail']
anchors=json.loads((root/'src/features/meridians/anchors.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'src/assets/anatomy'/model['sourceFile']))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
scene.render.resolution_x=280;scene.render.resolution_y=280;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Jade learning cards');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.065,.05,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
# The imported jade texture is retained; the card is an actual point close-up.
def blender(v):return Vector((v[0],-v[2],v[1]))
def look(o,target):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy in [('Key',(-2,-3,3),350),('Fill',(2,-1,2),210),('Rim',(1,2,3),450)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=3
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;look(obj,Vector((0,0,.9)))
data=bpy.data.cameras.new('Learning point');camera=bpy.data.objects.new('Learning point',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO'
material=bpy.data.materials.new('Gold point');material.use_nodes=True
shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(1,.68,.18,1);shader.inputs['Emission Color'].default_value=(1,.55,.12,1);shader.inputs['Emission Strength'].default_value=2
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.006);marker=bpy.context.object;marker.data.materials.append(material)
bpy.ops.mesh.primitive_torus_add(major_radius=.012,minor_radius=.0008,major_segments=40,minor_segments=6);ring=bpy.context.object;ring.data.materials.append(material)
for index,point in enumerate(points):
 anchor=next(a for a in anchors if a['modelId']==model['id'] and a['knowledgeId']==point['knowledgeId'] and a['side'] in ['left','midline'])
 target=blender(anchor['position']);normal=blender(anchor['outwardNormal']).normalized();direction=blender(anchor['viewDirection']).normalized()
 marker.location=target+normal*.002;ring.location=target+normal*.003;ring.rotation_euler=normal.to_track_quat('Z','Y').to_euler()
 camera.location=target+direction*3;look(camera,target);data.ortho_scale=max(.2,anchor['viewDistance']*.85)
 scene.render.filepath=str(out/f'{index:02d}-{point["referenceCode"]}.png');bpy.ops.render.render(write_still=True)
 print('CARD_COMPLETE',index,point['referenceCode'],flush=True)
print('ATLAS_CELLS_COMPLETE',len(points),flush=True)
