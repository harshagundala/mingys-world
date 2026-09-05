"""Original golden retriever puppy sculpt, in metres (Blender -Y is forward).

Continuous coat surfaces, a breed-shaped muzzle and folded ear leather replace
separate toy-like primitives. Named joints and eyelid morphs animate in Three.js.
"""
import bpy, math, random, os
from mathutils import Vector
random.seed(17)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, c, rough=.7, metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
# Coat pigment is painted into the mesh and sampled by the real-time strand groom.
fur=mat('Fur golden',(1,1,1),.92)
pigment=fur.node_tree.nodes.new('ShaderNodeVertexColor');pigment.layer_name='Coat pigment'
fur.node_tree.links.new(pigment.outputs['Color'],fur.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
nose=mat('Nose velvet',(.014,.012,.01),.35)
lip=mat('Lip leather',(.041,.029,.023),.65)
mouth=mat('Mouth',(.029,.012,.009),.82)
nostril=mat('Nostril interior',(.0008,.0006,.0004),1)
eye=mat('Eye chocolate',(1,1,1),.18)
eye_pigment=eye.node_tree.nodes.new('ShaderNodeVertexColor');eye_pigment.layer_name='Iris pigment'
eye.node_tree.links.new(eye_pigment.outputs['Color'],eye.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
iris=mat('Amber iris',(.075,.033,.014),.23)
pupil=mat('Pupil',(.003,.002,.001),.13)
lidcoat=mat('Lid coat',(.59,.35,.16),.94)
tongue=mat('Tongue',(.43,.15,.15),.5)
collar=mat('Collar',(.06,.31,.25),.8)
stitch=mat('Stitch',(.61,.53,.37))
gold=mat('Brass tag',(.57,.35,.10),.29,.8)
pads=mat('Paw pads',(.095,.07,.051),.87)
claw=mat('Claw',(.31,.25,.16),.62)
whisker=mat('Whisker',(.25,.19,.12),.8)

def empty(n,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o
root=empty('Puppy')

def mesh(n,verts,faces,m,parent=root):
 data=bpy.data.meshes.new(n);data.from_pydata(verts,[],faces);data.update()
 o=bpy.data.objects.new(n,data);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m)
 for f in data.polygons:f.use_smooth=True
 return o

def ell(n,p,s,m=fur,parent=root,segments=40):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=28)
 o=bpy.context.object;o.name=n;o.parent=parent;o.location=p;o.scale=s;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o

def union(n,parts,parent=root,voxel=.012):
 verts=[];faces=[]
 for o in parts:
  # Blender does not update matrix_basis immediately after transform assignment.
  bpy.context.view_layer.update()
  off=len(verts);verts.extend([o.matrix_basis@v.co for v in o.data.vertices]);faces.extend([tuple(off+i for i in f.vertices) for f in o.data.polygons]);bpy.data.objects.remove(o,do_unlink=True)
 o=mesh(n,verts,faces,fur,parent)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Continuous sculpt','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 sm=o.modifiers.new('Sculpt relaxation','SMOOTH');sm.factor=.8;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=o.modifiers.new('Browser topology','DECIMATE');dec.ratio=.48;bpy.ops.object.modifier_apply(modifier=dec.name)
 for f in o.data.polygons:f.use_smooth=True
 o.select_set(False);return o

def curve(n,pts,r,m,parent=root):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);return o

def blend(a,b,t):
 t=max(0,min(1,t));t=t*t*(3-2*t)
 return tuple(x+(y-x)*t for x,y in zip(a,b))

def paint(o,region):
 bpy.context.view_layer.update()
 attr=o.data.color_attributes.new(name='Coat pigment',type='FLOAT_COLOR',domain='POINT')
 for v in o.data.vertices:
  x,y,z=o.matrix_basis@v.co
  honey=(.58,.34,.145);cream=(.77,.54,.29);toast=(.43,.224,.086)
  if region=='head':
   c=blend(honey,cream,(-y-.18)/.31)
   c=blend(c,cream,max(0,.08-z)*3.5)
  elif region=='ear':
   c=blend(toast,honey,(-z)/.45)
  elif region=='tail':
   c=blend(honey,cream,(-z+.02)*2.2)
  elif region=='leg':
   c=blend(honey,cream,(-z-.18)/.55)
  else:
   c=blend(honey,cream,(-y-.1)*1.1+(.72-z)*.7)
   c=blend(c,toast,max(0,z-.72)*.35)
  variation=1+.022*math.sin(x*27+math.sin(y*11))*math.sin(z*19+y*7)
  attr.data[v.index].color=(*(q*variation for q in c),1)
 return o

# A broad rib cage with a level topline, tucked flank and substantial baby neck.
paint(union('Golden double coat',[
 ell('Rib cage',(0,-.015,.72),(.294,.48,.295)),
 ell('Haunch',(0,.36,.73),(.279,.28,.274)),
 ell('Sternum',(0,-.29,.665),(.25,.245,.278)),
 ell('Withers',(0,-.27,.84),(.26,.235,.245)),
 ell('Ruff',(0,-.405,.93),(.238,.237,.29)),
 ell('Throat',(0,-.466,.805),(.198,.163,.248)),
]),'body')
head=empty('Head',(0,-.477,1.00),root)
# The bridge flows into the skull; the nose projects well ahead of the eye plane.
paint(union('Golden retriever head',[
 ell('Cranium',(0,.026,.209),(.254,.233,.229),parent=head),
 ell('Occiput',(0,.10,.14),(.232,.184,.209),parent=head),
 ell('Temple L',(-.185,-.036,.153),(.105,.173,.158),parent=head),
 ell('Temple R',(.185,-.036,.153),(.105,.173,.158),parent=head),
 ell('Orbital plane L',(-.137,-.13,.245),(.091,.091,.09),parent=head),
 ell('Orbital plane R',(.137,-.13,.245),(.091,.091,.09),parent=head),
 ell('Nasal bridge',(0,-.244,.149),(.139,.205,.094),parent=head),
 ell('Muzzle',(0,-.364,.082),(.154,.139,.080),parent=head),
 ell('Cheek L',(-.143,-.139,.096),(.103,.122,.116),parent=head),
 ell('Cheek R',(.143,-.139,.096),(.103,.122,.116),parent=head),
],head,.009),'head')
# A restrained mouth line follows the jaw, with real flews rather than a smile.
ell('Oral shadow',(0,-.29,.018),(.120,.137,.012),mouth,head)
jaw=empty('Jaw',(0,-.171,.017),head)
paint(union('Lower jaw',[
 ell('Mandible',(0,-.1,-.02),(.126,.166,.051),parent=jaw),
 ell('Chin',(0,-.237,-.010),(.101,.060,.029),parent=jaw),
],jaw,.009),'head')
for side in [-1,1]:
 curve('Lower lip',[(side*.041,-.44,.023),(side*.095,-.409,.014),(side*.132,-.34,.009),(side*.136,-.275,.018)],.0021,lip,head)
# Slightly triangular nose leather with a curved top and narrower central septum.
n=ell('Retriever nose',(0,-.481,.126),(.087,.042,.054),nose,head,64)
for v in n.data.vertices:
 v.co.x*=.86+.16*v.co.z
 v.co.z+=.10*(1-v.co.x*v.co.x)*max(0,-v.co.z)
for side in [-1,1]:
 cutter=ell('Nostril cutter',(side*.048,-.515,.130),(.024,.019,.012),nostril,head,48)
 bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');n.select_set(True);bpy.context.view_layer.objects.active=n
 cut=n.modifiers.new('Recessed nostril','BOOLEAN');cut.operation='DIFFERENCE';cut.solver='EXACT';cut.object=cutter;bpy.ops.object.modifier_apply(modifier=cut.name)
 bpy.data.objects.remove(cutter,do_unlink=True)
 ell('Nostril cavity',(side*.048,-.496,.130),(.024,.010,.012),nostril,head,32)
 curve('Alar fold',[(side*.067,-.503,.128),(side*.065,-.51,.112),(side*.048,-.52,.107)],.0038,nose,head)
curve('Philtrum',[(0,-.512,.092),(0,-.504,.075),(0,-.493,.060)],.0015,lip,head)
# Sparse, tapered whiskers emerge from small follicles, not painted freckles.
for side in [-1,1]:
 for k in range(4):
  x=side*(.113+(k%2)*.016);y=-.426+(k//2)*.029;z=.055+(k%2)*.025
  ell('Follicle',(x,y,z),(.0019,.002,.0018),lip,head,12)
  curve('Whisker',[(x,y,z),(x+side*.047,y-.016,z-.003),(x+side*(.09+k*.013),y+.012,z-.012-k*.006)],.00065,whisker,head)

# Small almond eyes sit under the brow. Only the lids deform when blinking.
def eyelid(parent,side):
 verts=[];closed=[];faces=[];nu=32;nv=5
 for j in range(nv+1):
  t=j/nv
  for i in range(nu+1):
   u=-1+2*i/nu;arch=math.sqrt(max(0,1-u*u))
   x=u*.044;inner=side*.027*arch*(.6+.4*arch)+.003*u
   z=inner+side*.010*arch*t
   y=-.008*arch+.013*t*arch
   verts.append((x,y,z))
   closed.append((x,y-(.029*arch)*(1-t),z-inner*(1-t)))
 for j in range(nv):
  for i in range(nu):
   a=j*(nu+1)+i
   faces.append((a,a+1,a+nu+2,a+nu+1) if side>0 else (a+1,a,a+nu+1,a+nu+2))
 o=mesh('Upper lid' if side>0 else 'Lower lid',verts,faces,lidcoat,parent)
 o.data.materials.append(lip)
 for p in o.data.polygons:
  if p.index<nu:p.material_index=1
 o.shape_key_add(name='Basis');key=o.shape_key_add(name='Blink')
 for v,p in zip(key.data,closed):v.co=p
 return o
for side in [-1,1]:
 orb=empty('BlinkL' if side<0 else 'BlinkR',(side*.150,-.212,.237),head)
 orb.rotation_euler[2]=side*.32
 # A single dark corneal dome, no white sclera or artificial painted catchlights.
 verts=[];faces=[];rings=16;segments=96
 for j in range(rings+1):
  r=j/rings
  for i in range(segments):
   a=i/segments*math.tau;s=math.sin(a)
   verts.append((.044*math.cos(a)*r,.003-.029*(1-r*r),(.027*s*(.6+.4*abs(s))+.003*math.cos(a))*r))
 for j in range(rings):
  for i in range(segments):
   a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b))
 cornea=mesh('Cornea',verts,faces,eye,orb)
 colors=cornea.data.color_attributes.new(name='Iris pigment',type='FLOAT_COLOR',domain='POINT')
 for v in cornea.data.vertices:
  x,y,z=v.co;x/=.044;z/=.032;r=math.sqrt((x+side*.07)**2+(z*.77)**2);a=math.atan2(z,x)
  brown=(.053,.024,.01);black=(.003,.002,.001)
  c=blend(black,brown,(r-.31)/.10)
  c=blend(c,(.009,.006,.003),(r-.60)/.12)
  fleck=1+.11*math.sin(a*39+r*20)*math.sin(a*17-r*27)
  colors.data[v.index].color=(*(q*fleck for q in c),1)
 eyelid(orb,1);eyelid(orb,-1)
 # Ear leather: broad folded triangle with a tapered, rounded tip.
 ear=empty('EarL' if side<0 else 'EarR',(side*.224,.025,.292),head)
 verts=[];faces=[];rings=28;seg=32
 for j in range(rings+1):
  t=j/rings
  width=(.022+.101*math.sin(math.pi*t)**.65)*(1-.33*t)
  centerx=side*(.009+.072*math.sin(t*math.pi*.86))
  centery=.018-.045*math.sin(math.pi*t*.9)
  zz=-.315*t
  thickness=.018*math.sin(math.pi*t)**.5+.005
  for i in range(seg):
   a=i/seg*math.tau
   # width lies diagonally over the cheek; leather folds across its front face.
   across=math.cos(a)*width
   verts.append((centerx+side*across*.38,centery+across*.92+math.sin(a)*thickness,zz+.017*math.cos(a)*math.sin(math.pi*t)))
 for j in range(rings):
  for i in range(seg):
   a=j*seg+i;b=j*seg+(i+1)%seg;faces.append((a,b,b+seg,a+seg))
 faces.extend([tuple(reversed(range(seg))),tuple(rings*seg+i for i in range(seg))])
 o=mesh('Folded retriever ear',verts,faces,fur,ear)
 # Mirroring coordinates changes winding. Recalculate before exporting.
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 paint(o,'ear')

# Strong straight forelegs; hind legs bend through the stifle and hock.
for side in [-1,1]:
 for front in [True,False]:
  leg=empty(('Front' if front else 'Back')+('L' if side<0 else 'R'),(side*.216,-.29 if front else .354,.58),root)
  if front:
   parts=[ell('Upper foreleg',(-side*.018,.009,-.055),(.086,.109,.232),parent=leg),ell('Forearm',(0,-.014,-.252),(.077,.083,.18),parent=leg)]
  else:
   parts=[ell('Thigh',(-side*.030,-.008,-.02),(.113,.157,.239),parent=leg),ell('Stifle',(0,-.074,-.186),(.089,.12,.128),parent=leg),ell('Hock',(0,.024,-.313),(.065,.072,.134),parent=leg)]
  parts.extend([ell('Pastern',(0,-.018,-.383),(.075,.076,.095),parent=leg),ell('Paw',(0,-.058,-.453),(.105,.139,.085),parent=leg)])
  for k in range(4):
   x=(k-1.5)*.047;advance=.158-(.018 if k in [0,3] else 0)
   parts.append(ell('Toe',(x,-advance,-.461),(.035,.058,.057),parent=leg))
   ell('Claw',(x,-advance-.047,-.464),(.009,.021,.009),claw,leg,16)
   ell('Toe pad',(x,-advance+.025,-.520),(.022,.031,.006),pads,leg,16)
  paint(union('Foreleg and paw' if front else 'Hind leg and paw',parts,leg,.009),'leg')
  ell('Metacarpal pad',(0,-.045,-.526),(.050,.06,.006),pads,leg,20)
# A tapered, gently swept tail carried behind the body, with longer underside feathering.
tail=empty('Tail',(0,.565,.823),root)
paint(union('Retriever tail',[
 ell('Tail segment',(0,t*.62,.032*math.sin(t*math.pi)-.15*t*t),(.075*(1-t)+.018,.096*(1-t)+.028,.067*(1-t)+.014),parent=tail)
 for t in [i/12 for i in range(13)]
],tail,.01),'tail')
# Collar sits beneath the ruff. A smaller engraved tag retains the personal touch.
bpy.ops.mesh.primitive_torus_add(major_radius=.213,minor_radius=.024,major_segments=64,minor_segments=12)
o=bpy.context.object;o.name='Leather collar';o.parent=root;o.location=(0,-.383,.882);o.rotation_euler[0]=math.pi/2;o.data.materials.append(collar)
for i in range(36):
 a=math.tau*i/36
 for band in [-1,1]:ell('Collar stitch',(.233*math.cos(a),-.383+band*.014,.882+.233*math.sin(a)),(.005,.004,.0025),stitch,segments=8)
curve('Tag ring',[(-.016,-.617,.765),(-.018,-.638,.729),(0,-.647,.72),(.018,-.638,.729),(.016,-.617,.765)],.005,gold)
ell('Engraved tag',(0,-.654,.683),(.048,.008,.052),gold)
for x,z,r in [(0,.675,.013),(-.019,.698,.008),(0,.709,.008),(.019,.698,.008)]:ell('Paw engraving',(x,-.663,z),(r,.001,r),lip,segments=12)
bpy.ops.object.text_add();o=bpy.context.object;o.name='Mingy engraving';o.data.body='M';o.data.size=.026;o.data.align_x='CENTER';o.data.extrude=.0007;o.data.materials.append(stitch);o.parent=root;o.location=(0,-.664,.646);o.rotation_euler=(math.pi/2,0,0)
# Put role accessories on real attachment points so they follow head motion.
empty('BowAnchor',(.232,-.004,.31),head)
# Consolidate static decorations, preserving morph targets and coat paint.
for o in list(bpy.context.scene.objects):
 if o.type in ['CURVE','FONT']:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
groups={}
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and not o.data.shape_keys:
  groups.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name),[]).append(o)
for key,objects in groups.items():
 if len(objects)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=key[0]+' '+key[1]
os.makedirs('public/models',exist_ok=True);os.makedirs('output/anatomy',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/models/puppy-v4.glb'),export_format='GLB',export_yup=True,export_morph=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('output/anatomy/puppy-sculpt-v4.blend'))
print('RETRIEVER SCULPT EXPORTED')
