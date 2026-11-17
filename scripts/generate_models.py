"""Generate lightweight paper-craft GLTF models for the portfolio.

Every model is a valid glTF 2.0 file with an embedded binary buffer. The
geometry is intentionally simple (boxes only) so the site stays fast while
still using real GLTF assets and PBR materials.
"""

from __future__ import annotations

import base64
import json
import math
import os
import struct

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "models"))
os.makedirs(ROOT, exist_ok=True)

PALETTE = {
    "amber": (0.82, 0.60, 0.20, 1.0),
    "amberDark": (0.52, 0.35, 0.11, 1.0),
    "amberLight": (0.94, 0.79, 0.42, 1.0),
    "paper": (0.97, 0.94, 0.86, 1.0),
    "paperShade": (0.86, 0.81, 0.69, 1.0),
    "cream": (0.99, 0.96, 0.88, 1.0),
    "kraft": (0.72, 0.56, 0.36, 1.0),
    "sage": (0.57, 0.66, 0.55, 1.0),
    "sageDark": (0.33, 0.42, 0.33, 1.0),
    "olive": (0.24, 0.30, 0.23, 1.0),
    "terracotta": (0.74, 0.36, 0.26, 1.0),
    "blush": (0.88, 0.69, 0.60, 1.0),
    "ink": (0.18, 0.17, 0.15, 1.0),
    "sky": (0.62, 0.73, 0.76, 1.0),
}


def quat_from_degrees(rx: float, ry: float, rz: float) -> list[float]:
    """Convert Euler degrees (XYZ order) to a glTF quaternion."""
    x, y, z = (math.radians(v) for v in (rx, ry, rz))
    cx, cy, cz = math.cos(x / 2), math.cos(y / 2), math.cos(z / 2)
    sx, sy, sz = math.sin(x / 2), math.sin(y / 2), math.sin(z / 2)
    return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
    ]


class GltfBuilder:
    def __init__(self) -> None:
        self.binary = bytearray()
        self.buffer_views: list[dict] = []
        self.accessors: list[dict] = []
        self.meshes: list[dict] = []
        self.materials: list[dict] = []
        self.nodes: list[dict] = []
        self.material_index: dict[str, int] = {}
        self.mesh_cache: dict[tuple, int] = {}

        for name, color in PALETTE.items():
            self.material_index[name] = len(self.materials)
            self.materials.append(
                {
                    "name": name,
                    "doubleSided": True,
                    "pbrMetallicRoughness": {
                        "baseColorFactor": list(color),
                        "metallicFactor": 0.0,
                        "roughnessFactor": 0.86,
                    },
                }
            )

    def _align(self) -> None:
        while len(self.binary) % 4:
            self.binary.append(0)

    def _add_accessor(
        self,
        values: list[float] | list[int],
        component_type: int,
        count: int,
        type_name: str,
        target: int,
        minimum: list[float] | None = None,
        maximum: list[float] | None = None,
    ) -> int:
        self._align()
        offset = len(self.binary)
        fmt = "<" + ("f" if component_type == 5126 else "H") * len(values)
        self.binary.extend(struct.pack(fmt, *values))
        view_index = len(self.buffer_views)
        self.buffer_views.append(
            {
                "buffer": 0,
                "byteOffset": offset,
                "byteLength": len(self.binary) - offset,
                "target": target,
            }
        )
        accessor = {
            "bufferView": view_index,
            "componentType": component_type,
            "count": count,
            "type": type_name,
        }
        if minimum is not None and maximum is not None:
            accessor["min"] = minimum
            accessor["max"] = maximum
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def box_mesh(self, sx: float, sy: float, sz: float, material: str) -> int:
        key = (round(sx, 4), round(sy, 4), round(sz, 4), material)
        if key in self.mesh_cache:
            return self.mesh_cache[key]

        hx, hy, hz = sx / 2, sy / 2, sz / 2
        faces = [
            ([(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)], (1, 0, 0)),
            ([(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)], (-1, 0, 0)),
            ([(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)], (0, 1, 0)),
            ([(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)], (0, -1, 0)),
            ([(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)], (0, 0, 1)),
            ([(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)], (0, 0, -1)),
        ]

        positions: list[float] = []
        normals: list[float] = []
        uvs: list[float] = []
        indices: list[int] = []
        for corners, normal in faces:
            base = len(positions) // 3
            for corner in corners:
                positions.extend(corner)
                normals.extend(normal)
            uvs.extend([0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0])
            indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])

        pos_acc = self._add_accessor(
            positions,
            5126,
            24,
            "VEC3",
            34962,
            [-hx, -hy, -hz],
            [hx, hy, hz],
        )
        norm_acc = self._add_accessor(normals, 5126, 24, "VEC3", 34962)
        uv_acc = self._add_accessor(uvs, 5126, 24, "VEC2", 34962)
        idx_acc = self._add_accessor(indices, 5123, 36, "SCALAR", 34963)

        mesh_index = len(self.meshes)
        self.meshes.append(
            {
                "name": f"paperbox_{sx}x{sy}x{sz}_{material}",
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": pos_acc,
                            "NORMAL": norm_acc,
                            "TEXCOORD_0": uv_acc,
                        },
                        "indices": idx_acc,
                        "material": self.material_index[material],
                    }
                ],
            }
        )
        self.mesh_cache[key] = mesh_index
        return mesh_index

    def node(
        self,
        name: str,
        mesh: int | None = None,
        translation: tuple[float, float, float] = (0, 0, 0),
        rotation: tuple[float, float, float] = (0, 0, 0),
        scale: tuple[float, float, float] = (1, 1, 1),
        children: list[int] | None = None,
    ) -> int:
        data: dict = {"name": name}
        if mesh is not None:
            data["mesh"] = mesh
        if translation != (0, 0, 0):
            data["translation"] = [round(v, 5) for v in translation]
        if rotation != (0, 0, 0):
            data["rotation"] = [round(v, 6) for v in quat_from_degrees(*rotation)]
        if scale != (1, 1, 1):
            data["scale"] = [round(v, 5) for v in scale]
        if children:
            data["children"] = children
        self.nodes.append(data)
        return len(self.nodes) - 1

    def add_child(self, parent: int, child: int) -> None:
        self.nodes[parent].setdefault("children", []).append(child)

    def save(self, name: str) -> None:
        self._align()
        uri = "data:application/octet-stream;base64," + base64.b64encode(bytes(self.binary)).decode("ascii")
        gltf = {
            "asset": {
                "version": "2.0",
                "generator": "Paper Book Portfolio - generate_models.py",
                "copyright": "Generated for the Paper Book Portfolio demo",
            },
            "scene": 0,
            "scenes": [{"name": name, "nodes": [0]}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.binary), "uri": uri}],
        }
        path = os.path.join(ROOT, f"{name}.gltf")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(gltf, handle, ensure_ascii=False, separators=(",", ":"))
        print(f"saved {path} ({len(self.binary)} bytes buffer, {len(self.nodes)} nodes)")


def build_book() -> None:
    b = GltfBuilder()
    root = b.node("BookRoot")

    back = b.node("BackCover", b.box_mesh(4.0, 0.12, 5.6, "amberDark"), (2.0, 0.0, 0.0))
    spine = b.node("Spine", b.box_mesh(0.34, 0.42, 5.68, "amberDark"), (0.0, 0.15, 0.0))
    right_pages = b.node("RightPages", b.box_mesh(3.78, 0.2, 5.32, "paper"), (2.0, 0.17, 0.0))

    front_pivot = b.node("FrontCoverPivot", translation=(0.0, 0.31, 0.0))
    front = b.node("FrontCover", b.box_mesh(4.0, 0.12, 5.6, "amber"), (2.0, 0.0, 0.0))
    title = b.node("CoverTitle", b.box_mesh(3.3, 0.012, 2.3, "cream"), (2.0, 0.067, 0.0))
    corner_a = b.node("CornerA", b.box_mesh(0.3, 0.014, 0.3, "amberLight"), (0.3, 0.068, 2.45))
    corner_b = b.node("CornerB", b.box_mesh(0.3, 0.014, 0.3, "amberLight"), (3.7, 0.068, 2.45))
    corner_c = b.node("CornerC", b.box_mesh(0.3, 0.014, 0.3, "amberLight"), (0.3, 0.068, -2.45))
    corner_d = b.node("CornerD", b.box_mesh(0.3, 0.014, 0.3, "amberLight"), (3.7, 0.068, -2.45))

    left_pivot = b.node("LeftPagesPivot", translation=(0.0, 0.17, 0.0))
    left_pages = b.node("LeftPages", b.box_mesh(3.78, 0.2, 5.32, "paper"), (2.0, 0.0, 0.0))

    bookmark = b.node("Bookmark", b.box_mesh(0.24, 0.012, 1.75, "terracotta"), (3.15, 0.38, 1.75))

    for i in range(4):
        edge = b.node(
            f"PageEdge_{i + 1}",
            b.box_mesh(3.7, 0.006, 5.22, "paperShade"),
            (2.0, 0.11 + i * 0.025, 0.0),
        )
        b.add_child(root, edge)

    for child in (back, spine, right_pages, front_pivot, left_pivot, bookmark):
        b.add_child(root, child)
    for child in (front, title, corner_a, corner_b, corner_c, corner_d):
        b.add_child(front_pivot, child)
    b.add_child(left_pivot, left_pages)
    b.save("book")


def build_intro() -> None:
    b = GltfBuilder()
    root = b.node("IntroRoot")
    nodes = [
        ("Base", b.box_mesh(2.9, 0.16, 1.9, "kraft"), (0.0, 0.08, 0.0), (0, 0, 0)),
        ("Backdrop", b.box_mesh(2.65, 2.0, 0.08, "paperShade"), (0.0, 1.12, -0.66), (-8, 0, 0)),
        ("Frame", b.box_mesh(1.55, 1.82, 0.09, "olive"), (0.0, 1.13, -0.06), (0, 0, 0)),
        ("hotspot_portrait", b.box_mesh(1.28, 1.52, 0.02, "blush"), (0.0, 1.13, 0.0), (0, 0, 0)),
        ("SupportLeft", b.box_mesh(0.08, 1.05, 0.08, "kraft"), (-1.05, 0.55, 0.55), (0, 0, -12)),
        ("SupportRight", b.box_mesh(0.08, 1.05, 0.08, "kraft"), (1.05, 0.55, 0.55), (0, 0, 12)),
        ("NamePlate", b.box_mesh(1.65, 0.18, 0.07, "amber"), (0.0, 0.25, 0.62), (0, 0, 0)),
        ("LeafA", b.box_mesh(0.16, 0.62, 0.02, "sage"), (-1.18, 1.02, -0.2), (0, 0, -32)),
        ("LeafB", b.box_mesh(0.14, 0.52, 0.02, "sageDark"), (-0.96, 0.89, -0.15), (0, 0, 18)),
        ("LeafC", b.box_mesh(0.16, 0.68, 0.02, "sage"), (1.16, 1.04, -0.2), (0, 0, 34)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("intro")


def build_contact() -> None:
    b = GltfBuilder()
    root = b.node("ContactRoot")
    nodes = [
        ("EnvelopeBody", b.box_mesh(2.35, 0.06, 1.55, "kraft"), (0.0, 0.06, 0.0), (0, 0, 0)),
        ("EnvelopeFlap", b.box_mesh(2.1, 0.025, 0.92, "paper"), (0.0, 0.11, -0.32), (26, 0, 0)),
        ("EnvelopeSeal", b.box_mesh(0.32, 0.03, 0.32, "terracotta"), (0.0, 0.18, 0.08), (0, 0, 45)),
        ("hotspot_postcard", b.box_mesh(1.35, 0.035, 0.92, "cream"), (-1.55, 0.07, 0.66), (0, 16, 0)),
        ("PostcardStripe", b.box_mesh(1.1, 0.012, 0.08, "terracotta"), (-1.55, 0.095, 0.52), (0, 16, 0)),
        ("hotspot_qr", b.box_mesh(0.74, 0.02, 0.74, "cream"), (1.42, 0.08, 0.58), (0, -8, 0)),
        ("hotspot_stamp", b.box_mesh(0.48, 0.04, 0.48, "sageDark"), (1.36, 0.12, -0.58), (0, -18, 0)),
        ("RibbonA", b.box_mesh(0.1, 0.012, 1.9, "terracotta"), (-0.85, 0.04, 0.0), (0, 0, 0)),
        ("RibbonB", b.box_mesh(0.1, 0.012, 1.9, "amber"), (0.85, 0.04, 0.0), (0, 0, 0)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("contact")


def build_illustration() -> None:
    b = GltfBuilder()
    root = b.node("IllustrationRoot")
    nodes = [
        ("EaselLeft", b.box_mesh(0.12, 2.6, 0.12, "kraft"), (-0.72, 1.3, -0.18), (0, 0, -10)),
        ("EaselRight", b.box_mesh(0.12, 2.6, 0.12, "kraft"), (0.72, 1.3, -0.18), (0, 0, 10)),
        ("EaselBack", b.box_mesh(0.1, 2.35, 0.1, "kraft"), (0.0, 1.17, -0.52), (-9, 0, 0)),
        ("EaselShelf", b.box_mesh(2.1, 0.12, 0.34, "amberDark"), (0.0, 0.92, 0.12), (0, 0, 0)),
        ("CanvasBack", b.box_mesh(1.95, 1.62, 0.07, "olive"), (0.0, 1.72, 0.05), (0, 0, 0)),
        ("hotspot_sketch", b.box_mesh(1.72, 1.4, 0.02, "cream"), (0.0, 1.72, 0.1), (0, 0, 0)),
        ("Pencil", b.box_mesh(0.86, 0.055, 0.055, "amberLight"), (0.72, 0.42, 0.72), (0, 0, -22)),
        ("PencilTip", b.box_mesh(0.12, 0.055, 0.055, "ink"), (1.15, 0.25, 0.72), (0, 0, -22)),
        ("Palette", b.box_mesh(1.05, 0.05, 0.72, "kraft"), (-0.92, 0.24, 0.66), (0, 0, 0)),
        ("PaintA", b.box_mesh(0.16, 0.02, 0.16, "terracotta"), (-1.2, 0.28, 0.6), (0, 0, 0)),
        ("PaintB", b.box_mesh(0.16, 0.02, 0.16, "sage"), (-0.9, 0.28, 0.58), (0, 0, 0)),
        ("PaintC", b.box_mesh(0.16, 0.02, 0.16, "sky"), (-0.62, 0.28, 0.6), (0, 0, 0)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("illustration")


def build_graphic() -> None:
    b = GltfBuilder()
    root = b.node("GraphicRoot")
    nodes = [
        ("Board", b.box_mesh(3.0, 2.15, 0.1, "sageDark"), (0.0, 1.28, -0.48), (0, 0, 0)),
        ("BoardInner", b.box_mesh(2.82, 1.97, 0.02, "paperShade"), (0.0, 1.28, -0.41), (0, 0, 0)),
        ("hotspot_poster_a", b.box_mesh(1.12, 1.52, 0.025, "cream"), (-0.69, 1.3, -0.36), (0, 0, 0)),
        ("hotspot_poster_b", b.box_mesh(0.96, 1.36, 0.025, "blush"), (0.74, 1.24, -0.35), (0, 0, 0)),
        ("PosterClipA", b.box_mesh(0.32, 0.06, 0.06, "ink"), (-0.69, 2.09, -0.32), (0, 0, 0)),
        ("PosterClipB", b.box_mesh(0.32, 0.06, 0.06, "ink"), (0.74, 1.95, -0.31), (0, 0, 0)),
        ("Roll", b.box_mesh(1.8, 0.2, 0.2, "paper"), (-0.2, 0.22, 0.62), (0, 0, 0)),
        ("RollCapA", b.box_mesh(0.06, 0.24, 0.24, "amberDark"), (-1.1, 0.22, 0.62), (0, 0, 0)),
        ("RollCapB", b.box_mesh(0.06, 0.24, 0.24, "amberDark"), (0.7, 0.22, 0.62), (0, 0, 0)),
        ("SwatchA", b.box_mesh(0.46, 0.03, 0.34, "terracotta"), (1.22, 0.14, 0.52), (0, 0, 0)),
        ("SwatchB", b.box_mesh(0.46, 0.03, 0.34, "sage"), (1.22, 0.14, 0.12), (0, 0, 0)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("graphic")


def build_interactive() -> None:
    b = GltfBuilder()
    root = b.node("InteractiveRoot")
    nodes = [
        ("Pedestal", b.box_mesh(1.6, 0.52, 0.9, "kraft"), (0.0, 0.26, 0.26), (0, 0, 0)),
        ("ScreenFrame", b.box_mesh(2.45, 1.65, 0.12, "ink"), (0.0, 1.48, -0.2), (0, 0, 0)),
        ("hotspot_screen", b.box_mesh(2.18, 1.38, 0.02, "sky"), (0.0, 1.48, -0.12), (0, 0, 0)),
        ("ScreenBase", b.box_mesh(0.55, 0.16, 0.55, "ink"), (0.0, 0.63, 0.0), (0, 0, 0)),
        ("hotspot_flow", b.box_mesh(1.5, 0.95, 0.035, "cream"), (1.46, 0.82, 0.62), (0, -22, 0)),
        ("FlowBar", b.box_mesh(1.24, 0.07, 0.05, "terracotta"), (1.46, 1.24, 0.56), (0, -22, 0)),
        ("BlockA", b.box_mesh(0.65, 0.65, 0.65, "sage"), (-1.35, 0.34, 0.72), (0, 18, 0)),
        ("BlockB", b.box_mesh(0.48, 0.48, 0.48, "amberLight"), (-1.18, 0.9, 0.6), (0, -12, 0)),
        ("BlockC", b.box_mesh(0.34, 0.34, 0.34, "blush"), (-0.95, 1.3, 0.54), (0, 24, 0)),
        ("Cable", b.box_mesh(0.05, 0.5, 0.05, "ink"), (0.85, 0.48, 0.2), (0, 0, -16)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("interactive")


def build_modeling() -> None:
    b = GltfBuilder()
    root = b.node("ModelingRoot")
    nodes = [
        ("TurntableBase", b.box_mesh(2.7, 0.18, 2.7, "kraft"), (0.0, 0.09, 0.0), (0, 0, 0)),
        ("TurntableRing", b.box_mesh(2.25, 0.035, 2.25, "amberDark"), (0.0, 0.2, 0.0), (0, 0, 0)),
        ("hotspot_sculpture", b.box_mesh(0.92, 0.92, 0.92, "sage"), (0.0, 0.72, 0.0), (0, 18, 0)),
        ("SculptureTop", b.box_mesh(0.52, 0.52, 0.52, "blush"), (0.18, 1.38, 0.12), (0, -12, 0)),
        ("SculptureSide", b.box_mesh(0.42, 0.42, 0.42, "amberLight"), (-0.72, 0.6, 0.42), (0, 24, 0)),
        ("GridA", b.box_mesh(2.0, 0.012, 0.025, "paperShade"), (0.0, 0.222, -0.6), (0, 0, 0)),
        ("GridB", b.box_mesh(2.0, 0.012, 0.025, "paperShade"), (0.0, 0.222, 0.0), (0, 0, 0)),
        ("GridC", b.box_mesh(2.0, 0.012, 0.025, "paperShade"), (0.0, 0.222, 0.6), (0, 0, 0)),
        ("CaliperA", b.box_mesh(0.05, 0.85, 0.05, "ink"), (1.05, 0.72, -0.65), (0, 0, 0)),
        ("CaliperB", b.box_mesh(0.55, 0.05, 0.05, "ink"), (0.82, 1.12, -0.65), (0, 0, 0)),
        ("hotspot_model_card", b.box_mesh(1.32, 0.86, 0.035, "cream"), (1.48, 0.78, 0.46), (0, -26, 0)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("modeling")


def build_motion() -> None:
    b = GltfBuilder()
    root = b.node("MotionRoot")
    nodes = [
        ("FilmBase", b.box_mesh(3.6, 0.14, 1.7, "ink"), (0.0, 0.07, 0.0), (0, 0, 0)),
        ("ReelLeft", b.box_mesh(0.92, 0.92, 0.16, "kraft"), (-1.55, 0.88, -0.18), (0, 0, 0)),
        ("ReelRight", b.box_mesh(0.92, 0.92, 0.16, "kraft"), (1.55, 0.88, -0.18), (0, 0, 0)),
        ("ReelHubLeft", b.box_mesh(0.24, 0.24, 0.18, "amber"), (-1.55, 0.88, -0.08), (0, 0, 0)),
        ("ReelHubRight", b.box_mesh(0.24, 0.24, 0.18, "amber"), (1.55, 0.88, -0.08), (0, 0, 0)),
        ("FilmStrip", b.box_mesh(3.05, 0.72, 0.035, "olive"), (0.0, 0.78, 0.18), (0, 0, 0)),
        ("hotspot_frame_a", b.box_mesh(0.72, 0.5, 0.022, "sky"), (-0.88, 0.78, 0.22), (0, 0, 0)),
        ("hotspot_frame_b", b.box_mesh(0.72, 0.5, 0.022, "blush"), (0.0, 0.78, 0.22), (0, 0, 0)),
        ("hotspot_frame_c", b.box_mesh(0.72, 0.5, 0.022, "amberLight"), (0.88, 0.78, 0.22), (0, 0, 0)),
        ("Timeline", b.box_mesh(2.9, 0.055, 0.055, "terracotta"), (0.0, 0.2, 0.68), (0, 0, 0)),
        ("MarkA", b.box_mesh(0.1, 0.1, 0.1, "cream"), (-1.0, 0.2, 0.68), (0, 0, 45)),
        ("MarkB", b.box_mesh(0.1, 0.1, 0.1, "cream"), (0.1, 0.2, 0.68), (0, 0, 45)),
        ("MarkC", b.box_mesh(0.1, 0.1, 0.1, "cream"), (1.15, 0.2, 0.68), (0, 0, 45)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("motion")


def build_merch() -> None:
    b = GltfBuilder()
    root = b.node("MerchRoot")
    nodes = [
        ("TableBase", b.box_mesh(3.3, 0.1, 2.2, "paperShade"), (0.0, 0.05, 0.0), (0, 0, 0)),
        ("ToteBody", b.box_mesh(1.5, 1.5, 0.14, "kraft"), (-0.85, 0.95, -0.18), (0, 0, 0)),
        ("ToteHandle", b.box_mesh(0.92, 0.12, 0.12, "amberDark"), (-0.85, 1.78, -0.18), (0, 0, 0)),
        ("hotspot_tote_art", b.box_mesh(1.1, 0.98, 0.02, "cream"), (-0.85, 0.98, -0.08), (0, 0, 0)),
        ("Notebook", b.box_mesh(1.3, 0.07, 0.92, "sageDark"), (0.92, 0.1, 0.48), (0, 12, 0)),
        ("hotspot_notebook_cover", b.box_mesh(1.16, 0.022, 0.8, "cream"), (0.92, 0.15, 0.48), (0, 12, 0)),
        ("StickerSheet", b.box_mesh(1.25, 0.018, 1.02, "paper"), (0.92, 0.07, -0.52), (0, -8, 0)),
        ("hotspot_sticker_a", b.box_mesh(0.34, 0.024, 0.34, "terracotta"), (0.63, 0.09, -0.76), (0, -8, 0)),
        ("hotspot_sticker_b", b.box_mesh(0.34, 0.024, 0.34, "sky"), (1.18, 0.09, -0.34), (0, -8, 0)),
        ("Badge", b.box_mesh(0.44, 0.06, 0.44, "amber"), (1.5, 0.12, -0.85), (0, 0, 45)),
    ]
    for name, mesh, trans, rot in nodes:
        b.add_child(root, b.node(name, mesh, trans, rot))
    b.save("merch")


if __name__ == "__main__":
    build_book()
    build_intro()
    build_contact()
    build_illustration()
    build_graphic()
    build_interactive()
    build_modeling()
    build_motion()
    build_merch()
    print("all models generated")
