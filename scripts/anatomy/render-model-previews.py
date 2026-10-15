"""Render real paired model fallbacks. Run inside Blender with --root REPO."""
import bpy,sys,argparse,json
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--root',required=True)
opts=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(opts.root).resolve();folder=root/'src/assets/anatomy'
manifest=json.loads((folder/'models.manifest.json').read_text())
def look(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for variant,model in manifest.items():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(folder/model['sourceFile']))
 height=model['height'];scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=False
 scene.render.resolution_x=480;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Jade preview studio');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.065,.05,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
 for name,loc,power in [('Key',(-2,-3,3),350),('Fill',(2,-1,2),210),('Rim',(1,2,3),450)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=3
  obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;look(obj,(0,0,height*.5))
 data=bpy.data.cameras.new('Preview');camera=bpy.data.objects.new('Preview',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=2.05
 for view,loc in [('front',(0,-4,height*.5)),('side',(4,0,height*.5)),('back',(0,4,height*.5))]:
  camera.location=loc;look(camera,(0,0,height*.5));scene.render.filepath=str(folder/f'{variant}-{view}.png');bpy.ops.render.render(write_still=True)
 print('PREVIEWS_COMPLETE',variant,flush=True)
