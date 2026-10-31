import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

// These originals only retain decoded CPU data. Renderers own disposable clones.
let photograph: T.Texture | null = null;
let radiance: T.DataTexture | null = null;
let photographPending: Promise<T.Texture> | null = null;
let radiancePending: Promise<T.DataTexture> | null = null;

export const peekSkyPhotograph = () => photograph;
export const peekSkyRadiance = () => radiance;

export function loadSkyPhotograph(): Promise<T.Texture> {
  if (photograph) return Promise.resolve(photograph);
  if (!photographPending) {
    photographPending = new T.TextureLoader()
      .loadAsync("/textures/autumn-sky.webp")
      .then((texture) => {
        photograph = texture;
        return texture;
      })
      .finally(() => {
        // A failed speculative request must not poison a later actual join.
        photographPending = null;
      });
  }
  return photographPending;
}

export function loadSkyRadiance(): Promise<T.DataTexture> {
  if (radiance) return Promise.resolve(radiance);
  if (!radiancePending) {
    radiancePending = new HDRLoader()
      .loadAsync("/textures/autumn-light.hdr")
      .then((texture) => {
        radiance = texture;
        return texture;
      })
      .finally(() => {
        radiancePending = null;
      });
  }
  return radiancePending;
}

/** Optional lobby warmup: both transfers start together; failure never blocks entry. */
export function preloadSkyAssets(): void {
  void Promise.allSettled([loadSkyPhotograph(), loadSkyRadiance()]);
}
