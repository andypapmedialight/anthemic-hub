#!/usr/bin/env python3
"""
Split TestBrain.glb triangles into zone materials by proximity to hotspot centres.
Run from anthemic-hub: python3 scripts/colorize_brain_glb.py
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "TestBrain.glb.bak"
DST = ROOT / "assets" / "TestBrain.glb"

# Hotspot centres (model space) — match brain/index.html data-position.
# This GLB: anterior frontal ≈ negative Z; superior/posterior crown ≈ high +Y (not work).
ZONES = (
    ("zone-gigs", np.array([0.28, 0.08, -0.14]), [0.95, 0.78, 0.12, 1.0], [0.14, 0.1, 0.02]),
    ("zone-work", np.array([0.04, 0.2, -0.2]), [0.35, 0.58, 1.0, 1.0], [0.04, 0.07, 0.16]),
    ("zone-reading", np.array([-0.24, 0.1, -0.1]), [0.18, 0.78, 0.58, 1.0], [0.02, 0.1, 0.07]),
    ("zone-writing", np.array([0.1, -0.14, -0.3]), [0.92, 0.38, 0.72, 1.0], [0.12, 0.04, 0.09]),
)
BASE_NAME = "zone-base"
BASE_COLOR = [0.34, 0.36, 0.44, 1.0]
# Hotspot proximity (metres in GLB space)
ZONE_RADIUS = 0.55
# Extended reach when a triangle sits in an anatomical shell (visible cortex)
ZONE_RADIUS_LOOSE = 0.78


def classify_triangles(centres: np.ndarray) -> np.ndarray:
    """Assign each triangle to a zone, base, or -1 via hotspot distance + lobe masks."""
    zone_centres = np.stack([z[1] for z in ZONES])
    dist = np.linalg.norm(zone_centres[None, :, :] - centres[:, None, :], axis=2)

    x, y, z = centres[:, 0], centres[:, 1], centres[:, 2]
    masks = np.zeros((len(centres), len(ZONES)), dtype=bool)
    # Gigs — right lateral, anterior temporal (auditory belt)
    masks[:, 0] = (x > 0.08) & (y > -0.2) & (y < 0.35) & (z > -0.45) & (z < -0.05)
    # Work — dorsal prefrontal, anterior (negative Z), not superior/posterior crown (+Y back)
    masks[:, 1] = (z < -0.05) & (z > -0.48) & (y > 0.0) & (y < 0.32) & (np.abs(x) < 0.36)
    # Reading — left parieto-temporal
    masks[:, 2] = (x < -0.08) & (y > -0.15) & (y < 0.4) & (z > -0.4) & (z < 0.1)
    # Writing — ventral frontal / Broca (inferior-anterior)
    masks[:, 3] = (y < 0.08) & (z < -0.15) & (z > -0.52) & (x > -0.12) & (x < 0.32)

    near = dist <= ZONE_RADIUS
    shell = masks & (dist <= ZONE_RADIUS_LOOSE)
    eligible = near | shell
    scores = np.where(eligible, dist, np.inf)
    best_dist = scores.min(axis=1)
    zone_ids = np.where(best_dist < np.inf, scores.argmin(axis=1), -1).astype(np.int8)
    return zone_ids


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("not a GLB")
    offset = 12
    chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
    offset += 8
    json_doc = json.loads(data[offset : offset + chunk_len].decode("utf-8"))
    offset += chunk_len
    chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
    offset += 8
    bin_blob = data[offset : offset + chunk_len]
    return json_doc, bin_blob


def read_accessor(j: dict, blob: bytes, acc_idx: int) -> np.ndarray:
    acc = j["accessors"][acc_idx]
    bv = j["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    comp = acc["componentType"]
    ncomp = {"SCALAR": 1, "VEC3": 3}[acc["type"]]
    dtype = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[comp]
    nbytes = count * ncomp * np.dtype(dtype).itemsize
    arr = np.frombuffer(blob, dtype=dtype, count=count * ncomp, offset=start)
    if acc["type"] == "VEC3":
        return arr.reshape(-1, 3).copy()
    return arr.copy()


def align4(n: int) -> int:
    return (n + 3) & ~3


def write_glb(j: dict, bin_blob: bytes, path: Path) -> None:
    json_bytes = json.dumps(j, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (align4(len(json_bytes)) - len(json_bytes))
    bin_blob = bin_blob + b"\x00" * (align4(len(bin_blob)) - len(bin_blob))
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<II", len(json_bytes), 0x4E4F534A)
    out += json_bytes
    out += struct.pack("<II", len(bin_blob), 0x004E4942)
    out += bin_blob
    path.write_bytes(out)


def main() -> int:
    if not SRC.is_file():
        print(f"missing {SRC}", file=sys.stderr)
        return 1

    j, blob = read_glb(SRC)
    mesh = j["meshes"][0]
    prim = mesh["primitives"][0]
    pos = read_accessor(j, blob, prim["attributes"]["POSITION"])
    normals = read_accessor(j, blob, prim["attributes"]["NORMAL"])
    tri_idx = read_accessor(j, blob, prim["indices"]).reshape(-1, 3)

    v0, v1, v2 = pos[tri_idx[:, 0]], pos[tri_idx[:, 1]], pos[tri_idx[:, 2]]
    centres = (v0 + v1 + v2) / 3.0
    zone_ids = classify_triangles(centres)

    lists: list[list[int]] = [[] for _ in ZONES] + [[]]
    base_i = len(ZONES)
    for t, zid in zip(tri_idx, zone_ids):
        flat = t.tolist()
        if zid < 0:
            lists[base_i].extend(flat)
        else:
            lists[zid].extend(flat)

    print("triangle counts per material:")
    for i, lst in enumerate(lists):
        name = ZONES[i][0] if i < len(ZONES) else BASE_NAME
        print(f"  {name}: {len(lst) // 3} tris")

    # Rebuild binary: pos, normals, then index buffers
    new_blob = bytearray()
    new_blob += pos.astype(np.float32).tobytes()
    new_blob += b"\x00" * (align4(len(new_blob)) - len(new_blob))
    new_blob += normals.astype(np.float32).tobytes()
    new_blob += b"\x00" * (align4(len(new_blob)) - len(new_blob))

    index_accessor_indices: list[int] = []
    for lst in lists:
        if not lst:
            index_accessor_indices.append(-1)
            continue
        arr = np.array(lst, dtype=np.uint32)
        new_blob += arr.tobytes()
        new_blob += b"\x00" * (align4(len(new_blob)) - len(new_blob))
        index_accessor_indices.append(len(j["accessors"]) + len(index_accessor_indices))

    # Fresh glTF document
    pos_bv = 0
    norm_bv = 1
    j_out: dict = {
        "asset": j.get("asset", {"version": "2.0"}),
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "brain human-custom"}],
        "meshes": [
            {
                "name": "brain human-custom",
                "primitives": [],
            }
        ],
        "accessors": [
            {
                "bufferView": pos_bv,
                "componentType": 5126,
                "count": len(pos),
                "type": "VEC3",
                "max": pos.max(axis=0).tolist(),
                "min": pos.min(axis=0).tolist(),
            },
            {
                "bufferView": norm_bv,
                "componentType": 5126,
                "count": len(normals),
                "type": "VEC3",
            },
        ],
        "bufferViews": [
            {"buffer": 0, "byteLength": len(pos) * 12},
            {"buffer": 0, "byteOffset": align4(len(pos) * 12), "byteLength": len(normals) * 12},
        ],
        "buffers": [{"byteLength": len(new_blob)}],
        "materials": [],
    }

    byte_offset = align4(len(pos) * 12) + align4(len(normals) * 12)
    acc_idx = 2
    mat_idx = 0
    for zi, lst in enumerate(lists):
        if not lst:
            continue
        name = ZONES[zi][0] if zi < len(ZONES) else BASE_NAME
        color = ZONES[zi][2] if zi < len(ZONES) else BASE_COLOR
        emissive = ZONES[zi][3] if zi < len(ZONES) else [0.0, 0.0, 0.0]
        mat: dict = {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": color,
                "metallicFactor": 0.0,
                "roughnessFactor": 0.48,
            },
        }
        if emissive[0] + emissive[1] + emissive[2] > 0:
            mat["emissiveFactor"] = emissive
        j_out["materials"].append(mat)
        j_out["bufferViews"].append(
            {
                "buffer": 0,
                "byteOffset": byte_offset,
                "byteLength": len(lst) * 4,
            }
        )
        byte_offset = align4(byte_offset + len(lst) * 4)
        j_out["accessors"].append(
            {
                "bufferView": len(j_out["bufferViews"]) - 1,
                "componentType": 5125,
                "count": len(lst),
                "type": "SCALAR",
            }
        )
        j_out["meshes"][0]["primitives"].append(
            {
                "attributes": {"POSITION": 0, "NORMAL": 1},
                "indices": acc_idx,
                "material": mat_idx,
                "mode": 4,
            }
        )
        acc_idx += 1
        mat_idx += 1

    if SRC.name.endswith(".glb.bak"):
        print(f"source: {SRC}")
    else:
        backup = SRC.with_suffix(".glb.bak")
        if not backup.exists():
            backup.write_bytes(SRC.read_bytes())
            print(f"backup -> {backup}")

    write_glb(j_out, bytes(new_blob), DST)
    print(f"wrote {DST} ({DST.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
