import { Cache, FileLoader, ImageLoader } from "three";
import { preloadSkyAssets } from "./skyAssets";

let started = false;

export function preloadAutumnAssets() {
  if (started) return;
  started = true;
  // Three shares successful images/buffers with the eventual scene loaders.
  // Failed ImageLoader entries are removed; FileLoader only caches success.
  // In particular, warming never seeds a failed useGLTF/Suspense promise.
  Cache.enabled = true;
  preloadSkyAssets();
  const images = [
    "/textures/ground-color.webp",
    "/textures/path-color.webp",
    "/textures/bark-color.webp",
    "/textures/autumn-leaf-cluster.webp",
    "/textures/woodland-fern.webp",
    ...["ground", "path", "bark"].flatMap((name) =>
      ["normal", "rough"].map((channel) => `/textures/${name}-${channel}.webp`),
    ),
    ...["wood", "stone", "plaster"].flatMap((name) =>
      ["color", "normal", "rough"].map(
        (channel) => `/textures/${name}-${channel}.webp`,
      ),
    ),
  ];
  const jobs: (() => Promise<unknown>)[] = images.map(
    (url) => () =>
      new ImageLoader().loadAsync(url).then(async (image) => {
        await image.decode?.().catch(() => {});
      }),
  );
  for (const animal of ["deer", "rabbit"])
    jobs.push(() =>
      new FileLoader()
        .setResponseType("arraybuffer")
        .loadAsync(`/models/autumn/${animal}.glb`),
    );
  // Keep foreground art/fonts/media responsive rather than starting every
  // texture simultaneously. Normal scene requests can still jump this queue.
  let next = 0;
  const work = async () => {
    while (next < jobs.length) await jobs[next++]().catch(() => {});
  };
  for (let i = 0; i < 3; i++) void work();
}
