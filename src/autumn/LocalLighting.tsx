import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";

const MAX_LIGHTS = 6;
const NOMINAL_RADIUS = 0.12;
type Position = [number, number, number];
type Source = {
  object: T.Group;
  color: T.Color;
  radius: number;
  intensity: number;
  range?: number;
  flicker: number;
  enabled: boolean;
  position: T.Vector3;
  worldRadius: number;
  power: number;
  reach: number;
  score: number;
  seed: number;
};
type Blocker = {
  object: T.Group;
  size: T.Vector3;
  inverse: T.Matrix4;
  box: T.Box3;
};
type Registry = { sources: Set<Source>; blockers: Set<Blocker> };
const LightingContext = createContext<Registry | null>(null);

/** Retain a source through small rank changes, but allow a substantially nearer lamp in. */
export function chooseLightSources<TSource extends { score: number }>(
  candidates: readonly TSource[],
  retained: ReadonlySet<TSource>,
  limit: number,
): TSource[] {
  return candidates
    .filter((source) => Number.isFinite(source.score) && source.score > 0)
    .slice()
    .sort(
      (a, b) =>
        b.score * (retained.has(b) ? 1.22 : 1) -
        a.score * (retained.has(a) ? 1.22 : 1),
    )
    .slice(0, Math.max(0, Math.min(MAX_LIGHTS, limit)));
}

function visible(object: T.Object3D) {
  for (
    let current: T.Object3D | null = object;
    current;
    current = current.parent
  )
    if (!current.visible) return false;
  return true;
}

/** Empty transform node: safe inside a hand, moving vehicle, or static geometry batch. */
export function LocalLightSource({
  position = [0, 0, 0],
  color = "#ffc67c",
  radius = NOMINAL_RADIUS,
  intensity = 4,
  range,
  flicker = 0.025,
  enabled = true,
}: {
  position?: Position;
  color?: T.ColorRepresentation;
  /** Local luminous radius, before inherited object scale. */
  radius?: number;
  /** Candela at the nominal 12cm radius; total energy scales with luminous area. */
  intensity?: number;
  /** Optional world-space cutoff; the shader tapers smoothly to zero here. */
  range?: number;
  flicker?: number;
  enabled?: boolean;
}) {
  const registry = useContext(LightingContext);
  const group = useRef<T.Group>(null);
  const source = useMemo<Source>(
    () => ({
      object: null!,
      color: new T.Color(),
      radius: NOMINAL_RADIUS,
      intensity: 4,
      flicker: 0.025,
      enabled: true,
      position: new T.Vector3(),
      worldRadius: NOMINAL_RADIUS,
      power: 4,
      reach: 7,
      score: 0,
      seed: 0,
    }),
    [],
  );
  useLayoutEffect(() => {
    source.color.set(color);
    source.radius = Number.isFinite(radius)
      ? Math.max(0.01, radius)
      : NOMINAL_RADIUS;
    source.intensity = Number.isFinite(intensity) ? Math.max(0, intensity) : 0;
    source.range =
      range !== undefined && Number.isFinite(range) ? range : undefined;
    source.flicker = Number.isFinite(flicker)
      ? T.MathUtils.clamp(flicker, 0, 0.1)
      : 0;
    source.enabled = enabled;
  }, [source, color, radius, intensity, range, flicker, enabled]);
  useLayoutEffect(() => {
    if (!registry || !group.current) return;
    source.object = group.current;
    source.seed = group.current.id * 1.618;
    registry.sources.add(source);
    return () => {
      registry.sources.delete(source);
    };
  }, [registry, source]);
  return <group ref={group} position={position} />;
}

/** An invisible solid-wall volume for cheap source visibility checks, with no render cost. */
export function LocalLightBlocker({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size,
}: {
  position?: Position;
  rotation?: Position;
  size: Position;
}) {
  const registry = useContext(LightingContext);
  const group = useRef<T.Group>(null);
  const blocker = useMemo<Blocker>(
    () => ({
      object: null!,
      size: new T.Vector3(),
      inverse: new T.Matrix4(),
      box: new T.Box3(),
    }),
    [],
  );
  useLayoutEffect(() => {
    blocker.size.fromArray(size);
    blocker.box.min.copy(blocker.size).multiplyScalar(-0.5);
    blocker.box.max.copy(blocker.size).multiplyScalar(0.5);
  }, [blocker, size[0], size[1], size[2]]);
  useLayoutEffect(() => {
    if (!registry || !group.current) return;
    blocker.object = group.current;
    registry.blockers.add(blocker);
    return () => {
      registry.blockers.delete(blocker);
    };
  }, [registry, blocker]);
  return <group ref={group} position={position} rotation={rotation} />;
}

/** Six persistent light uniforms; changing nearby sources never recompiles PBR shaders. */
export function LocalLightingProvider({
  quality = "high",
  children,
}: {
  quality?: string;
  children: ReactNode;
}) {
  const registry = useMemo<Registry>(
    () => ({ sources: new Set(), blockers: new Set() }),
    [],
  );
  const pool = useMemo(
    () =>
      Array.from({ length: MAX_LIGHTS }, (_, index) => {
        const light = new T.PointLight("#ffc67c", 0, 7, 2);
        light.name = `local-illumination-${index}`;
        // Omnidirectional shadows require six extra scene passes per lamp. Keep
        // these surface lights unshadowed; opaque walls reject hidden sources.
        light.castShadow = false;
        return {
          light,
          source: null as Source | null,
          next: null as Source | null,
          gain: 0,
        };
      }),
    [],
  );
  const scratch = useMemo(
    () => ({
      scale: new T.Vector3(),
      camera: new T.Vector3(),
      direction: new T.Vector3(),
      delta: new T.Vector3(),
      localCamera: new T.Vector3(),
      localSource: new T.Vector3(),
      hit: new T.Vector3(),
      ray: new T.Ray(),
      candidates: [] as Source[],
      blockers: [] as Blocker[],
      retained: new Set<Source>(),
      assigned: new Set<Source>(),
      selectionAt: -Infinity,
      debugAt: -Infinity,
    }),
    [],
  );
  const reducedMotion = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reducedMotion.current = query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(
    () => () => {
      registry.sources.clear();
      registry.blockers.clear();
      pool.forEach(({ light }) => light.dispose());
    },
    [pool, registry],
  );

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = clock.elapsedTime;
    const limit = quality === "low" ? 2 : quality === "high" ? 6 : 4;
    const updateSource = (source: Source) => {
      source.object.updateWorldMatrix(true, false);
      source.position.setFromMatrixPosition(source.object.matrixWorld);
      scratch.scale.setFromMatrixScale(source.object.matrixWorld);
      // Geometric mean handles nonuniform decorative scales without oversized pools.
      const scale = Math.cbrt(
        Math.abs(scratch.scale.x * scratch.scale.y * scratch.scale.z),
      );
      source.worldRadius = source.radius * scale;
      source.power = Math.min(
        96,
        source.intensity * (source.worldRadius / NOMINAL_RADIUS) ** 2,
      );
      source.reach = T.MathUtils.clamp(
        source.range ?? 5 + source.worldRadius * 20,
        1,
        14,
      );
    };
    if (now - scratch.selectionAt >= 0.125 || now < scratch.selectionAt) {
      scratch.selectionAt = now;
      camera.getWorldPosition(scratch.camera);
      camera.getWorldDirection(scratch.direction);
      scratch.candidates.length = scratch.blockers.length = 0;
      scratch.retained.clear();
      scratch.assigned.clear();
      for (const slot of pool)
        if (slot.source) scratch.retained.add(slot.source);
      for (const blocker of registry.blockers) {
        if (!visible(blocker.object)) continue;
        blocker.object.updateWorldMatrix(true, false);
        blocker.inverse.copy(blocker.object.matrixWorld).invert();
        scratch.blockers.push(blocker);
      }
      for (const source of registry.sources) {
        source.score = 0;
        if (!source.enabled || !visible(source.object)) continue;
        updateSource(source);
        scratch.delta.subVectors(source.position, scratch.camera);
        const distanceSq = scratch.delta.lengthSq();
        // A lamp beyond its surface influence plus a small view margin cannot help.
        if (distanceSq > (source.reach + 7) ** 2 || source.power <= 0) continue;
        let blocked = false;
        for (const blocker of scratch.blockers) {
          scratch.localCamera
            .copy(scratch.camera)
            .applyMatrix4(blocker.inverse);
          scratch.localSource
            .copy(source.position)
            .applyMatrix4(blocker.inverse);
          scratch.ray.origin.copy(scratch.localCamera);
          scratch.ray.direction.subVectors(
            scratch.localSource,
            scratch.localCamera,
          );
          const distance = scratch.ray.direction.length();
          scratch.ray.direction.multiplyScalar(1 / Math.max(distance, 0.0001));
          const hit = scratch.ray.intersectBox(blocker.box, scratch.hit);
          if (hit && hit.distanceTo(scratch.localCamera) < distance - 0.015) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        const front =
          scratch.delta.dot(scratch.direction) /
          Math.sqrt(Math.max(0.01, distanceSq));
        // Behind-camera lamps still illuminate the visible ground and the other player.
        const viewWeight = T.MathUtils.lerp(
          0.55,
          1,
          T.MathUtils.smoothstep(front, -0.35, 0.65),
        );
        source.score = (source.power * viewWeight) / (1 + distanceSq);
        scratch.candidates.push(source);
      }
      const selected = chooseLightSources(
        scratch.candidates,
        scratch.retained,
        limit,
      );
      for (let index = 0; index < pool.length; index++) {
        const slot = pool[index];
        slot.next =
          index < limit && slot.source && selected.includes(slot.source)
            ? slot.source
            : null;
        if (slot.next) scratch.assigned.add(slot.next);
      }
      for (let index = 0; index < limit; index++) {
        const slot = pool[index];
        if (slot.next) continue;
        slot.next =
          selected.find((source) => !scratch.assigned.has(source)) ?? null;
        if (slot.next) scratch.assigned.add(slot.next);
      }
    }
    for (const slot of pool) {
      const same = slot.source === slot.next;
      const live =
        slot.source &&
        registry.sources.has(slot.source) &&
        slot.source.enabled &&
        visible(slot.source.object);
      slot.gain = T.MathUtils.damp(
        slot.gain,
        same && live ? 1 : 0,
        same ? 9 : 18,
        dt,
      );
      if (!same && slot.gain < 0.015) {
        // Move only while dark, so a pooled light never sweeps through a wall.
        slot.source = slot.next;
        slot.gain = 0;
      }
      const source = slot.source;
      if (!source) {
        slot.light.intensity = 0;
        continue;
      }
      if (registry.sources.has(source)) updateSource(source);
      slot.light.position.copy(source.position);
      slot.light.color.lerp(source.color, 1 - Math.exp(-12 * dt));
      slot.light.distance = source.reach;
      const flame = reducedMotion.current
        ? 1
        : 1 +
          source.flicker *
            (Math.sin(now * 11.3 + source.seed) * 0.55 +
              Math.sin(now * 18.1 + source.seed * 1.37) * 0.25 +
              Math.sin(now * 3.7 + source.seed * 0.71) * 0.2);
      slot.light.intensity = source.power * slot.gain * flame;
    }
    if (import.meta.env.DEV && now - scratch.debugAt > 1) {
      scratch.debugAt = now;
      const debug = (window as any).__autumn;
      if (debug)
        debug.localLighting = {
          registered: registry.sources.size,
          blockers: registry.blockers.size,
          eligible: scratch.candidates.length,
          budget: limit,
          lights: pool.map(({ light, source }) => ({
            intensity: +light.intensity.toFixed(2),
            radius: source?.worldRadius,
            position: light.position.toArray(),
          })),
        };
    }
  });
  return (
    <LightingContext.Provider value={registry}>
      {children}
      {pool.map(({ light }) => (
        <primitive key={light.uuid} object={light} dispose={null} />
      ))}
    </LightingContext.Provider>
  );
}
