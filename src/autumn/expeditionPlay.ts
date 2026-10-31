import type { Role } from "./content";
import {
  assemblyPads,
  carryWaypoints,
  expeditionControls,
  expeditionOperator,
  expeditionPathsComplete,
  heartCradle,
  lightReceivers,
  lookout,
  returnPoint,
  waterReceivers,
} from "./expeditionContent";
import type { ExpeditionState } from "./expeditionContent";

export type ExpeditionTarget = {
  id: string;
  x: number;
  z: number;
  label: string;
  kind: "expedition";
  action: string;
  role?: Role;
};
export function expeditionTargets(
  e: ExpeditionState,
  role: Role,
): ExpeditionTarget[] {
  const out: ExpeditionTarget[] = [];
  const add = (
    id: string,
    p: { x: number; z: number },
    label: string,
    action: string,
  ) => out.push({ id, ...p, label, action, kind: "expedition", role });
  if (!e.keepsakes.includes(role))
    add("lookout", lookout, "Keep a glass leaf", "exp-keepsake");
  if (e.assembly >= 3) {
    if (!e.returnReady.includes(role))
      add(
        "return",
        returnPoint,
        "Return to Bramblewick together",
        "exp-return",
      );
    return out;
  }
  if (!expeditionPathsComplete(e)) {
    for (const route of ["water", "light"] as const) {
      const done = e[route];
      const index = [0, 1, 2].find((i) => !done.includes(i));
      if (index === undefined) continue;
      if (role === expeditionOperator(route, index)) {
        add(
          `${route}-control`,
          expeditionControls[route],
          e.operator?.role === role && e.operator.route === route
            ? route === "water"
              ? "Release the sluice wheel"
              : "Set down the storm lamp"
            : route === "water"
              ? "Take the sluice wheel"
              : "Take the storm lamp",
          "exp-use",
        );
      } else {
        const charged = e[`${route}Charge`][index] >= 1;
        add(
          route === "light" && !charged
            ? `light-focus-${index}`
            : `${route}-${index}`,
          (route === "water" ? waterReceivers : lightReceivers)[index],
          charged
            ? "Recover the glass piece"
            : route === "water"
              ? "Read the water gauge"
              : e.receiver?.role === role && e.receiver.index === index
                ? "Release the focusing ring"
                : "Take the focusing ring",
          route === "light" && !charged ? "exp-use" : "exp-collect",
        );
      }
    }
  } else if (!e.carry.delivered) {
    const held = e.carry.holders.includes(role);
    if (e.carry.checkpoint >= carryWaypoints.length)
      add("cradle", heartCradle, "Set the heart in its cradle", "exp-place");
    if (!held)
      add("heart", e.carry, "Take your side of the glass heart", "exp-grip");
    if (held && e.carry.checkpoint < carryWaypoints.length)
      add(
        "carry-waypoint",
        carryWaypoints[e.carry.checkpoint],
        "Carry it here together",
        "exp-guide",
      );
  } else {
    add(
      `assembly-${e.assembly}-${role}`,
      assemblyPads[e.assembly][role],
      "Turn together on three",
      "exp-assemble",
    );
  }
  return out;
}

export function expeditionProgress(e: ExpeditionState) {
  if (e.assembly >= 3)
    return "The hollow is awake. Stay a moment, or head home together.";
  if (e.carry.delivered) return `${e.assembly}/3 mechanisms restored`;
  if (expeditionPathsComplete(e))
    return `${e.carry.checkpoint}/4 trail markers · carry the heart together`;
  return `Waterworks ${e.water.length}/3 · Lantern trail ${e.light.length}/3`;
}
