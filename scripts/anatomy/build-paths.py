"""Project independently drawn meridian teaching routes onto both refined bodies.
Routes illustrate major surface relationships, omitting internal branches.
blender -b --python scripts/anatomy/build-paths.py -- --root .
"""
import bpy,json,sys,argparse,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
p=argparse.ArgumentParser();p.add_argument('--root',required=True)
root=Path(p.parse_args(sys.argv[sys.argv.index('--')+1:]).root).resolve()
manifest=json.loads((root/'src/assets/anatomy/models.manifest.json').read_text());result=[]
def blender(v):return Vector((v[0],-v[2],v[1]))
def yup(v):return [round(v[0],6),round(v[2],6),round(-v[1],6)]
for variant,m in manifest.items():
 bpy.ops.wm.open_mainfile(filepath=str(root/f'art/model-sources/{m["id"]}.blend'))
 tree=BVHTree.FromObject(bpy.data.objects['TeachingBody'],bpy.context.evaluated_depsgraph_get())
 j={k:Vector(v) for k,v in m['joints'].items()};u=m['height']/1.78
 for sign,side in [(1,'left'),(-1,'right')]:
  letter='l' if sign>0 else 'r'
  shoulder,elbow,hand,knee,ankle=[j[f'joint-{letter}-{n}'] for n in ['shoulder','elbow','hand','knee','ankle']]
  def v(x,y,z=0):return Vector((sign*x*u,y*u,z*u))
  def arm(offset=0):return [shoulder+v(offset,0),shoulder.lerp(elbow,.5)+v(offset,0),elbow+v(offset,0),elbow.lerp(hand,.5)+v(offset,0),hand+v(offset,0)]
  def leg(offset=0):return [knee+v(offset,0),knee.lerp(ankle,.3)+v(offset,0),knee.lerp(ankle,.65)+v(offset,0),ankle+v(offset,0),ankle+v(offset,-.035,.07)]
  routes=[
   ('stomach',[v(.026,1.67),v(.035,1.57),v(.065,1.44),v(.065,1.29),v(.058,1.12),v(.065,.99),knee.lerp(v(.1,.89),.7),*leg(.021)],'front','#ebca7d'),
   ('spleen',[v(.125,1.32),v(.095,1.21),v(.061,1.08),v(.05,.94),*leg(-.019)],'front','#b5d9bd'),
   ('kidney',[v(.036,1.42),v(.025,1.27),v(.02,1.12),v(.023,.94),*leg(-.030)],'front','#9bcfd1'),
   ('liver',[v(.11,1.26),v(.07,1.18),v(.04,1.05),v(.035,.92),*leg(-.009)],'front','#dbb975'),
   ('gallbladder',[v(.07,1.69),v(.07,1.59),shoulder.lerp(v(.12,1.35),.5),v(.13,1.2),v(.13,1.04),v(.155,.87),*leg(.032)],'side','#d6c485'),
   ('bladder',[v(.045,1.7),v(.035,1.56),v(.048,1.43),v(.045,1.3),v(.05,1.13),v(.07,.96),*leg(.0)],'back','#a9d5c4'),
   ('lung',[v(.08,1.4),*arm(-.008)],'front','#e6c983'),
   ('pericardium',[v(.08,1.34),v(.13,1.38),*arm(-.022)],'front','#efce8d'),
   ('heart',[v(.09,1.33),v(.14,1.37),*arm(-.035)],'front','#b7dbcb'),
   ('largeintestine',[v(.028,1.62),v(.07,1.51),*arm(.01)],'side','#d2c68d'),
   ('sanjiao',[v(.075,1.65),v(.085,1.54),*arm(.0)],'back','#9ad1cf'),
   ('smallintestine',[v(.07,1.60),v(.09,1.46),*arm(-.015)],'back','#e0be7a')]
  if sign==1:routes.extend([('ren',[v(0,y) for y in [.92,1.02,1.14,1.27,1.40,1.50,1.55]],'front','#f1d79b'),('du',[v(0,y) for y in [.94,1.09,1.24,1.4,1.53,1.65,1.73]],'back','#dcca88')])
  for name,seeds,view,color in routes:
   samples=[];segments=[]
   def flush():
    if len(samples)>1:segments.append(samples[:])
    samples.clear()
   for index in range(len(seeds)-1):
    steps=max(8,math.ceil((seeds[index]-seeds[index+1]).length/.012))
    for step in range(steps):
     seed=seeds[index].lerp(seeds[index+1],step/steps)
     # Front and back rays intersect the actual silhouette; lateral routes prefer its outside.
     direction=Vector((sign*.75,0,.65)).normalized() if view=='side' else Vector((0,0,-1 if view=='back' else 1))
     origin=blender(seed+direction*.55);hit,normal,_,_=tree.ray_cast(origin,blender(-direction),1.1)
     if hit is None:
      flush();continue
     if normal.dot(blender(direction))<0:normal=-normal
     point=yup(hit+normal*.004)
     if samples and (Vector(point)-Vector(samples[-1])).length>.04:flush()
     samples.append(point)
   flush()
   for segment,points in enumerate(segments):
    result.append({'meridianId':'meridian-'+name,'segment':segment,'variant':variant,'side':'midline' if name in ['ren','du'] else side,'modelId':m['id'],'modelSha256':m['sha256'],'color':color,'points':points,'review':{'source':'project:src/data/meridian-art.ts','section':'Original main surface teaching schematic; internal branches omitted; projected onto the actual model, non-clinical.','checkedAt':'2026-10-15'}})
(root/'src/features/meridians/paths.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('PATHS_COMPLETE',len(result))
