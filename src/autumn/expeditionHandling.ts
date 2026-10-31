import type { Role } from "./content";
import { assemblyPairWindow, type ExpeditionState } from "./expeditionContent";
export type ExpeditionHandMode =
  "" | "pump" | "lamp" | "carry" | "assemble" | "focus";
type HandState = { phase: number; expedition?: ExpeditionState };
/** Visual-only projection of authoritative activity. It never advances a challenge. */
export function expeditionHandMode(
  state: HandState | null | undefined,
  role: Role,
  gesture = "",
  age = -1,
  now = Date.now(),
): { mode: ExpeditionHandMode; pressure: number; step: number } {
  const expedition = state?.phase === 9 ? state.expedition : undefined;
  const resting = { mode: "" as ExpeditionHandMode, pressure: 0, step: 0 };
  if (!expedition) return resting;
  if (!expedition.carry.delivered && expedition.carry.holders.includes(role))
    return { mode: "carry", pressure: 0, step: 0 };
  if (expedition.operator?.role === role)
    return {
      mode: expedition.operator.route === "water" ? "pump" : "lamp",
      pressure: Number.isFinite(expedition.operator.value)
        ? Math.max(-1, Math.min(1, expedition.operator.value))
        : 0,
      step: 0,
    };
  if (expedition.receiver?.role === role)
    return {
      mode: "focus",
      pressure: Number.isFinite(expedition.receiver.value)
        ? Math.max(-1, Math.min(1, expedition.receiver.value))
        : 0,
      step: 0,
    };
  const pairedHold = expedition.assemblyReady.some(
    (entry) =>
      entry.role === role &&
      now - entry.at >= 0 &&
      now - entry.at < assemblyPairWindow,
  );
  const finishing = gesture === "exp-assemble" && age >= 0 && age < 0.85;
  if (pairedHold || finishing)
    return {
      mode: "assemble",
      pressure: 0,
      step: Math.min(2, Math.max(0, expedition.assembly)),
    };
  return resting;
}
