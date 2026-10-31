"""Original wildlife assets. Run with Blender --background --python scripts/build-autumn-wildlife.py.
Anatomical volumes are voxel-unioned, smoothed, UV unwrapped, and exported with
articulated rigid joints and embedded original fur textures. No external assets.
"""
import bpy, math, os, numpy as np
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/autumn')
os.makedirs(OUT,exist_ok=True)
def reset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def P(p):return (p[0],-p[2],p[1])
def mat(name,color,rough=.85,fur=False):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    if fur:
        rng=np.random.default_rng(420+len(name));n=256
        # Dense directional fibres, with low-contrast undercoat and tips.
        noise=rng.random((n,n));streak=np.zeros((n,n))
        for i in range(7):streak+=np.roll(noise,i,axis=0)/(7+i*.15)
        streak=(streak-streak.min())/(streak.max()-streak.min())
        mottled=rng.random((n//16,n//16));mottled=np.repeat(np.repeat(mottled,16,0),16,1)
        from math import pi
        val=.92+streak*.14
        pixels=np.ones((n,n,4),dtype=np.float32)
        for k in range(3):pixels[:,:,k]=np.clip(val*color[k],0,1)
        image=bpy.data.images.new(name+' fibres',width=n,height=n,alpha=True);image.pixels.foreach_set(pixels.ravel());image.pack()
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
    return m

def empty(name,p,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=P(p)
    if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
    bpy.context.view_layer.update();return o

def ellipsoid(name,p,s,material,parent=None,rot=0,segments=28,rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=P(p));o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.rotation_euler[0]=-rot
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for poly in o.data.polygons:poly.use_smooth=True
    if material:o.data.materials.append(material)
    if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o

def union(name,objects,material,parent=None,voxel=.018):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    rem=o.modifiers.new('Joined anatomical volumes','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=o.modifiers.new('Surface relaxation','SMOOTH');sm.factor=.8;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=o.modifiers.new('Browser mesh budget','DECIMATE');dec.ratio=.48;bpy.ops.object.modifier_apply(modifier=dec.name)
    o.data.materials.clear();o.data.materials.append(material)
    o.data.validate(clean_customdata=False)
    for poly in o.data.polygons:poly.use_smooth=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
    if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o

def ear(name,p,height,width,material,inside,parent,lean=0):
    pivot=empty(name,p,parent)
    # Tapered leaf-shaped cartilage, fuller in the middle and rounded at its tip.
    verts=[];faces=[];levels=9;around=12
    for j in range(levels):
        t=j/(levels-1);w=max(.001,math.sin(t*math.pi)**.75*width)
        for i in range(around):
            a=i/around*2*math.pi
            verts.append(P((p[0]+math.cos(a)*w+lean*t,p[1]+height*t,p[2]+math.sin(a)*w*.35)))
    for j in range(levels-1):
        for i in range(around):faces.append((j*around+i,j*around+(i+1)%around,(j+1)*around+(i+1)%around,(j+1)*around+i))
    mesh=bpy.data.meshes.new(name+' sculpt');mesh.from_pydata(verts,[],faces);mesh.materials.append(material)
    obj=bpy.data.objects.new(name+' outer',mesh);bpy.context.collection.objects.link(obj)
    for poly in mesh.polygons:poly.use_smooth=True
    sub=obj.modifiers.new('Soft cartilage','SUBSURF');sub.levels=1;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=sub.name)
    obj.parent=pivot;obj.matrix_parent_inverse=pivot.matrix_world.inverted()
    ellipsoid(name+' inner',(p[0]+lean*.48,p[1]+height*.5,p[2]+width*.28),(width*.57,height*.33,.009),inside,pivot,segments=20,rings=12)
    return pivot


def rigify(kind,root,coat):
    names=['Neck' if kind=='deer' else 'Head','EarL','EarR','FrontL','FrontR','HindL','HindR','Tail']
    if kind=='deer':names+=['FrontLLower','FrontRLower','HindLLower','HindRLower']
    old={n:bpy.data.objects[n] for n in names}
    positions={n:o.matrix_world.translation.copy() for n,o in old.items()}
    owners={}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        p=o.parent
        while p and p.name not in names:p=p.parent
        owners[o.name]=p.name if p else 'Root'
    skin=[o for o in list(bpy.context.scene.objects) if o.type=='MESH' and o.data.materials and o.data.materials[0]==coat]
    body=union('Continuous coat',skin,coat,root,.011 if kind=='deer' else .0075)
    rig_data=bpy.data.armatures.new(kind+' anatomy rig');rig=bpy.data.objects.new(kind+' skeleton',rig_data);bpy.context.collection.objects.link(rig);rig.parent=root
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    base=rig_data.edit_bones.new('Root');base.head=P((0,.8 if kind=='deer' else .2,0));base.tail=P((0,1.1 if kind=='deer' else .4,0))
    for n in names:
        bone=rig_data.edit_bones.new(n);bone.head=positions[n]
        if n=='Neck':bone.tail=P((0,1.78,.77))
        elif n=='Head':bone.tail=P((0,.57,.36))
        elif n.startswith('Ear'):bone.tail=positions[n]+Vector(P(((-1 if n=='EarL' else 1)*(.15 if kind=='deer' else .065),.28 if kind=='deer' else .3,0)))
        elif n.endswith('Lower'):bone.tail=Vector((positions[n].x,positions[n].y-.035,.05))
        elif n in ['FrontL','FrontR','HindL','HindR']:
            if kind=='deer':bone.tail=positions[n+'Lower']
            elif n.startswith('Front'):bone.tail=P(((-1 if n.endswith('L') else 1)*.1,.045,.31))
            else:bone.tail=P(((-1 if n.endswith('L') else 1)*.15,.052,-.06))
        else:bone.tail=positions[n]+Vector(P((0,-.03,-.16)))
    for n in names:
        parent='Neck' if n.startswith('Ear') and kind=='deer' else 'Head' if n.startswith('Ear') else n[:-5] if n.endswith('Lower') else 'Root'
        rig_data.edit_bones[n].parent=rig_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    # Heat weights blend neck/shoulder and hip/knee deformation across one surface.
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or o==body:continue
        owner=owners.get(o.name,'Root');matrix=o.matrix_world.copy();o.parent=rig;o.matrix_world=matrix
        vg=o.vertex_groups.new(name=owner);vg.add(list(range(len(o.data.vertices))),1.,'REPLACE')
        modifier=o.modifiers.new('Anatomical attachment','ARMATURE');modifier.object=rig
    for o in old.values():bpy.data.objects.remove(o,do_unlink=True)
    bpy.context.view_layer.update()

def export(name):
    buckets={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and len(o.data.materials)==1:
            key=(o.parent.name if o.parent else '',o.data.materials[0].name)
            buckets.setdefault(key,[]).append(o)
    for objects in buckets.values():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    for mesh in [o for o in bpy.context.scene.objects if o.type=='MESH']:
        mesh.data.validate()
        if mesh.vertex_groups:
            bpy.context.view_layer.objects.active=mesh
            bpy.ops.object.vertex_group_limit_total(limit=4)
            bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        mesh.data.validate()
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_materials='EXPORT',export_texcoords=True,export_normals=True,export_image_format='JPEG',export_image_quality=88)
    meshes=[o for o in bpy.data.objects if o.type=='MESH'];print(name,len(meshes),'meshes',sum(len(o.data.vertices) for o in meshes),'vertices')

reset()
coat=mat('deer warm winter coat',(.44,.245,.115),fur=True);cream=mat('deer pale undercoat',(.75,.65,.46),fur=True);dark=mat('soft black hooves',(.065,.05,.035),.57);eye=mat('deer wet dark eyes',(.016,.012,.008),.12);shine=mat('eye catchlight',(.9,.88,.73),.2);inner=mat('deer inner ear',(.39,.27,.19),fur=True)
root=empty('Deer', (0,0,0))
union('Torso',[
 ellipsoid('ribcage',(0,1.02,.03),(.255,.315,.60),coat),
 ellipsoid('shoulders',(0,1.1,.38),(.25,.34,.28),coat),
 ellipsoid('haunches',(0,1.04,-.42),(.29,.33,.30),coat),
],coat,root)
ellipsoid('Underbelly',(0,.85,-.03),(.21,.15,.49),cream,root)
neck=empty('Neck',(0,1.18,.37),root)
union('Neck and head',[
 ellipsoid('neck lower',(0,1.36,.46),(.175,.33,.2),coat,rot=-.3),
 ellipsoid('neck upper',(0,1.6,.60),(.115,.28,.14),coat,rot=-.3),
 ellipsoid('head',(0,1.78,.77),(.16,.19,.23),coat),
 ellipsoid('forehead',(0,1.78,.88),(.13,.135,.17),coat),
 ellipsoid('muzzle',(0,1.67,1.00),(.10,.095,.22),coat,rot=.18),
],coat,neck,voxel=.011)
ellipsoid('Chin',(0,1.615,1.00),(.079,.045,.16),cream,neck)
ellipsoid('Nose',(0,1.66,1.192),(.075,.052,.035),dark,neck)
for side in [-1,1]:
 ellipsoid('Eye'+str(side),(side*.144,1.795,.88),(.022,.025,.034),eye,neck)
 ellipsoid('Glint'+str(side),(side*.165,1.807,.895),(.003,.004,.005),shine,neck,segments=12,rings=8)
 ear('EarL' if side<0 else 'EarR',(side*.14,1.87,.67),.28,.085,coat,inner,neck,side*.15)
for prefix,z,y,thick in [('Front',.39,1.1,.082),('Hind',-.43,1.05,.115)]:
 for side in [-1,1]:
  p=(side*.19,y,z);upper=empty(prefix+('L' if side<0 else 'R'),p,root)
  mid=(side*.19,.55,z+(.055 if prefix=='Front' else -.15))
  union('Thigh', [ellipsoid('muscle',(side*.19,y-.18,z), (thick,.26,thick*1.1),coat),ellipsoid('upper shank',(side*.19,.68,(z+mid[2])*.5),(.047,.20,.052),coat)],coat,upper,.013)
  lower=empty(prefix+('L' if side<0 else 'R')+'Lower',mid,upper)
  ellipsoid('joint',mid,(.04,.045,.045),coat,lower)
  bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.027,radius2=.035,depth=.45,location=P((side*.19,.30,mid[2]+.035)))
  cannon=bpy.context.object;cannon.name='Cannon';cannon.data.materials.append(coat)
  for poly in cannon.data.polygons:poly.use_smooth=True
  cannon.parent=lower;cannon.matrix_parent_inverse=lower.matrix_world.inverted()
  bpy.ops.mesh.primitive_cube_add(size=1,location=P((side*.19,.055,mid[2]+.06)))
  hoof=bpy.context.object;hoof.name='Hoof';hoof.scale=(.09,.135,.09);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bevel=hoof.modifiers.new('Rounded keratin hoof','BEVEL');bevel.width=.025;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name)
  for poly in hoof.data.polygons:poly.use_smooth=True
  hoof.data.materials.append(dark);hoof.parent=lower;hoof.matrix_parent_inverse=lower.matrix_world.inverted()
  # A shallow cleft makes the hooves read as cloven instead of boots.
  ellipsoid('Hoof cleft',(side*.19,.055,mid[2]+.128),(.004,.035,.004),eye,lower,segments=12,rings=8)
tail=empty('Tail',(0,1.16,-.68),root)
ellipsoid('Tail brown',(0,1.13,-.78),(.07,.11,.16),coat,tail,rot=-.5)
ellipsoid('Tail white',(0,1.1,-.81),(.058,.08,.14),cream,tail,rot=-.5)
rigify('deer',root,coat)
export('deer')

reset()
coat=mat('rabbit tawny agouti',(.36,.29,.19),fur=True);cream=mat('rabbit creamy belly',(.69,.65,.53),fur=True);eye=mat('rabbit wet eyes',(.012,.008,.006),.1);nose=mat('rabbit velvet nose',(.25,.13,.11),.65);inner=mat('rabbit ear soft pink',(.49,.32,.26),fur=True);shine=mat('rabbit eye light',(.89,.89,.78),.2)
root=empty('Rabbit',(0,0,0))
union('Torso',[ellipsoid('body',(0,.27,-.05),(.18,.22,.34),coat),ellipsoid('haunch',(0,.25,-.22),(.22,.24,.22),coat),ellipsoid('chest',(0,.34,.17),(.145,.18,.19),coat)],coat,root,.009)
ellipsoid('Belly',(0,.16,.03),(.15,.11,.24),cream,root)
head=empty('Head',(0,.4,.2),root)
union('Head mesh',[ellipsoid('head',(0,.48,.30),(.15,.16,.17),coat),ellipsoid('muzzle',(0,.43,.43),(.11,.09,.12),coat)],coat,head,.007)
for side in [-1,1]:
 ellipsoid('Cheek'+str(side),(side*.057,.413,.448),(.065,.055,.06),cream,head)
 ellipsoid('Eye'+str(side),(side*.13,.515,.35),(.019,.024,.026),eye,head)
 ellipsoid('Glint'+str(side),(side*.15,.527,.362),(.0025,.003,.003),shine,head,segments=12,rings=8)
 ear('EarL' if side<0 else 'EarR',(side*.065,.60,.245),.30,.062,coat,inner,head,side*.065)
ellipsoid('Nose',(0,.444,.537),(.024,.017,.014),nose,head,segments=20,rings=12)
for side in [-1,1]:
 front=empty('FrontL' if side<0 else 'FrontR',(side*.1,.21,.22),root)
 ellipsoid('Foreleg',(side*.1,.135,.24),(.048,.12,.055),coat,front)
 ellipsoid('Front paw',(side*.1,.045,.31),(.052,.042,.095),cream,front)
 back=empty('HindL' if side<0 else 'HindR',(side*.145,.2,-.21),root)
 ellipsoid('Folded thigh',(side*.165,.18,-.21),(.10,.16,.14),coat,back)
 ellipsoid('Hind paw',(side*.15,.052,-.06),(.073,.052,.16),cream,back)
tail=empty('Tail',(0,.26,-.37),root)
ellipsoid('Cotton tail',(0,.26,-.43),(.085,.09,.1),cream,tail)
rigify('rabbit',root,coat)
export('rabbit')
