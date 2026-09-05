"""Original groomed golden retriever: sculpted surfaces, articulated face and hand-built accessories."""
import bpy, math, random, os
from mathutils import Vector
random.seed(17)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
fur=mat('Fur honey',(.66,.36,.12));cream=mat('Fur champagne',(.9,.69,.4));earfur=mat('Fur caramel',(.43,.21,.067));nose=mat('Nose velvet',(.035,.022,.018),.32);mouth=mat('Mouth',(.09,.032,.026),.65);iris=mat('Amber iris',(.2,.082,.021),.24);pupil=mat('Pupil',(.006,.004,.003),.1);eye=mat('Eye chocolate',(.036,.018,.009),.11);glint=mat('Catchlight',(1,.98,.92),.07);tongue=mat('Tongue',(.66,.23,.27),.4);collar=mat('Collar',(.06,.31,.25),.65);stitch=mat('Stitch',(.87,.78,.55));gold=mat('Brass tag',(.77,.49,.13),.24,.8);pads=mat('Paw pads',(.24,.14,.11),.85)
def empty(n,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o
root=empty('Puppy')
def ell(n,p,s,m,parent=root,segments=32):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=20);o=bpy.context.object;o.name=n;o.parent=parent;o.location=p;o.scale=s;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
def union(n,parts,m,parent):
 verts=[];faces=[]
 for o in parts:
  off=len(verts);verts.extend([o.matrix_basis@v.co for v in o.data.vertices]);faces.extend([tuple(off+i for i in f.vertices) for f in o.data.polygons]);bpy.data.objects.remove(o,do_unlink=True)
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 mod=o.modifiers.new('Sculpted union','REMESH');mod.mode='VOXEL';mod.voxel_size=.022;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 sm=o.modifiers.new('Surface relaxation','SMOOTH');sm.factor=1.15;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=o.modifiers.new('Efficient sculpt','DECIMATE');dec.ratio=.65;bpy.ops.object.modifier_apply(modifier=dec.name)
 for f in o.data.polygons:f.use_smooth=True
 o.select_set(False);return o
def curve(n,pts,r,m,parent=root):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);return o
body=union('Sculpted coat',[ell('ribcage',(0,.03,.69),(.315,.49,.335),fur),ell('rump',(0,.37,.67),(.315,.25,.32),fur),ell('shoulders',(0,-.28,.72),(.33,.24,.36),fur),ell('neck',(0,-.39,.88),(.27,.23,.31),fur)],fur,root)
ell('Chest bib',(0,-.397,.69),(.258,.112,.285),cream)
head=empty('Head',(0,-.465,.98),root)
face=union('Sculpted face',[ell('skull',(0,.005,.17),(.31,.265,.30),fur,head),ell('brow',(-.16,-.16,.265),(.16,.14,.15),fur,head),ell('brow',(.16,-.16,.265),(.16,.14,.15),fur,head),ell('cheek',(-.22,-.125,.05),(.12,.145,.155),fur,head),ell('cheek',(.22,-.125,.05),(.12,.145,.155),fur,head)],fur,head)
ell('Muzzle foundation',(0,-.24,.07),(.205,.19,.118),cream,head)
ell('Smile shadow',(0,-.29,-.013),(.154,.105,.056),mouth,head)
ell('Lower chin',(0,-.23,-.05),(.158,.105,.051),cream,head)
ell('Left muzzle',(-.076,-.309,.063),(.11,.101,.068),cream,head);ell('Right muzzle',(.076,-.309,.063),(.11,.101,.068),cream,head)
nt=ell('Heart shaped nose',(0,-.393,.127),(.085,.043,.053),nose,head);nt.rotation_euler[0]=-.12
for side in [-1,1]:
 ell('Nostril',(side*.047,-.430,.13),(.021,.008,.011),pupil,head)
 curve('Smile crease',[(side*.014,-.405,.075),(side*.026,-.408,.022),(side*.095,-.367,-.006),(side*.15,-.30,.013)],.006,mouth,head)
 ell('Eye rim',(side*.178,-.267,.255),(.070,.006,.068),nose,head)
 blink=empty('BlinkL' if side<0 else 'BlinkR',(side*.178,-.275,.257),head)
 ell('Wet eye',(0,0,0),(.064,.020,.061),eye,blink)
 ell('Amber iris',(side*-.007,-.017,.001),(.045,.006,.048),iris,blink)
 ell('Round pupil',(side*-.008,-.024,.004),(.030,.004,.038),pupil,blink)
 for k in range(12):
  a=k*math.tau/12;ell('Iris fleck',(math.cos(a)*.038-side*.007,-.025,math.sin(a)*.041),(.0017,.0009,.004),iris,blink,12)
 ell('Large eye glint',(-.017,-.029,.026),(.009,.004,.010),glint,blink,16);ell('Soft eye glint',(.018,-.029,-.019),(.004,.002,.004),glint,blink,12)
 curve('Expressive eyebrow',[(side*.105,-.20,.347),(side*.173,-.227,.359),(side*.23,-.188,.329)],.024,cream,head)
 ear=empty('EarL' if side<0 else 'EarR',(side*.266,.02,.276),head)
 union('Silky floppy ear',[ell('ear',(side*.046,.02,-.15),(.10,.152,.237),earfur,ear),ell('ear tip',(side*.052,.02,-.302),(.074,.114,.088),earfur,ear)],earfur,ear)
 # Silky ear feathering is supplied by the strand groom.
 for k in range(3):
  curve('Whisker',[(side*.11,-.385,.042-k*.015),(side*.20,-.36,.05-k*.024),(side*(.29+k*.02),-.30,.067-k*.026)],.0014,stitch,head)
  ell('Whisker pore',(side*(.13-k*.018),-.394,.058-k*.018),(.004,.003,.004),nose,head,12)
 # The real-time groom now supplies cheek feathering without solid clumps.
jaw=empty('Jaw',(0,-.255,-.036),head)
ell('Little tongue',(0,-.072,-.017),(.047,.06,.012),tongue,jaw);curve('Tongue groove',[(0,-.124,-.004),(0,-.084,-.003)],.0017,mouth,jaw)
for side in [-1,1]:
 for front in [True,False]:
  leg=empty(('Front' if front else 'Back')+('L' if side<0 else 'R'),(side*.218,-.30 if front else .345,.53),root)
  union('Feathered leg',[ell('upper',(0,0,-.11),(.107,.12,.22),fur,leg),ell('ankle',(0,-.025,-.26),(.086,.096,.155),fur,leg)],fur,leg)
  ell('Soft paw',(0,-.073,-.395),(.127,.167,.09),cream,leg)
  for k in range(3):
   ell('Toe',(k*.06-.06,-.185,-.4),(.037,.048,.051),cream,leg)
   ell('Tiny nail',(k*.06-.06,-.223,-.396),(.012,.02,.009),stitch,leg,12)
   ell('Toe pad',(k*.06-.06,-.153,-.467),(.024,.031,.009),pads,leg,12)
  ell('Heart paw pad',(0,-.043,-.474),(.063,.06,.009),pads,leg)
tail=empty('Tail',(0,.51,.76),root)
union('Feathered tail',[ell('tail section',(0,j*.073,j*.052),(.096-j*.009,.115,.085-j*.007),fur if j<4 else cream,tail) for j in range(7)],fur,tail)
# The tail's soft plume is made of individual curved guard hairs in the browser.
# Leather collar, two rows of embroidery, buckle and engraved tag.
bpy.ops.mesh.primitive_torus_add(major_radius=.238,minor_radius=.033,major_segments=64,minor_segments=12);o=bpy.context.object;o.name='Leather collar';o.parent=root;o.location=(0,-.355,.815);o.rotation_euler[0]=math.pi/2;o.data.materials.append(collar)
for i in range(32):
 a=math.tau*i/32
 for band in [-1,1]:ell('Collar stitch',(.263*math.cos(a),-.355+band*.020,.815+.263*math.sin(a)),(.008,.006,.004),stitch,segments=8)
curve('Tag ring',[(-.023,-.61,.745),(-.025,-.625,.71),(0,-.631,.695),(.025,-.625,.71),(.023,-.61,.745)],.008,gold)
ell('Engraved tag',(0,-.632,.647),(.071,.012,.075),gold)
for x,z,r in [(0,.63,.019),(-.028,.66,.012),(0,.677,.012),(.028,.66,.012)]:ell('Paw engraving',(x,-.646,z),(r,.002,r),nose,segments=12)
bpy.ops.object.text_add();o=bpy.context.object;o.name='Mingy engraving';o.data.body='M';o.data.size=.04;o.data.align_x='CENTER';o.data.extrude=.001;o.data.materials.append(stitch);o.parent=root;o.location=(0,-.647,.595);o.rotation_euler=(math.pi/2,0,0)
# Consolidate static decoration by parent and material to keep draw calls low.
for o in list(bpy.context.scene.objects):
 if o.type in ['CURVE','FONT']:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
groups={}
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':groups.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name),[]).append(o)
for key,objects in groups.items():
 if len(objects)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=key[0]+' '+key[1]
os.makedirs('public/models',exist_ok=True);os.makedirs('output/v2',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/models/puppy-v3.glb'),export_format='GLB',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('output/v2/puppy-sculpt-v3.blend'))
print('SCULPT EXPORTED')
