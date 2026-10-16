"""Read the exported assets and test organ vertices/face centers against body envelopes.
blender -b --python-exit-code 1 --python scripts/anatomy/verify-organ-fit.py -- --root .
Does not use the fitter's profile, normals, or nearest-surface sign.
"""
import bpy,json,sys,argparse
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--legacy',action='store_true');opts=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(opts.root).resolve()
models=json.loads((root/'src/assets/anatomy/models.manifest.json').read_text());fit_path=root/'src/assets/anatomy/organs.manifest.json';fit=json.loads(fit_path.read_text()) if fit_path.exists() and not opts.legacy else None
report={};failures=0
for variant,model in models.items():
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'src/assets/anatomy'/model['sourceFile']))
 vertices=[];faces=[]
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  offset=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices);faces.extend([tuple(offset+i for i in face.vertices) for face in o.data.polygons])
 tree=BVHTree.FromPolygons(vertices,faces)
 existing=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(root/'src/assets/anatomy'/(fit[variant]['sourceFile'] if fit else 'viscera-v1.glb')))
 total=0;outside=0;examples=[];degenerate_retries=0
 for o in set(bpy.context.scene.objects)-existing:
  if o.type!='MESH':continue
  points=[o.matrix_world@v.co for v in o.data.vertices]
  if not fit:
   points=[Vector((p.x*(.93 if variant=='female' else 1.06),p.y*(.93 if variant=='female' else 1.04)+.018,p.z*(1.70/1.78 if variant=='female' else 1)+(-.02 if variant=='female' else 0))) for p in points]
  # Check face centers too; all vertices inside alone does not prove a face is inside.
  points+= [sum((points[i] for i in face.vertices),Vector())/len(face.vertices) for face in o.data.polygons]
  for point in points:
   total+=1;inside=True
   # Independent frontal AND lateral silhouette containment, regardless of mesh normals.
   # A ray exactly on a generated mesh seam can collapse both hits onto one wall.
   # Only that degenerate case is retried with a 0.1mm parallel probe; valid
   # intervals reporting a real outside point are never widened or retried.
   for axis in [0,1]:
    orthogonal=[i for i in range(3) if i!=axis];interval=None
    for attempt,(u,v) in enumerate([(0,0),(.0001,0),(-.0001,0),(0,.0001),(0,-.0001)]):
     origin=point.copy();origin[orthogonal[0]]+=u;origin[orthogonal[1]]+=v
     origin[axis]=-1;direction=Vector();direction[axis]=1;a=tree.ray_cast(origin,direction,2)[0]
     origin[axis]=1;direction[axis]=-1;b=tree.ray_cast(origin,direction,2)[0]
     if a is not None and b is not None and b[axis]-a[axis]>.0005:
      interval=(a[axis],b[axis])
      if attempt:degenerate_retries+=1
      break
    if interval is None or point[axis]<interval[0]-.0001 or point[axis]>interval[1]+.0001:inside=False;break
   if not inside:
    outside+=1
    if len(examples)<6:examples.append([round(point.x,4),round(point.z,4),round(-point.y,4)])
  # Do not accidentally treat newly added face centers as mesh vertices on next object.
 report[variant]={'samples':total,'outside':outside,'examples':examples,'degenerateAxisRetries':degenerate_retries};failures+=outside
 print('CONTAINMENT',variant,json.dumps(report[variant]),flush=True)
(root/('.superpowers/alignment/organ-containment-legacy.json' if opts.legacy else '.superpowers/alignment/organ-containment.json')).write_text(json.dumps(report,indent=2))
if failures:raise RuntimeError(f'{failures} organ samples outside the actual bodies')
print('ORGAN_CONTAINMENT_PASS',flush=True)
