// Build-time acquisition only. Runtime assets are local, versioned, and CC0.
import { execFileSync } from "node:child_process";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
const ua = "Mingy asset preparation (https://mingy.world)";
const json = (url) =>
  JSON.parse(
    execFileSync("curl", ["-fsSL", "--retry", "2", "-A", ua, url], {
      maxBuffer: 20e6,
    }).toString(),
  );
const assets = {
  wood: "wood_planks",
  bark: "bark_brown_02",
  plaster: "plastered_wall_02",
  stone: "rock_face",
  ground: "brown_mud_leaves_01",
  path: "brown_mud_rocks_01",
};
await mkdir("public/textures", { recursive: true });
await mkdir("output/material-source", { recursive: true });
const manifest = [];
for (const [name, id] of Object.entries(assets)) {
  const files = json("https://api.polyhaven.com/files/" + id);
  for (const [channel, key] of Object.entries({
    color: "Diffuse",
    normal: "nor_gl",
    rough: "Rough",
  })) {
    const size = "1k";
    const entry = files[key]?.[size]?.jpg || files[key]?.[size]?.png;
    if (!entry)
      throw new Error(id + " missing " + key + " " + Object.keys(files));
    const raw = "output/material-source/" + name + "-" + channel + ".jpg";
    execFileSync("curl", [
      "-fsSL",
      "--retry",
      "2",
      "-A",
      ua,
      entry.url,
      "-o",
      raw,
    ]);
    await sharp(raw)
      .resize(
        channel === "rough" ? 512 : 1024,
        channel === "rough" ? 512 : 1024,
      )
      .webp({ quality: channel === "normal" ? 90 : 86 })
      .toFile("public/textures/" + name + "-" + channel + ".webp");
  }
  manifest.push({
    name,
    id,
    source: "https://polyhaven.com/a/" + id,
    license: "CC0",
  });
  console.log(name + " ready");
}
const skyId = "kloppenheim_06_puresky",
  sky = json("https://api.polyhaven.com/files/" + skyId);
execFileSync("curl", [
  "-fsSL",
  "--retry",
  "2",
  "-A",
  ua,
  sky.tonemapped.url,
  "-o",
  "output/material-source/sky.jpg",
]);
await sharp("output/material-source/sky.jpg")
  .resize(4096, 2048)
  .webp({ quality: 90 })
  .toFile("public/textures/autumn-sky.webp");
execFileSync("curl", [
  "-fsSL",
  "--retry",
  "2",
  "-A",
  ua,
  sky.hdri["1k"].hdr.url,
  "-o",
  "public/textures/autumn-light.hdr",
]);
manifest.push({
  name: "sky",
  id: skyId,
  source: "https://polyhaven.com/a/" + skyId,
  license: "CC0",
});
await writeFile(
  "public/textures/sources.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("sky ready");
