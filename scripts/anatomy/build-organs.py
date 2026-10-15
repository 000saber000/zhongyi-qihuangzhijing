"""Original, simplified visceral teaching meshes, in metres and exported Y-up.
This is a spatial illustration, not patient anatomy. No external organ assets.
blender -b -t 3 --python scripts/anatomy/build-organs.py -- --root .
"""
import bpy, math, sys, argparse
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--root',required=True)
root=Path(p.parse_args(sys.argv[sys.argv.index('--')+1:]).root).resolve()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def mat(name,color,rough=.38):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Roughness'].default_value=rough
 return m
lung=mat('Rose quartz lungs',(.65,.34,.29));heart=mat('Cinnabar heart',(.52,.12,.095))
liver=mat('Warm umber liver',(.39,.18,.105));stomach=mat('Amber stomach',(.66,.39,.17))
gut=mat('Sandstone intestines',(.62,.40,.23));vessel=mat('Golden visceral vessels',(.65,.44,.19))
def smooth(o,material):
 o.data.materials.append(material)
 if o.type=='MESH':
  for f in o.data.polygons:f.use_smooth=True
 return o
def ellipsoid(name,pos,scale,material,deform=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=(pos[0],-pos[2],pos[1]))
 o=bpy.context.object;o.name=name
 for v in o.data.vertices:
  x,y,z=v.co
  if deform:x,y,z=deform(x,y,z)
  v.co=(x*scale[0],y*scale[2],z*scale[1])
 return smooth(o,material)
def tube(name,points,radius,material,radii=None):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=radius;c.bevel_resolution=3
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for i,(b,point) in enumerate(zip(s.bezier_points,points)):
  b.co=(point[0],-point[2],point[1]);b.handle_left_type='AUTO';b.handle_right_type='AUTO'
  if radii:b.radius=radii[i]
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);smooth(o,material)
 return o
# Paired lungs taper at the apex, widen toward the diaphragm and curve at the hilum.
for sign,side in [(-1,'Right'),(1,'Left')]:
 def lung_shape(x,y,z):
  width=.78-.25*z
  return x*width+sign*.16*z,y*(.9-.15*z),z
 o=ellipsoid(side+' lung',(sign*.079,1.317,-.005),(.075,.135,.060),lung,lung_shape)
 # Fine, shallow lobe fissures remain discrete meshes.
 tube(side+' oblique fissure',[(sign*.035,1.34,.044),(sign*.082,1.30,.048),(sign*.134,1.27,.025)],.0009,liver)
 if sign<0:tube('Right horizontal fissure',[(-.029,1.315,.046),(-.076,1.314,.055),(-.132,1.317,.037)],.0008,liver)
tube('Trachea',[(0,1.51,-.014),(0,1.43,-.016),(0,1.365,-.017)],.009,vessel)
for sign in [-1,1]:tube('Bronchus',[(0,1.37,-.014),(sign*.025,1.348,-.012),(sign*.05,1.326,-.008)],.0065,vessel)
for i in range(11):
 z=1.4+i*.008
 bpy.ops.mesh.primitive_torus_add(major_radius=.0092,minor_radius=.0009,major_segments=20,minor_segments=6,location=(0,.014,z));smooth(bpy.context.object,stomach)
# Oblique ventricular mass, atria, and arch with three great-vessel branches.
h=ellipsoid('Heart ventricles',(.025,1.275,.045),(.047,.070,.040),heart,lambda x,y,z:(x*(.84+.17*z),y*(.9+.1*z),z))
h.rotation_euler[1]=-.31
for x in [-.005,.036]:ellipsoid('Heart atrium',(x,1.321,.038),(.024,.023,.026),heart)
tube('Aortic arch',[(.009,1.30,.045),(.008,1.355,.03),(-.012,1.38,.0),(-.035,1.345,-.034),(-.03,1.205,-.05)],.010,heart)
for x in [-.016,0,.016]:tube('Arch branch',[(x-.009,1.365,.005),(x-.009,1.412,.002)],.004,heart)
tube('Pulmonary trunk',[(.035,1.31,.062),(.04,1.35,.025),(.078,1.35,.0)],.008,vessel)
tube('Coronary vessel',[(.021,1.32,.082),(.033,1.285,.084),(.04,1.24,.068)],.0016,vessel)
# Liver extends mostly to anatomical right; stomach sits to anatomical left.
ellipsoid('Liver right lobe',(-.062,1.187,.004),(.101,.051,.063),liver,lambda x,y,z:(x,y,z*(.8 if z<0 else 1)))
ellipsoid('Liver left lobe',(.026,1.194,.015),(.075,.028,.045),liver)
ellipsoid('Gallbladder',(-.06,1.15,.043),(.013,.026,.012),mat('Olive gallbladder',(.27,.35,.13)))
tube('Esophagus',[(0,1.365,-.047),(.012,1.24,-.045),(.055,1.205,-.015)],.006,stomach)
tube('Stomach',[(.054,1.211,-.01),(.081,1.183,.005),(.083,1.139,.014),(.042,1.12,.028),(.009,1.145,.03)],.025,stomach,[.50,.95,1.2,.8,.30])
ellipsoid('Pancreas',(.005,1.136,-.035),(.072,.014,.018),stomach)
for sign,side in [(-1,'Right'),(1,'Left')]:
 ellipsoid(side+' kidney',(sign*.074,1.102,-.063),(.024,.048,.024),liver,lambda x,y,z:(x*(.9-.2*math.cos(z*math.pi)),y,z))
 tube(side+' ureter',[(sign*.066,1.09,-.058),(sign*.048,1.015,-.06),(sign*.02,.925,-.01)],.0028,vessel)
# Intestinal loops occupy the central abdomen; colon frames them.
for row in range(6):
 y=1.09-row*.024
 points=[(-.066+col*.022,y+.010*math.sin(col*2.3+row),.017+.018*math.sin(col*1.7+row)) for col in range(7)]
 tube('Small intestine loop '+str(row),points,.010,gut)
colon=[(-.094,.964,.005),(-.105,1.024,.006),(-.10,1.102,.006),(-.04,1.116,.01),(.04,1.11,.01),(.102,1.10,.006),(.103,1.015,.003),(.073,.96,.014),(.028,.946,.021),(0,.919,-.004)]
tube('Large intestine',colon,.014,gut)
for i in range(len(colon)-1):
 a,b=Vector(colon[i]),Vector(colon[i+1]);n=max(2,int((a-b).length/.017))
 for j in range(n):
  q=a.lerp(b,j/n);ellipsoid('Colon haustrum',q,(.015,.014,.014),gut)
ellipsoid('Bladder',(0,.916,-.01),(.029,.031,.025),stomach)
# Freeze curves and all transforms for a portable, offline GLB.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Collapse the layer into one material-grouped mesh and enforce the same 50k budget
# as each body. The visible teaching contours remain independent disconnected islands.
objects=list(bpy.context.selected_objects);bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join();o=bpy.context.object;o.name='Visceral teaching layer'
o.data.calc_loop_triangles();triangles=len(o.data.loop_triangles)
if triangles>42000:
 m=o.modifiers.new('Whole layer web budget','DECIMATE');m.ratio=42000/triangles;bpy.ops.object.modifier_apply(modifier=m.name)
out=root/'src/assets/anatomy/viscera-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/model-sources/viscera-v1.blend'),compress=True)
print('ORGANS_COMPLETE',out)
