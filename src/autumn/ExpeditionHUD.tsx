import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { names } from "./content";
import type { Role } from "./content";
import {
  waterReceivers,
  waterTarget,
  focusTarget,
  expeditionOperator,
  expeditionPathsComplete,
  assemblyPairWindow,
} from "./expeditionContent";
import type { ExpeditionState } from "./expeditionContent";
import { input } from "./controls";
import { net } from "./network";
import { sound } from "./sound";

function Gauge({
  kind,
  index,
  value,
  showTarget,
}: {
  kind: "water" | "focus";
  index: number;
  value: () => number;
  showTarget: boolean;
}) {
  const needle = useRef<HTMLElement>(null),
    band = useRef<HTMLElement>(null);
  const readValue = useRef(value);
  readValue.current = value;
  useEffect(() => {
    let raf = 0;
    let last = performance.now(),
      smoothed = readValue.current();
    const tick = () => {
      const now = Date.now() + net.clockOffset;
      const frame = performance.now(),
        dt = Math.min((frame - last) / 1000, 0.1);
      last = frame;
      smoothed += (readValue.current() - smoothed) * (1 - Math.exp(-dt * 20));
      if (needle.current) needle.current.style.left = `${(smoothed + 1) * 50}%`;
      if (band.current)
        band.current.style.left = `${((kind === "water" ? waterTarget(index, now) : focusTarget(index, now)) + 1) * 50}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, index]);
  return (
    <div
      className="ll-exp-gauge"
      aria-label={kind === "water" ? "Water pressure" : "Lens focus"}
    >
      {showTarget && <i ref={band} />}
      <b ref={needle} />
      <span>LOW</span>
      <span>HIGH</span>
    </div>
  );
}
function TurnControls() {
  return (
    <div className="ll-steer">
      <button
        aria-label="Turn left"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          input.touch.x = -1;
        }}
        onPointerUp={() => (input.touch.x = 0)}
        onPointerCancel={() => (input.touch.x = 0)}
      >
        <ArrowLeft size={17} />
      </button>
      <span>A / D</span>
      <button
        aria-label="Turn right"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          input.touch.x = 1;
        }}
        onPointerUp={() => (input.touch.x = 0)}
        onPointerCancel={() => (input.touch.x = 0)}
      >
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
export function ExpeditionHUD({ e, role }: { e: ExpeditionState; role: Role }) {
  const current = useRef(e);
  current.current = e;
  const [atWater, setAtWater] = useState(false);
  const waterIndex = e.water.length;
  useEffect(() => {
    const update = () => {
      const p = waterReceivers[waterIndex],
        local = net.local;
      setAtWater(
        !!p &&
          role !== expeditionOperator("water", waterIndex) &&
          Math.hypot(local.x - p.x, local.z - p.z) < 3.8,
      );
    };
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [role, waterIndex]);
  useEffect(() => {
    if (e.assembly >= 3) return;
    const bell = () => {
      if (document.hidden) return;
      sound.note(164.81, 3.8, 0.055, "sine");
      sound.note(329.63, 2.9, 0.025, "sine", 0.035);
    };
    const first = setTimeout(bell, 1500),
      repeat = setInterval(bell, 24000);
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [e.assembly >= 3]);
  const op = e.operator?.role === role ? e.operator : null;
  const receiver = e.receiver?.role === role ? e.receiver : null;
  const carrying = e.carry.holders.includes(role) && !e.carry.delivered;
  const assembly = e.carry.delivered && e.assembly < 3;
  const ready = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!assembly) return;
    const draw = () => {
      const now = Date.now() + net.clockOffset;
      const waiting = current.current.assemblyReady.some(
        (r) => now - r.at < assemblyPairWindow && now >= r.at,
      );
      if (ready.current)
        ready.current.textContent = waiting
          ? "Now — turn the other handle."
          : "Count together, then both press E.";
    };
    draw();
    const timer = setInterval(draw, 100);
    return () => clearInterval(timer);
  }, [assembly]);
  let title = "",
    description = "",
    progress: number | null = null;
  if (op?.route === "water") {
    title = "At the sluice wheel";
    description = `${names[1 - role]} can read the far gauge. Let them guide your pressure.`;
    progress = e.waterCharge[op.index];
  } else if (op?.route === "light") {
    title = "Hold the light steady";
    description = `Aim at the drifting receiver. ${names[1 - role]} focuses the ring.`;
    progress = e.lightCharge[op.index];
  } else if (receiver) {
    title = "Bring the light into focus";
    description =
      "Keep your marker in gold while your Mingy follows the receiver.";
    progress = e.lightCharge[receiver.index];
  } else if (atWater) {
    title = "You can read the gauge";
    description =
      "Guide your Mingy: lower or higher. Keep the white needle in gold.";
    progress = e.waterCharge[waterIndex];
  } else if (carrying) {
    title =
      e.carry.holders.length === 2 ? "Walk in step" : "Your side is ready";
    description =
      e.carry.holders.length === 2
        ? "Follow the next trail light. Stay close; the heart moves between you."
        : "Your Mingy takes the other handle. E sets it down safely.";
  } else if (assembly) {
    title = ["Seat the glass", "Open the channels", "Let the roof breathe"][
      e.assembly
    ];
  }
  if (!title) return null;
  const receiverReady = !!receiver && e.lightCharge[receiver.index] >= 1;
  const release = () =>
    net.action(
      carrying
        ? { kind: "exp-grip" }
        : receiverReady
          ? { kind: "exp-collect", target: `light-${receiver!.index}` }
          : receiver
            ? { kind: "exp-use", target: `light-focus-${receiver.index}` }
            : { kind: "exp-use", target: `${op?.route}-control` },
    );
  return (
    <aside className="ll-exp-hud" aria-label="Cooperative instrument">
      <span className="ll-eyebrow">{title}</span>
      {description && <p>{description}</p>}
      {op?.route === "water" && (
        <Gauge
          kind="water"
          index={op.index}
          value={() => input.mechanism}
          showTarget={false}
        />
      )}
      {receiver && (
        <Gauge
          kind="focus"
          index={receiver.index}
          value={() => input.mechanism}
          showTarget
        />
      )}
      {atWater && !op && !receiver && (
        <Gauge
          kind="water"
          index={waterIndex}
          value={() =>
            current.current.operator?.route === "water"
              ? current.current.operator.value
              : 0
          }
          showTarget
        />
      )}
      {progress !== null && (
        <div className="ll-exp-progress">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      {(op?.route === "water" || receiver) && <TurnControls />}
      {assembly && (
        <p>
          <span ref={ready} />
        </p>
      )}
      {progress !== null && progress >= 1 && !op && (
        <p className="ll-exp-ready">E · Recover the glass piece</p>
      )}
      {(op || receiver || carrying) && (
        <button className="ll-exp-release" onClick={release}>
          {carrying
            ? "Set down"
            : receiverReady
              ? "Recover the glass piece"
              : "Release instrument"}{" "}
          · E
        </button>
      )}
      {atWater && !e.operator && !expeditionPathsComplete(e) && (
        <small>Your Mingy takes the wheel across the channel.</small>
      )}
    </aside>
  );
}
