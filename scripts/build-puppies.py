import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
fur=mat('Honey gold',(0.72,.39,.105)); light=mat('Warm cream',(.95,.72,.39)); ears=mat('Toasted ears',(.52,.25,.065)); nose=mat('Velvet nose',(.055,.035,.023),.32); eyes=mat('Chocolate eyes',(.055,.03,.011),.08); white=mat('Eye sparkle',(1,.97,.82),.12); collar=mat('Collar',(.12,.38,.34),.4); metal=mat('Brass tag',(.85,.57,.12),.3,.65)
def empty(n,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None); bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o
root=empty('Puppy')
def ell(n,p,s,m,parent=root):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(0,0,0));o=bpy.context.object;o.name=n;o.parent=parent;o.location=p;o.scale=s;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
ell('Body',(0,0,.63),(.32,.53,.34),fur)
ell('Chest',(0,-.3,.66),(.31,.27,.38),light)
head=empty('Head',(0,-.45,.9),root)
ell('Face',(0,-.015,.18),(.32,.29,.31),fur,head)
ell('MuzzleL',(-.105,-.255,.095),(.14,.155,.11),light,head);ell('MuzzleR',(.105,-.255,.095),(.14,.155,.11),light,head)
ell('Nose',(0,-.395,.15),(.095,.055,.06),nose,head)
ell('Chin',(0,-.25,.005),(.18,.12,.06),light,head)
for side in [-1,1]:
 ell('EyeR' if side>0 else 'EyeL',(side*.174,-.252,.255),(.052,.032,.066),eyes,head)
 ell('Catchlight',(side*.166,-.278,.278),(.014,.01,.016),white,head)
 ell('Brow',(side*.17,-.231,.33),(.078,.04,.03),light,head)
 ear=empty('EarL' if side<0 else 'EarR',(side*.26,.0,.23),head)
 e=ell('Floppy ear',(side*.045,.015,-.13),(.115,.16,.255),ears,ear);e.rotation_euler[1]=side*.18
 for j in range(4):
  e=ell('Ear feather',(side*.05+(j-1.5)*.035,.02,-.285-(j%2)*.025),(.03,.065,.07),fur,ear);e.rotation_euler[1]=side*.18
 for k in range(3):
  e=ell('Cheek fluff',(side*(.248+k*.024),-.105,.075-k*.052),(.07,.075,.07),light,head)
for side in [-1,1]:
 for front in [True,False]:
  y=-.31 if front else .32
  leg=empty(('Front' if front else 'Back')+('L' if side<0 else 'R'),(side*.22,y,.51),root)
  ell('Leg',(0,0,-.135),(.1,.115,.225),fur,leg)
  ell('Paw',(0,-.05,-.385),(.125,.175,.105),light,leg)
  for k in range(3):ell('Toe',(k*.064-.064,-.16,-.398),(.036,.057,.042),light,leg)
tail=empty('Tail',(0,.43,.72),root)
for j in range(6):
 e=ell('Tail fur',(0,j*.078,.015+j*.058),(.1-j*.01,.13-j*.009,.095-j*.009),fur if j<4 else light,tail);e.rotation_euler[0]=-.6
# Collar torus around neck, emblem at chest
bpy.ops.mesh.primitive_torus_add(major_radius=.238,minor_radius=.035,major_segments=40,minor_segments=12);o=bpy.context.object;o.name='Collar';o.parent=root;o.location=(0,-.355,.79);o.rotation_euler[0]=math.pi/2;o.data.materials.append(collar)
ell('Tag',(0,-.605,.64),(.065,.024,.065),metal)
# Small embroidered scarf end, elegant rather than costume
ell('Scarf knot',(.24,-.35,.75),(.068,.07,.07),collar)
for i in range(2):
 e=ell('Scarf tail',(.25+i*.05,-.29,.68-i*.04),(.037,.09,.11),collar);e.rotation_euler[1]=-.4
# export up conversion glTF maps Blender Z to Y
os.makedirs('public/models',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/models/puppy.glb'),export_format='GLB',use_selection=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('output/puppy.blend'))
print('PUPPY ASSET COMPLETE')
