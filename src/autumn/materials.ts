import * as T from "three";

export type SurfaceTexture =
  "wood" | "bark" | "plaster" | "stone" | "ground" | "path";
export type TextureChannel = "color" | "normal" | "rough";
const cache = new Map<string, T.Texture>();
const sources = new Map<string, T.Texture>();
const sourceVariants = new Map<string, Set<T.Texture>>();
const bundles = new Map<string, ReturnType<typeof makeBundle>>();
const loader = new T.TextureLoader();

/** Local, shared textures. Neutral one-pixel fallbacks keep the world visible during first load. */
export function textureAsset(
  name: SurfaceTexture,
  channel: TextureChannel,
  repeat: [number, number] = [1, 1],
) {
  const key = `${name}:${channel}:${repeat.join(",")}`;
  let texture = cache.get(key);
  if (texture) return texture;
  const sourceKey = `${name}:${channel}`;
  let source = sources.get(sourceKey);
  if (!source) {
    const fallback = document.createElement("canvas");
    fallback.width = fallback.height = 1;
    const c = fallback.getContext("2d")!;
    c.fillStyle =
      channel === "normal"
        ? "#8080ff"
        : channel === "rough"
          ? "#d9d9d9"
          : "#c6c1b4";
    c.fillRect(0, 0, 1, 1);
    const variants = new Set<T.Texture>();
    sourceVariants.set(sourceKey, variants);
    source = loader.load(
      `/textures/${name}-${channel}.webp`,
      () => {
        // Clones share the image Source, but each Texture must observe the upload.
        // WebGL2 storage is immutable: release the one-pixel allocation before
        // replacing it with the full-size photograph, otherwise uploads overflow.
        for (const variant of variants) variant.dispose();
        for (const variant of variants) variant.needsUpdate = true;
      },
      undefined,
      () => {},
    );
    source.image = fallback;
    source.wrapS = source.wrapT = T.RepeatWrapping;
    source.colorSpace = channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
    source.anisotropy = 8;
    sources.set(sourceKey, source);
  }
  // UV repeats belong to the material instance. Shared Source and sampler
  // settings let Three reuse one GPU upload for every physical surface scale.
  texture = source.clone();
  texture.repeat.set(...repeat);
  sourceVariants.get(sourceKey)!.add(texture);
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}
function makeBundle(name: SurfaceTexture, repeat: [number, number]) {
  return {
    map: textureAsset(name, "color", repeat),
    normalMap: textureAsset(name, "normal", repeat),
    roughnessMap: textureAsset(name, "rough", repeat),
  };
}
export function pbrTextures(
  name: SurfaceTexture,
  repeat: [number, number] = [1, 1],
) {
  const key = `${name}:${repeat.join(",")}`;
  let maps = bundles.get(key);
  if (!maps) {
    maps = makeBundle(name, repeat);
    bundles.set(key, maps);
  }
  return maps;
}

/** Cylinder instance UVs scale with physical circumference/height instead of the unit source mesh. */
export function instanceBarkUV(shader: T.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <uv_vertex>",
    `#include <uv_vertex>
    #ifdef USE_INSTANCING
      vec2 physicalBarkScale=vec2(length(instanceMatrix[0].xyz)*5.2,length(instanceMatrix[1].xyz))*.65;
      #ifdef USE_MAP
        vMapUv *= physicalBarkScale;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv *= physicalBarkScale;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv *= physicalBarkScale;
      #endif
    #endif
  `,
  );
}
