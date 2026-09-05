import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
const textures = new Map<string, THREE.CanvasTexture>(),
  materials = new Map<string, THREE.Material>(),
  geometries = new Map<string, THREE.BufferGeometry>();
export function surfaceTexture(
  kind: "wood" | "fabric" | "stone" | "paper" | "leaf",
) {
  if (textures.has(kind)) return textures.get(kind)!;
  const c = document.createElement("canvas");
  c.width = c.height = kind === "wood" ? 1024 : 512;
  const x = c.getContext("2d")!,
    w = c.width;
  x.fillStyle = "#b9b4a6";
  x.fillRect(0, 0, w, w);
  let seed = 191;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (kind === "wood") {
    for (let y = 0; y < w; y++) {
      const a = 0.05 + rand() * 0.16;
      x.strokeStyle = `rgba(40,23,12,${a})`;
      x.beginPath();
      for (let t = 0; t <= w; t += 8) {
        const q =
          y + Math.sin(t * 0.012 + y * 0.03) * 2.5 + Math.sin(t * 0.041) * 0.6;
        x.lineTo(t, q);
      }
      x.stroke();
    }
    for (let i = 0; i < 9; i++) {
      let px = rand() * w,
        py = rand() * w;
      for (let r = 3; r < 24; r += 3) {
        x.strokeStyle = "rgba(50,27,14,.12)";
        x.beginPath();
        x.ellipse(px, py, r * 3, r * 0.55, 0.02, 0, Math.PI * 2);
        x.stroke();
      }
    }
  } else if (kind === "fabric") {
    for (let i = 0; i < w; i += 3) {
      x.fillStyle = i % 2 ? "#b5b0a3" : "#d4cebd";
      x.fillRect(i, 0, 1, w);
      x.fillStyle = "rgba(45,40,32,.14)";
      x.fillRect(0, i, w, 1);
    }
  } else if (kind === "leaf") {
    x.fillStyle = "#c3c8a2";
    x.fillRect(0, 0, w, w);
    x.strokeStyle = "#63794a";
    x.lineWidth = 7;
    x.beginPath();
    x.moveTo(w / 2, 0);
    x.lineTo(w / 2, w);
    x.stroke();
    for (let i = 40; i < w; i += 48) {
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(w / 2, i);
      x.lineTo(15, i - 70);
      x.moveTo(w / 2, i);
      x.lineTo(w - 15, i - 70);
      x.stroke();
    }
  } else {
    for (let i = 0; i < 22000; i++) {
      x.fillStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "25,22,20"},${rand() * 0.09})`;
      x.fillRect(rand() * w, rand() * w, rand() * 3 + 1, 1);
    }
    if (kind === "stone")
      for (let i = 0; i < 24; i++) {
        x.strokeStyle = "rgba(80,83,78,.06)";
        x.beginPath();
        let y = rand() * w;
        for (let t = 0; t < w; t += 7)
          x.lineTo(t, y + Math.sin(t * 0.03 + i) * 18);
        x.stroke();
      }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  textures.set(kind, tex);
  return tex;
}
const woods = new Set([
  "#6c422d",
  "#3f2923",
  "#a58964",
  "#a88a60",
  "#342b29",
  "#a67555",
  "#9f8353",
  "#b58a42",
  "#946b45",
  "#c0a078",
]);
const fabrics = new Set([
  "#507263",
  "#648574",
  "#9b594b",
  "#855850",
  "#596c6e",
  "#9b6655",
  "#9b594b",
  "#33535b",
]);
export function surfaceMaterial(color: string, metal = 0, emissive?: string) {
  const key = `${color}-${metal}-${emissive}`;
  if (materials.has(key)) return materials.get(key)!;
  const kind = woods.has(color)
    ? "wood"
    : fabrics.has(color)
      ? "fabric"
      : "stone";
  const tex = surfaceTexture(kind);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: metal || emissive ? null : tex,
    bumpMap: metal || emissive ? null : tex,
    bumpScale: kind === "wood" ? 0.018 : 0.009,
    roughness: metal
      ? 0.3
      : kind === "wood"
        ? 0.58
        : kind === "fabric"
          ? 0.95
          : 0.8,
    metalness: metal,
    emissive: emissive || "#000",
    emissiveIntensity: emissive ? 1.5 : 0,
  });
  materials.set(key, mat);
  return mat;
}
export function roundedGeometry(s: number[]) {
  const key = s.join(",");
  if (!geometries.has(key))
    geometries.set(
      key,
      new RoundedBoxGeometry(
        s[0],
        s[1],
        s[2],
        1,
        Math.min(0.045, Math.min(...s) * 0.13),
      ),
    );
  return geometries.get(key)!;
}
