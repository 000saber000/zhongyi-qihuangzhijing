"""Generate surface-conforming primary routes and explicitly decorative fine branches.
Blender: --root REPO --sources DIR. Reads final meshes, landmarks and hash-bound anchors.
Primary routes are educational surface schematics, not reconstructed vessels or nerves.
"""
import bpy,json,sys,argparse,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--sources',required=True)
opts=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(opts.root).resolve()
manifest=json.loads((root/'src/assets/anatomy/models.manifest.json').read_text())
anchors=json.loads((root/'src/features/meridians/anchors.json').read_text())
definitions={d['knowledgeId']:d for d in json.loads((root/'src/features/meridians/acupoints.json').read_text())}
result=[];quality={}
def blender(v):return Vector((v[0],-v[2],v[1]))
def yup(v):return Vector((v[0],v[2],-v[1]))
def record(variant,m,name,side,role,segment,points,color):
 result.append(dict(meridianId='meridian-'+name,modelId=m['id'],modelSha256=m['sha256'],variant=variant,side=side,role=role,segment=segment,color=color,points=[[round(x,6) for x in point] for point in points],review={'source':'project:src/data/meridian-art.ts','section':'Major surface relationship teaching schematic; fine branches are visual illustration, not anatomical vessels; internal branches omitted.','checkedAt':'2026-10-15'}))
for variant,m in manifest.items():
 bpy.ops.wm.open_mainfile(filepath=str(Path(opts.sources)/f'{m["id"]}.blend'))
 tree=BVHTree.FromObject(bpy.data.objects['TeachingBody'],bpy.context.evaluated_depsgraph_get())
 j={k:Vector(v) for k,v in m['joints'].items()};u=m['height']/1.78
 own=[a for a in anchors if a['modelId']==m['id']]
 all_surface_errors=[]
 for sign,side in [(1,'left'),(-1,'right')]:
  letter='l' if sign>0 else 'r'
  shoulder,elbow,hand,knee,ankle=[j[f'joint-{letter}-{n}'] for n in ['shoulder','elbow','hand','knee','ankle']]
  def v(x,y,z=0):return Vector((sign*x*u,y*u,z*u))
  def arm(offset=0):return [shoulder+v(offset,0),shoulder.lerp(elbow,.5)+v(offset,0),elbow+v(offset,0),elbow.lerp(hand,.5)+v(offset,0),hand+v(offset,0),j[f'joint-{letter}-finger-2-1']+v(offset,0)]
  def leg(offset=0):return [knee.lerp(v(.12,.94),.8)+v(offset,0),knee+v(offset,0),knee.lerp(ankle,.3)+v(offset,0),knee.lerp(ankle,.65)+v(offset,0),ankle+v(offset,0),ankle+v(offset,-.045,.10)]
  routes=[
   ('stomach',[v(.026,1.67),v(.035,1.57),v(.065,1.43),v(.065,1.29),v(.058,1.12),v(.065,.99),*leg(.021)],'front','#ebca7d'),
   ('spleen',[v(.13,1.33),v(.10,1.22),v(.07,1.08),v(.065,.94),*leg(-.023)],'front','#a5d7c2'),
   ('kidney',[v(.037,1.42),v(.029,1.27),v(.024,1.12),v(.04,.94),*leg(-.032)],'front','#8ecfd1'),
   ('liver',[v(.12,1.27),v(.085,1.18),v(.05,1.05),v(.05,.92),*leg(-.012)],'front','#d4ba78'),
   ('gallbladder',[v(.075,1.7),v(.08,1.60),shoulder.lerp(v(.12,1.38),.5),v(.16,1.23),v(.15,1.06),v(.16,.9),*leg(.034)],'side','#d6c485'),
   ('bladder',[v(.045,1.7),v(.035,1.56),v(.05,1.43),v(.05,1.3),v(.055,1.13),v(.075,.96),*leg(.0)],'back','#a9d5c4'),
   ('lung',[v(.09,1.40),*arm(-.010)],'front','#e6c983'),
   ('pericardium',[v(.09,1.34),v(.15,1.37),*arm(-.023)],'front','#efce8d'),
   ('heart',[v(.11,1.33),v(.16,1.35),*arm(-.035)],'front','#b7dbcb'),
   ('largeintestine',[v(.028,1.62),v(.07,1.51),*arm(.01)],'side','#d2c68d'),
   ('sanjiao',[v(.075,1.65),v(.085,1.54),*arm(.0)],'back','#9ad1cf'),
   ('smallintestine',[v(.07,1.60),v(.09,1.46),*arm(-.015)],'back','#e0be7a')]
  if sign==1:routes.extend([('ren',[v(0,y) for y in [.92,1.02,1.14,1.27,1.40,1.50,1.55]],'front','#f1d79b'),('du',[v(0,y) for y in [.94,1.09,1.24,1.4,1.53,1.65,1.775]],'back','#dcca88')])
  for name,seeds,view,color in routes:
   normal=Vector((sign*.75,0,.65)).normalized() if view=='side' else Vector((0,0,-1 if view=='back' else 1))
   controls=[(point,normal) for point in seeds]
   # Place annotated same-meridian landmarks into their closest route interval.
   # Their explicit normals preserve wrist/palm/posterior/sole locations.
   selected=[a for a in own if definitions[a['knowledgeId']]['meridianId']=='meridian-'+name and a['side'] in [side,'midline']]
   insertions={}
   for a in selected:
    point=Vector(a['position']);best=None
    for i in range(len(seeds)-1):
     delta=seeds[i+1]-seeds[i];t=max(0,min(1,(point-seeds[i]).dot(delta)/max(delta.length_squared,1e-9)))
     distance=(point-seeds[i].lerp(seeds[i+1],t)).length
     if best is None or distance<best[0]:best=(distance,i,t)
    _,i,t=best;insertions.setdefault(i,[]).append((t,point,Vector(a['outwardNormal'])))
   controls=[]
   for i in range(len(seeds)-1):
    controls.append((seeds[i],normal))
    controls.extend((point,n) for _,point,n in sorted(insertions.get(i,[]),key=lambda item:item[0]))
   controls.append((seeds[-1],normal))
   segments=[];samples=[]
   def flush():
    if len(samples)>2:segments.append(samples[:])
    samples.clear()
   for (a,na),(b,nb) in zip(controls,controls[1:]):
    count=max(2,math.ceil((b-a).length/.003))
    for step in range(count):
     t=step/count;seed=a.lerp(b,t);direction=na.lerp(nb,t)
     if direction.length<.1:direction=normal.copy()
     direction.normalize()
     hit,n,_,_=tree.ray_cast(blender(seed+direction*.45),blender(-direction),.9)
     if hit is None:flush();continue
     if n.dot(blender(direction))<0:n=-n
     point=yup(hit+n*.0035)
     if samples and (point-samples[-1]).length>.03:flush()
     samples.append(point)
   flush()
   # Repair short silhouette gaps only when a continuous nearby surface exists.
   # Reproject every intermediate point: never draw a straight bridge through air.
   connected=[]
   for segment in segments:
    if connected and (connected[-1][-1]-segment[0]).length<.065:
     a,b=connected[-1][-1],segment[0];bridge=[]
     for k in range(1,max(2,math.ceil((a-b).length/.002))):
      seed=a.lerp(b,k/max(2,math.ceil((a-b).length/.002)))
      hit,n,_,distance=tree.find_nearest(blender(seed))
      if hit is None or distance>.018:bridge=[];break
      point=yup(hit+n*.0035)
      if (point-(bridge[-1] if bridge else a)).length>.012:bridge=[];break
      bridge.append(point)
     if bridge and (bridge[-1]-b).length<.012:
      connected[-1].extend(bridge+segment);continue
    connected.append(segment)
   segments=connected
   # Remove ray-triangle jitter while keeping the curve on the same actual mesh.
   for _ in range(5):
    for segment in segments:
     smooth=[segment[0]]
     for i in range(1,len(segment)-1):
      seed=segment[i-1]*.25+segment[i]*.5+segment[i+1]*.25
      hit,n,_,distance=tree.find_nearest(blender(seed))
      smooth.append(yup(hit+n*.0035) if hit is not None and distance<.01 else segment[i])
     segment[:]=smooth+[segment[-1]]
   # Explicitly retain annotated anchors even at the edge of a projection seam.
   for a in selected:
    pos=Vector(a['position'])
    if min(((point-pos).length for segment in segments for point in segment),default=1)>.009:
     neighbor=min((point for segment in segments for point in segment),key=lambda p:(p-pos).length,default=None)
     if neighbor is not None and (neighbor-pos).length<.03:segments.append([neighbor.lerp(pos,t/8) for t in range(9)])
   for index,points in enumerate(segments):
    role_side='midline' if name in ['ren','du'] else side
    record(variant,m,name,role_side,'primary',index,points,color)
    # Branches fan from a main route then follow the nearest actual surface.
    # Both length and spacing are deterministic; they are decorative, with no extra acupoints.
    for branch,start in enumerate(range(15,len(points)-10,48)):
     end=min(start+15,len(points)-1);tangent=(points[end]-points[start]).normalized()
     surface=tree.find_nearest(blender(points[start]))
     if surface[0] is None:continue
     outward=yup(surface[1]);lateral=tangent.cross(outward)
     if lateral.length<.1:continue
     lateral.normalize();lateral*=(-1 if branch%2 else 1)
     fine=[]
     for k in range(13):
      t=k/12;seed=points[start].lerp(points[end],t)+lateral*(math.sin(t*math.pi*.65)*.012*u)
      hit,n,_,distance=tree.find_nearest(blender(seed))
      if hit is None or distance>.025:break
      point=yup(hit+n*.0038)
      if fine and (point-fine[-1]).length>.025:break
      fine.append(point)
     if len(fine)>3:record(variant,m,name,role_side,'secondary',index*10000+branch,fine,color)
 for item in result:
  if item['variant']!=variant:continue
  for point in item['points']:
   _,_,_,distance=tree.find_nearest(blender(point))
   all_surface_errors.append(distance)
 quality[variant]={'paths':sum(p['variant']==variant for p in result),'max_surface_offset':max(all_surface_errors),'samples':len(all_surface_errors)}
(root/'src/features/meridians/paths.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
(root/'.superpowers/lux3d/path-quality.json').write_text(json.dumps(quality,indent=2))
print('PATHS_COMPLETE',json.dumps(quality),flush=True)
