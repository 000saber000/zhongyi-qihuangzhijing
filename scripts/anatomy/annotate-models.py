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
landmarks=json.loads((root/'src/assets/anatomy/surface-landmarks.json').read_text())
definitions=json.loads((root/'src/features/meridians/acupoints.json').read_text());anchors=[]
def blender(v):return Vector((v[0],-v[2],v[1]))
def yup(v):return [round(v[0],6),round(v[2],6),round(-v[1],6)]
for variant,m in manifest.items():
 bpy.ops.wm.open_mainfile(filepath=str((Path(opts.sources) if opts.sources else root/'art/model-sources')/f'{m["id"]}.blend'))
 body=bpy.data.objects['TeachingBody'];tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
 j={k:Vector(v) for k,v in m['joints'].items()};height=m['height'];unit=height/1.78
 anatomy=landmarks[variant]
 if anatomy['modelSha256']!=m['sha256']:raise ValueError('Stale anatomical calibration')
 navel=anatomy['umbilicusY'];lower_cun=(navel-anatomy['pubicSymphysisY'])/5;upper_cun=(anatomy['xiphoidY']-navel)/8
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
    # Use the visible umbilicus and regional bone-proportional references.
    levels={'CV8':navel,'CV6':navel-1.5*lower_cun,'CV4':navel-3*lower_cun,'CV12':navel+4*upper_cun,'CV17':height*.737,'CV22':height*.833}
    seed=Vector((0,levels[code],0));distance=.68
   elif code=='ST36':seed=knee.lerp(ankle,3/16)+Vector((sign*.024*unit,0,.015*unit));ray_offset=.12;distance=.52
   elif code=='GB34':seed=knee+Vector((sign*.027*unit,-.055*unit,0));direction=Vector((sign*.8,0,.5));ray_offset=.12;distance=.5
   elif code=='SP9':seed=knee+Vector((-sign*.015*unit,-.025*unit,0));direction=Vector((-sign,0,.15));ray_offset=.10;distance=.48
   elif code=='SP6':seed=ankle.lerp(knee,3/13);direction=Vector((-sign,0,0));ray_offset=.10;distance=.44
   elif code=='LR3':seed=ankle.lerp(j[f'joint-{letter}-toe-1-1'].lerp(j[f'joint-{letter}-toe-2-1'],.5),.65);direction=Vector((0,1,.2));ray_offset=.12;distance=.38
   elif code=='KI1':seed=foot+Vector((0,0,.015*unit));direction=Vector((0,-1,.15));ray_offset=.12;distance=.38
   elif code=='KI3':seed=ankle+Vector((0,0,-.025*unit));direction=Vector((-sign,0,-.1));ray_offset=.10;distance=.38
   elif code=='LU1':seed=Vector((sign*.14*unit,1.39*unit,0));distance=.7
   elif code in ['LU5','HT3','PC3']:
    offset={'LU5':.01,'HT3':-.023,'PC3':-.005}[code]
    seed=elbow+Vector((sign*offset*unit,0,0));ray_offset=.12;distance=.46
   elif code in ['LU7','LU9','HT5','PC7','TE4']:
    ratio={'LU7':1.5/12,'LU9':0,'HT5':1/12,'PC7':0,'TE4':0}[code]
    offset={'LU7':-.012,'LU9':-.012,'HT5':.008,'PC7':0,'TE4':0}[code]
    seed=wrist.lerp(elbow,ratio)+Vector((sign*offset*unit,0,0))
    direction=Vector((0,0,-1 if code=='TE4' else 1));ray_offset=.12;distance=.38
   elif code=='LI10':seed=elbow.lerp(wrist,2/12);direction=Vector((sign*.7,0,.6));ray_offset=.12;distance=.48
   elif code in ['LI15','TE14']:
    seed=shoulder+Vector((sign*.012*unit,.025*unit,0));direction=Vector((sign*.45,.1,1 if code=='LI15' else -1));ray_offset=.16;distance=.6
   elif code=='LI20':seed=j['joint-head']+Vector((sign*.025*unit,.015*unit,0));ray_offset=.2;distance=.44
   elif code=='ST25':seed=Vector((sign*anatomy['midclavicularX']/2,navel,0));distance=.7
   elif code=='ST35':seed=knee+Vector((sign*.016*unit,-.01*unit,.015*unit));ray_offset=.12;distance=.48
   elif code=='ST40':seed=ankle.lerp(knee,.5)+Vector((sign*.035*unit,0,0));direction=Vector((sign*.3,0,1));ray_offset=.12;distance=.5
   elif code in ['ST44','GB41']:
    a=j[f'joint-{letter}-toe-2-1'] if code=='ST44' else (j[f'joint-{letter}-toe-2-1']+Vector((sign*.035*unit,0,-.015*unit)))
    seed=a+Vector((0,.005*unit,-.015*unit));direction=Vector((0,1,.2));ray_offset=.12;distance=.36
   elif code=='SP3':seed=foot+Vector((-sign*.03*unit,0,.035*unit));direction=Vector((-sign*.7,.6,0));ray_offset=.10;distance=.4
   elif code=='SP10':seed=knee+Vector((-sign*.03*unit,.08*unit,0));ray_offset=.14;distance=.52
   elif code in ['SI3','PC8']:
    seed=j[f'joint-{letter}-hand-2']+Vector((sign*.02*unit if code=='SI3' else 0,-.01*unit,0))
    direction=Vector((sign*.6,0,-.4)) if code=='SI3' else Vector((0,0,1));ray_offset=.12;distance=.36
   elif code=='SI9':seed=shoulder+Vector((-sign*.025*unit,-.055*unit,0));direction=Vector((0,0,-1));ray_offset=.2;distance=.6
   elif code=='SI11':seed=Vector((sign*.115*unit,1.335*unit,0));direction=Vector((0,0,-1));distance=.65
   elif code=='BL10':seed=j['joint-neck']+Vector((sign*.028*unit,.02*unit,0));direction=Vector((0,0,-1));distance=.55
   elif code in ['BL13','BL20','BL23']:
    y={'BL13':1.395,'BL20':1.19,'BL23':1.105}[code]
    seed=Vector((sign*.04*unit,y*unit,0));direction=Vector((0,0,-1));distance=.7
   elif code=='BL40':seed=knee;direction=Vector((0,0,-1));ray_offset=.12;distance=.52
   elif code=='BL57':seed=knee.lerp(ankle,.55);direction=Vector((0,0,-1));ray_offset=.14;distance=.5
   elif code in ['BL60','KI7','GB39']:
    seed=ankle.lerp(knee,{'BL60':0,'KI7':2/13,'GB39':3/16}[code])+Vector((0,0,-.025*unit if code!='GB39' else 0))
    direction=Vector((sign if code in ['BL60','GB39'] else -sign,0,0));ray_offset=.11;distance=.4
   elif code=='GB30':seed=Vector((sign*.14*unit,.93*unit,0));direction=Vector((sign*.75,0,-.65));distance=.65
   elif code=='LR8':seed=knee+Vector((-sign*.025*unit,.01*unit,-.015*unit));direction=Vector((-sign,0,-.3));ray_offset=.12;distance=.5
   elif code=='LR14':seed=Vector((sign*.10*unit,1.265*unit,0));distance=.75
   elif code in ['GV4','GV14']:
    seed=Vector((0,{'GV4':1.105,'GV14':1.49}[code]*unit,0));direction=Vector((0,0,-1));distance=.7
   else:raise ValueError(code)
   # Imported wrist/chest surfaces can lie outside the old 12cm ray origin.
   # Start outside the local front/back cross section to avoid exiting through
   # its opposite surface and flipping an inward normal onto a buried marker.
   if d.get('detailLevel')=='detail' and abs(direction.z)>.4:ray_offset=max(ray_offset,.35)
   direction.normalize();origin=blender(seed+direction*ray_offset);ray=blender(-direction)
   position,normal,idx,length=tree.ray_cast(origin,ray,ray_offset*2)
   local_projection=False
   if position is None and m['id'].endswith(('-v3','-v4')):
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
   else:raise ValueError(f'No unobstructed view {variant} {code} {side}: pos={yup(position)}, normal={yup(normal)}, seed={list(seed)}')
   anchors.append(dict(knowledgeId=d['knowledgeId'],modelId=m['id'],side=side,modelSha256=m['sha256'],position=yup(position),outwardNormal=yup(normal),viewDirection=list(direction),viewDistance=distance,review=dict(source=d['review']['source'],section=f'{code}；独立 {variant} 模型表面投影自查，非临床定位核验',checkedAt='2026-10-15')))
(root/'src/features/meridians/anchors.json').write_text(json.dumps(anchors,ensure_ascii=False,indent=2)+'\n')
models=[{k:m[k] for k in ['id','variant','sha256','sourceFile','previewFiles']} for m in manifest.values()]
(root/'src/features/meridians/models.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n')
print('ANNOTATIONS_COMPLETE',len(anchors))
