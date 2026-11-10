"""Blender 4.x: generate an editable TC-06, CPU previews and runtime geometry.

Run with Blender --background --factory-startup --python this_file -- --render.
Blender X/Y/Z becomes runtime X/Z/-Y, in meters; matrices are column-major.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "static/lab/tc06"
SOURCE = ROOT / "assets/tc06"
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()
MATERIALS = {}


def material(name, color, roughness=.65, texture=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    if texture:
        shader.inputs["Specular IOR Level"].default_value = .08
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(OUT / texture), check_existing=True)
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
        mat.node_tree.links.new(node.outputs["Alpha"], shader.inputs["Alpha"])
        mat["texture_file"] = texture
    MATERIALS[name] = mat
    return mat


def group(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def finish(obj, name, mat, parent, action=None):
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(mat)
    if action:
        obj["action"] = action
    return obj


def box(name, size, pos, mat, parent, bevel=0, action=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Edge highlights", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return finish(obj, name, mat, parent, action)


def cylinder(name, radius, depth, pos, mat, parent, action=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=pos, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new("Rim bevel", "BEVEL")
    mod.width = min(depth * .15, radius * .12)
    mod.segments = 2
    return finish(obj, name, mat, parent, action)


def shell(name, size, pos, mat, parent, radius=.024):
    width, depth, height = size
    outline = []
    for cx, cz, begin in [(width/2-radius, height/2-radius, 0), (-width/2+radius, height/2-radius, 90), (-width/2+radius, -height/2+radius, 180), (width/2-radius, -height/2+radius, 270)]:
        for step in range(13):
            angle = math.radians(begin + step*7.5)
            outline.append((cx+radius*math.cos(angle), cz+radius*math.sin(angle)))
    count = len(outline)
    vertices = [(x, y, z) for y in (-depth/2, depth/2) for x, z in outline]
    faces = [tuple(range(count)), tuple(reversed(range(count, count*2)))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    bevel = obj.modifiers.new("Edge softness", "BEVEL")
    bevel.width = .0011
    bevel.segments = 2
    return finish(obj, name, mat, parent)


def decal(name, width, height, pos, mat, parent, back=False):
    vertices = [(-width/2, 0, -height/2), (width/2, 0, -height/2), (width/2, 0, height/2), (-width/2, 0, height/2)]
    if back:
        vertices = [(-x, y, z) for x, y, z in vertices]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.uv_layers.new()
    for index, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        mesh.uv_layers.active.data[index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    return finish(obj, name, mat, parent)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def circle_decal(name, radius, pos, mat, parent, back=False):
    count = 128
    vertices = [(0, 0, 0)] + [(radius*math.cos(i*math.tau/count), 0, radius*math.sin(i*math.tau/count)) for i in range(count)]
    faces = [(0, i+1, (i+1) % count+1) for i in range(count)]
    if back:
        faces = [tuple(reversed(face)) for face in faces]
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.uv_layers.new()
    for polygon in data.polygons:
        for loop_index in polygon.loop_indices:
            x, _, z = vertices[data.loops[loop_index].vertex_index]
            data.uv_layers.active.data[loop_index].uv = ((-x if back else x)/(2*radius)+.5, z/(2*radius)+.5)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj["single_sided"] = True
    return finish(obj, name, mat, parent)


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    ivory = material("Ivory polymer", (.79, .77, .72))
    trim = material("Peripheral trim", (.11, .14, .17))
    rubber = material("Rubber", (.055, .065, .07), .9)
    clay = material("Clay A", (.48, .22, .23))
    sand = material("Sand B", (.61, .43, .24))
    steel = material("Fasteners", (.28, .30, .31), .3)
    gold = material("Contacts", (.65, .44, .15), .35)
    led = material("Status light", (.55, .85, .44), .35)
    logo = material("Original TensorCat badge", (1, 1, 1), texture="logo-badge.png")
    root = group("TC06_Root")
    chassis = group("Chassis", root)
    controls = group("Controls", root)
    details = group("Details", root)
    branding = group("Branding", root)
    cartridges = group("Cartridges", root)
    shell("Shell_Back", (.240, .030, .145), (0, .005, 0), ivory, chassis)
    shell("Shell_Trim", (.242, .013, .146), (0, -.002, 0), trim, chassis)
    shell("Shell_Front", (.239, .016, .142), (0, -.012, 0), ivory, chassis)
    for sign in (-1, 1):
        box("Rear_Grip_" + str(sign), (.040, .012, .112), (sign*.091, .021, -.006), trim, chassis, .014)
        box("Shoulder_" + str(sign), (.035, .018, .015), (sign*.089, -.001, .071), rubber, chassis, .005)
    box("Screen_Bezel", (.148, .008, .103), (0, -.023, .006), rubber, chassis, .009)
    box("Screen_Inner_Frame", (.135, .0018, .080), (0, -.0272, .008), trim, chassis, .003)
    screen_mat = material("Dynamic display", (.055, .085, .11), texture="boot-screen.png")
    screen_mat["dynamic_screen"] = True
    screen = decal("Screen_Surface", .128, .072, (0, -.0283, .008), screen_mat, chassis)
    screen["action"] = "screen"
    screen["single_sided"] = True
    for name, x, z, radius, mat in [("a", .095, .032, .0125, clay), ("b", .095, .004, .0125, sand)]:
        pivot = group("Button_" + name.upper(), controls)
        pivot["control"] = name
        cylinder(name + "_socket", radius+.002, .002, (x, -.021, z), rubber, controls)
        cylinder(name + "_cap", radius, .007, (x, -.0255, z), mat, pivot, name)
        label_mat = material(name+" label", (1, 1, 1), texture=name+"-label.png")
        decal(name+"_label", radius*1.7, radius*.85, (x, -.0292, z), label_mat, pivot)["action"] = name
    dpad = group("DPad_Pivot", controls)
    for action, x, z, size in [("up", -.094, .040, (.013, .006, .017)), ("down", -.094, .017, (.013, .006, .017)), ("left", -.105, .0285, (.017, .006, .013)), ("right", -.083, .0285, (.017, .006, .013))]:
        box("DPad_"+action, size, (x, -.025, z), rubber, dpad, .002, action)
    cylinder("DPad_Center", .007, .007, (-.094, -.025, .0285), trim, dpad)
    joystick = group("Joystick_Pivot", controls)
    joystick.location = (-.094, -.022, -.022)
    cylinder("Joystick_Well", .018, .003, (-.094, -.021, -.022), trim, controls)
    cylinder("Joystick_Shaft", .007, .008, (0, -.004, 0), steel, joystick, "joystick")
    cylinder("Joystick_Cap", .014, .008, (0, -.010, 0), rubber, joystick, "joystick")
    for action, x in [("select", -.020), ("start", .020)]:
        pivot = group("Button_" + action.title(), controls)
        box(action+"_cap", (.027, .006, .008), (x, -.023, -.058), trim, pivot, .003, action)
        mat = material(action+" label", (1, 1, 1), texture=action+"-label.png")
        decal(action+"_label", .023, .006, (x, -.0262, -.058), mat, pivot)["action"] = action
    for x in (-.100, .100):
        for z in (-.055, .056):
            cylinder("Screw", .0026, .0015, (x, -.021, z), steel, details)
            box("Screw_Slot", (.0024, .0003, .0004), (x, -.022, z), rubber, details)
    for index in range(4):
        box("Speaker_"+str(index), (.002, .001, .016), (.081+index*.006, -.021, -.040), rubber, details, .0008)
    cylinder("Status_LED", .0028, .0018, (-.047, -.0215, -.058), led, details)
    box("Power_Track", (.027, .0035, .008), (-.090, -.022, -.056), rubber, controls, .002, "power")
    power_slider = group("Power_Slider", controls)
    power_slider.location = (-.082, -.026, -.056)
    box("Power_Knob", (.009, .003, .006), (0, 0, 0), trim, power_slider, .001, "power")
    for rib in (-1, 0, 1):
        box("Power_Grip", (.0006, .0006, .004), (rib*.002, -.0018, 0), steel, power_slider, 0, "power")
    for name, x in (("off", -.111), ("on", -.065)):
        label = material("Power "+name+" label", (1, 1, 1), texture=name+"-label.png")
        decal("Power_"+name.upper(), .012, .006, (x, -.025, -.056), label, controls)["action"] = "power-"+name
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.001, .040))
    cutter = bpy.context.object
    cutter.name = "Slot_Cavity_Cutter"
    cutter.dimensions = (.046, .016, .078)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for name in ("Shell_Front", "Shell_Back", "Shell_Trim"):
        obj = bpy.data.objects[name]
        modifier = obj.modifiers.new("Cartridge cavity", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.object = cutter
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    box("Cartridge_Slot", (.045, .015, .001), (0, -.001, .0015), rubber, details)
    for index in range(14):
        box("Contact_"+str(index), (.0015, .0008, .002), (-.018+index*.00275, -.005, .005), gold, details)
    box("USB_Port", (.013, .001, .004), (0, -.001, -.0725), rubber, details, .0015)
    badge_black = material("Badge black disk", (.001, .001, .001))
    circle_decal("Rear_Badge_Disk", .0285, (0, .0205, .009), badge_black, branding, back=True)
    circle_decal("Logo_Rear", .0285, (0, .0207, .009), logo, branding, back=True)
    for name, width, height, pos in [("wordmark", .041, .007, (0, -.0205, -.0495)), ("model", .028, .014, (.065, -.0205, -.060))]:
        mat = material(name+" print", (1, 1, 1), texture=name+"-label.png")
        decal(name.title()+"_Front", width, height, pos, mat, branding)
    registry = json.loads((OUT / "experiments.json").read_text())
    for index, task in enumerate(registry):
        color = tuple(int(task["color"][j:j+2], 16)/255 for j in (1, 3, 5))
        mat = material(task["id"]+" plastic", color)
        label = material(task["id"]+" label", (1, 1, 1), texture=task["id"]+"-label.png")
        cart = group("Cartridge_"+task["id"], cartridges)
        cart["cartridge"] = task["id"]
        column = index-2.5
        cart.location = (column*.045, -.001, .135)
        body = box(task["id"]+"_body", (.037, .010, .049), (0, 0, 0), mat, cart, .003, "cartridge:"+task["id"])
        decal(task["id"]+"_label", .032, .035, (0, -.0052, .001), label, cart)["action"] = "cartridge:"+task["id"]
        for side in (-1, 1):
            for rib in range(3):
                box(task["id"]+"_rib", (.002, .012, .0015), (side*.018, 0, .014-rib*.006), mat, cart)
        box(task["id"]+"_connector", (.023, .006, .004), (0, 0, -.025), gold, cart)
    return root, registry


def export_model(root):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    nodes = []
    triangles = 0
    for obj in root.children_recursive:
        node = {"name": obj.name, "parent": obj.parent.name, "matrix": [round(value, 8) for col in (C @ obj.matrix_local @ CI).transposed() for value in col]}
        for key in ("action", "control", "cartridge"):
            if key in obj:
                node[key] = obj[key]
        if obj.get("single_sided"):
            node["singleSided"] = True
        if obj.type == "MESH":
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            mesh.calc_loop_triangles()
            positions, normals, uvs = [], [], []
            uv_layer = mesh.uv_layers.active
            for tri in mesh.loop_triangles:
                for loop_index in tri.loops:
                    loop = mesh.loops[loop_index]
                    vertex = mesh.vertices[loop.vertex_index]
                    positions.extend(round(v, 7) for v in (C.to_3x3() @ vertex.co))
                    normal = vertex.normal if mesh.polygons[tri.polygon_index].use_smooth else tri.normal
                    normals.extend(round(v, 6) for v in (C.to_3x3() @ normal))
                    uvs.extend(round(v, 6) for v in (uv_layer.data[loop_index].uv if uv_layer else (0, 0)))
            mat = obj.data.materials[0]
            node.update({"positions": positions, "normals": normals, "uvs": uvs, "color": list(mat.diffuse_color[:3])})
            if "texture_file" in mat:
                node["texture"] = mat["texture_file"]
            if mat.get("dynamic_screen"):
                node["texture"] = "screen"
            triangles += len(mesh.loop_triangles)
            evaluated.to_mesh_clear()
        nodes.append(node)
    data = {"version": 2, "units": "meters", "up": "Y", "handedness": "right", "blenderVersion": bpy.app.version_string, "triangleCount": triangles, "cartridgeBay": {"min": [-.023,.001,-.007], "max": [.023,.079,.009], "mouthY": .073}, "nodes": nodes}
    (OUT / "console-mesh.json").write_text(json.dumps(data, separators=(",", ":")))
    print("TC06_EXPORT", triangles, "triangles", len(nodes), "nodes")


def render_previews(root):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.world.color = (.25, .25, .25)
    scene.view_settings.view_transform = "AgX"
    for name, loc, power, size in [("Key", (.15, -.25, .40), 4, .35), ("Fill", (-.30, -.10, .16), 1.5, .30), ("Rim", (.05, .25, .30), 2.5, .25)]:
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.name = name
        light.data.energy = power
        light.data.shape = "DISK"
        light.data.size = size
        aim(light, (0, 0, 0))
    bpy.ops.object.camera_add(location=(.25, -.38, .20))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = .36
    scene.camera = camera
    views = [("hero", (.25,-.45,.24), (0,0,.045), .42), ("front", (0,-.5,0), (0,0,0), .29), ("rear", (0,.5,0), (0,0,0), .29), ("left", (-.5,0,0), (0,0,0), .20), ("right", (.5,0,0), (0,0,0), .20), ("top", (0,0,.5), (0,0,0), .28), ("bottom", (0,0,-.5), (0,0,0), .28), ("buttons", (.16,-.27,.10), (.095,-.02,.02), .085), ("joystick", (-.18,-.27,.10), (-.094,-.02,-.022), .075), ("slot", (.10,-.15,.27), (0,0,.073), .11), ("logo", (0,.30,.02), (0,.020,.009), .095), ("cartridges", (.10,-.35,.22), (0,-.001,.135), .34)]
    preview = OUT / "previews"
    preview.mkdir(exist_ok=True)
    cartridge_nodes = {obj.name for obj in bpy.data.objects["Cartridges"].children_recursive}
    for name, location, target, scale in views:
        for obj in root.children_recursive:
            if obj.name in cartridge_nodes:
                obj.hide_render = name not in ("hero", "cartridges")
        camera.location = location
        aim(camera, target)
        camera.data.ortho_scale = scale
        scene.render.filepath = str(preview / (name + ".png"))
        bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    root, _ = build()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.view_layer.update()
    export_model(root)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "TensorCat-TC06.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / "TensorCat-TC06.glb"), use_selection=True, export_yup=True)
    if args.render:
        render_previews(root)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "TensorCat-TC06.blend"))


if __name__ == "__main__":
    main()
