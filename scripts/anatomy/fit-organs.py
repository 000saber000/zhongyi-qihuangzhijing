"""Bake a separate, body-contained teaching layer for each immutable user body.
Fits the authored organ layout to the measured torso envelope without changing
body geometry or using transparent clipping to hide protruding parts.
"""
import bpy,json,sys,argparse,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser();p.add_argument('--root',required=True);opts=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(opts.root).resolve();folder=root/'src/assets/anatomy'
models=json.loads((folder/'models.manifest.json').read_text());landmarks=json.loads((folder/'surface-landmarks.json').read_text());result={}
source=folder/'viscera-v1.glb';source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
margin=.008
for variant,model in models.items():
 body_file=folder/model['sourceFile'];body_hash=hashlib.sha256(body_file.read_bytes()).hexdigest()
 if body_hash!=model['sha256'] or landmarks[variant]['modelSha256']!=body_hash:raise ValueError(f'Stale body/landmark calibration: {variant}')
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(body_file))
 verts=[];faces=[]
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  offset=len(verts);verts.extend(o.matrix_world@v.co for v in o.data.vertices);faces.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
 tree=BVHTree.FromPolygons(verts,faces)
 def bounds(x,y):
  front=tree.ray_cast(Vector((x,-1,y)),Vector((0,1,0)),2)[0];back=tree.ray_cast(Vector((x,1,y)),Vector((0,-1,0)),2)[0]
  return (-back.y,-front.y) if front is not None and back is not None else None
 profiles={}
 def width(y):
  key=round(y/.003)
  if key not in profiles:
   level=key*.003;central=bounds(0,level)
   if central is None:raise ValueError(f'No torso at {variant} {level}')
   sides=[]
   for sign in [-1,1]:
    last=0
    for index in range(1,61):
     x=sign*index*.005;section=bounds(x,level)
     if section is None or section[1]-section[0]<.025:break
     last=abs(x)
    sides.append(last)
   profiles[key]=min(sides)
  return profiles[key]
 before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(source))
 organs=[o for o in set(bpy.context.scene.objects)-before if o.type=='MESH']
 source_points={o.name:[o.matrix_world@v.co for v in o.data.vertices] for o in organs}
 all_points=[v for points in source_points.values() for v in points]
 depth_extent=max(abs(v.y) for v in all_points)
 bins={}
 for v in all_points:
  key=round(v.z/.002);bins[key]=max(bins.get(key,0),abs(v.x))
 def source_width(y):return max((bins.get(round(y/.002)+i,0) for i in range(-15,16)),default=.01)
 scale_y=model['height']/1.78;offset_y=landmarks[variant]['umbilicusY']-1.096*scale_y
 scales=[];local_adjustments=0
 for o in organs:
  originals=source_points[o.name];o.parent=None;o.matrix_world=Matrix.Identity(4)
  for vertex,v in zip(o.data.vertices,originals):
   y=v.z*scale_y+offset_y
   sx=min(1,max(.01,width(y)-margin)*.92/max(source_width(v.z),.01))
   x=v.x*sx;section=bounds(x,y)
   # A torso silhouette width is insufficient near a tangent or a narrow waist:
   # require a usable local depth as well, not merely an X-axis bounding box.
   if section is None or section[1]-section[0]<2*margin+.004:
    local_adjustments+=1
    for _ in range(40):
     x*=.96;section=bounds(x,y)
     if section is not None and section[1]-section[0]>=2*margin+.004:break
    else:raise ValueError(f'No usable local torso {variant} {x} {y}')
   back,front=section;half=(front-back)/2-margin
   sz=min(1,half/depth_extent);z=(back+front)/2-v.y*sz
   vertex.co=(x,-z,y);scales.append((sx,sz))
  # Clear imported custom normals so the deformed surfaces shade consistently.
  if o.data.has_custom_normals:o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
  o.data.update()
 bpy.ops.object.select_all(action='DESELECT')
 for o in organs:o.select_set(True)
 bpy.context.view_layer.objects.active=organs[0]
 filename=f'viscera-{variant}-v2.glb'
 bpy.ops.export_scene.gltf(filepath=str(folder/filename),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)
 result[variant]={'sourceFile':filename,'sha256':hashlib.sha256((folder/filename).read_bytes()).hexdigest(),'bodyModelId':model['id'],'bodySha256':model['sha256'],'authoredSourceSha256':source_hash,'margin':margin,'heightScale':scale_y,'heightOffset':offset_y,'minWidthScale':min(s[0] for s in scales),'minDepthScale':min(s[1] for s in scales),'localWidthAdjustments':local_adjustments,'method':'Measured frontal torso envelopes; per-height width fit and local depth/centerline adaptation. Educational layout; no clinical segmentation claim.'}
 print('ORGANS_FITTED',variant,json.dumps(result[variant]),flush=True)
(folder/'organs.manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
