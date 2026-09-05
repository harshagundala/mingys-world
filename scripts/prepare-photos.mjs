import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
const files = fs
  .readdirSync("pictures")
  .filter((f) => /heic|jpe?g|png/i.test(f))
  .sort();
fs.mkdirSync("private-assets/photos", { recursive: true });
fs.mkdirSync("output/photos", { recursive: true });
let thumbs = [];
for (let i = 0; i < files.length; i++) {
  const temp = `output/photos/${i}.jpg`;
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", path.join("pictures", files[i]), "--out", temp],
    { stdio: "ignore" },
  );
  await sharp(temp)
    .rotate()
    .resize({
      width: 1440,
      height: 1440,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 83 })
    .toFile(`private-assets/photos/${i}.webp`);
  await sharp(temp)
    .rotate()
    .resize({
      width: 360,
      height: 360,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toFile(`private-assets/photos/${i}-thumb.webp`);
  thumbs.push({
    input: await sharp(temp)
      .rotate()
      .resize(180, 150, { fit: "contain", background: "#172522" })
      .jpeg()
      .toBuffer(),
    left: (i % 6) * 190,
    top: Math.floor(i / 6) * 180,
  });
  thumbs.push({
    input: Buffer.from(
      `<svg width="180" height="25"><rect width="180" height="25" fill="#172522"/><text x="8" y="18" fill="white" font-size="15">${i} · ${files[i]}</text></svg>`,
    ),
    left: (i % 6) * 190,
    top: Math.floor(i / 6) * 180 + 150,
  });
}
await sharp({
  create: {
    width: 1140,
    height: Math.ceil(files.length / 6) * 180,
    channels: 3,
    background: "#172522",
  },
})
  .composite(thumbs)
  .jpeg()
  .toFile("output/photos/contact-sheet.jpg");
fs.writeFileSync(
  "src/game/photos.json",
  JSON.stringify({ count: files.length }),
);
console.log(
  `Prepared ${files.length} photos, stripped metadata, generated gallery and thumbnails.`,
);
