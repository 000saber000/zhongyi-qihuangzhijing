"""Project educational point seeds onto each finalized model's actual surface.
blender -b --python scripts/anatomy/annotate-models.py -- --root .
Bone landmarks guide the schematic; these are not clinically validated coordinates.
"""
import bpy,json,sys,argparse
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);parser.add_argument('--sources')
opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(opts.root).resolve()
manifest=json.loads((root/'src/assets/anatomy/models.manifest.json').read_text())
definitions=json.loads((root/'src/features/meridians/acupoints.json').read_text());anchors=[]
def blender(v):return Vector((v[0],-v[2],v[1]))
def yup(v):return [round(v[0],6),round(v[2],6),round(-v[1],6)]
for variant,m in manifest.items():
 bpy.ops.wm.open_mainfile(filepath=str((Path(opts.sources) if opts.sources else root/'art/model-sources')/f'{m["id"]}.blend'))
 body=bpy.data.objects['TeachingBody'];tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
 j={k:Vector(v) for k,v in m['joints'].items()};height=m['height'];unit=height/1.78
 for d in definitions:
  code=d['referenceCode']
  for side in d['sides']:
   sign=1 if side=='left' else -1;letter='l' if side=='left' else 'r'
   knee=j[f'joint-{letter}-knee'];ankle=j[f'joint-{letter}-ankle'];elbow=j[f'joint-{letter}-elbow'];wrist=j[f'joint-{letter}-hand'];shoulder=j[f'joint-{letter}-shoulder'];foot=j[f'joint-{letter}-foot-1']
   direction=Vector((0,0,1));distance=.5;ray_offset=.35
   if code=='GV20':seed=j['joint-head-2'];direction=Vector((0,1,.1));distance=.48
   elif code=='EX-HN3':seed=j['joint-head']+Vector((0,.042*unit,0));distance=.42
   elif code=='GB20':seed=j['joint-neck']+Vector((sign*.045*unit,.045*unit,0));direction=Vector((sign*.15,.1,-1));distance=.5
   elif code=='GB21':seed=shoulder.lerp(j['joint-neck'],.45)+Vector((0,.03*unit,-.02*unit));direction=Vector((0,1,-.2));distance=.62
   elif code=='LI11':seed=elbow;direction=Vector((sign*.7,0,.6));ray_offset=.12;distance=.5
   elif code in ['PC6','TE5']:seed=wrist.lerp(elbow,2/12);direction=Vector((0,0,1 if code=='PC6' else -1));ray_offset=.12;distance=.4
   elif code=='HT7':seed=wrist+Vector((sign*.01*unit,0,-.01*unit));ray_offset=.12;distance=.35
   elif code=='LI4':seed=j[f'joint-{letter}-hand-2'].lerp(j[f'joint-{letter}-finger-2-1'],.55);direction=Vector((0,1,-.5));ray_offset=.12;distance=.33
   elif code.startswith('CV'):
    # The mannequins have no clinical landmarks; trunk ratios define a teaching schematic.
    ratios={'CV17':.737,'CV12':.655,'CV6':.555,'CV4':.52};seed=Vector((0,height*ratios[code],0));distance=.68
   elif code=='ST36':seed=knee.lerp(ankle,3/16)+Vector((sign*.024*unit,0,.015*unit));ray_offset=.12;distance=.52
   elif code=='GB34':seed=knee+Vector((sign*.027*unit,-.055*unit,0));direction=Vector((sign*.8,0,.5));ray_offset=.12;distance=.5
   elif code=='SP9':seed=knee+Vector((-sign*.015*unit,-.025*unit,0));direction=Vector((-sign,0,.15));ray_offset=.10;distance=.48
   elif code=='SP6':seed=ankle.lerp(knee,3/13);direction=Vector((-sign,0,0));ray_offset=.10;distance=.44
   elif code=='LR3':seed=ankle.lerp(j[f'joint-{letter}-toe-1-1'].lerp(j[f'joint-{letter}-toe-2-1'],.5),.65);direction=Vector((0,1,.2));ray_offset=.12;distance=.38
   elif code=='KI1':seed=foot+Vector((0,0,.015*unit));direction=Vector((0,-1,.15));ray_offset=.12;distance=.38
   elif code=='KI3':seed=ankle+Vector((0,0,-.025*unit));direction=Vector((-sign,0,-.1));ray_offset=.10;distance=.38
   else:raise ValueError(code)
   direction.normalize();origin=blender(seed+direction*ray_offset);ray=blender(-direction)
   position,normal,idx,length=tree.ray_cast(origin,ray,ray_offset*2)
   local_projection=False
   if position is None and m['id'].endswith('-v3'):
    # Generated hands need not share the planar palm orientation of the old
    # procedural body. A bounded local surface search handles that difference
    # without stretching a ray onto a remote limb or inventing a coordinate.
    candidates=tree.find_nearest_range(blender(seed),.045)
    candidates=[c for c in candidates if c[1].dot(blender(direction))>.2]
    if candidates:
     position,normal,idx,length=min(candidates,key=lambda c:c[3]+.015*(1-c[1].dot(blender(direction))))
     local_projection=True
     print('LOCAL_SURFACE',variant,code,side,'distance',length,flush=True)
   if position is None:raise ValueError(f'missing surface {variant} {code} {side}: {list(seed)}')
   # Raise markers by 2.5mm from the actual export surface to prevent z-fighting.
   if not local_projection and normal.dot(blender(direction))<0:normal=-normal
   position+=normal*.0025
   # Oblique anterior sightlines keep the opposite leg out of medial-leg views.
   if code in ['SP9','SP6','KI3']:direction=Vector((-sign*.38,.08,.92)).normalized()
   # Select a front-facing, unobstructed view on this exact mesh. Medial ankles
   # differ between independently generated bodies, and one fixed view can be
   # blocked by the opposite leg or face away from the actual surface normal.
   outward=Vector(yup(normal))
   candidates=[direction]+[(outward+Vector(axis)*1.6).normalized() for axis in [(0,.2,1),(0,.2,-1),(1,.2,0),(-1,.2,0),(0,1,0),(0,-1,0)]]+[outward]
   for candidate in candidates:
    if outward.dot(candidate)<.15:continue
    blocking=tree.ray_cast(position+blender(candidate)*2,blender(-candidate),1.9995)[0]
    if blocking is None:direction=candidate;break
   else:raise ValueError(f'No unobstructed view {variant} {code} {side}')
   anchors.append(dict(knowledgeId=d['knowledgeId'],modelId=m['id'],side=side,modelSha256=m['sha256'],position=yup(position),outwardNormal=yup(normal),viewDirection=list(direction),viewDistance=distance,review=dict(source=d['review']['source'],section=f'{code}；独立 {variant} 模型表面投影自查，非临床定位核验',checkedAt='2026-10-15')))
(root/'src/features/meridians/anchors.json').write_text(json.dumps(anchors,ensure_ascii=False,indent=2)+'\n')
models=[{k:m[k] for k in ['id','variant','sha256','sourceFile','previewFiles']} for m in manifest.values()]
(root/'src/features/meridians/models.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n')
print('ANNOTATIONS_COMPLETE',len(anchors))
