import { useEffect, useId, useMemo, useRef } from "react";
import {
  colors,
  lanternStands,
  obstacles,
  props,
  rand,
  riverLength,
  riverStops,
  stations,
  tables,
  towers,
} from "./content";
import type { Role } from "./content";
import type { State } from "../../server/autumn/rules";
import { net } from "./network";
import { input } from "./controls";
import { expeditionTargets } from "./expeditionPlay";
import {
  carryWaypoints,
  expeditionControls,
  waterReceivers,
  lightReceivers,
} from "./expeditionContent";

function destinations(s: State, role: Role) {
  if (s.phase === 9) return expeditionTargets(s.expedition, role);
  if (s.phase === 0)
    return s.ready.includes(role)
      ? []
      : [stations[`welcome-${role}` as keyof typeof stations]].filter(Boolean);
  if (s.phase === 1)
    return s.bags[role].length >= 3
      ? [stations.cart]
      : [
          ...props.filter((p) => p.phase === 1 && !s.collected.includes(p.id)),
          stations.cart,
        ];
  if (s.phase === 2)
    return s.bags[role].length
      ? [stations.bench]
      : s.timber >= 3
        ? [stations.bench]
        : [
            ...props.filter(
              (p) => p.phase === 2 && !s.collected.includes(p.id),
            ),
            stations.bench,
          ];
  if (s.phase === 3) return [stations.dock];
  if (s.phase === 4)
    return s.dish?.cooked
      ? [tables[Math.min(7, s.order)]]
      : [
          stations.prep,
          stations.stove,
          stations.pantryApple,
          stations.pantryMushroom,
          stations.pantryPumpkin,
        ];
  if (s.phase === 5) return [stations[`pitch-${role}`]];
  if (s.phase === 6) return towers.filter((_, i) => !s.towers.includes(i));
  if (s.phase === 7)
    return s.hands[role]
      ? lanternStands.filter((p) => p.role === role && !s.lanterns[p.id])
      : [stations.lanternTable, stations[`launch-${role}`]];
  return [];
}
/** North-up survey, animated outside React so network updates never quantize motion. */
export function MiniMap({ s, role }: { s: State; role: Role }) {
  const player = useRef<SVGGElement>(null),
    partner = useRef<SVGGElement>(null),
    distance = useRef<HTMLSpanElement>(null),
    boat = useRef<SVGGElement>(null);
  const id = useId().replaceAll(":", "");
  const points = useMemo(() => destinations(s, role), [s, role]);
  const river = s.phase === 3 && s.boarded.length === 2;
  const hollow = s.phase === 9;
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      x = net.local.x,
      z = net.local.z;
    const draw = () => {
      const now = performance.now(),
        alpha = 1 - Math.exp(-18 * Math.min(0.1, (now - last) / 1000));
      last = now;
      x += (net.local.x - x) * alpha;
      z += (net.local.z - z) * alpha;
      const p = net.local,
        peer = net.motion.sample(performance.now()) || net.poses[1 - role];
      player.current?.setAttribute(
        "transform",
        `translate(${x * 0.8} ${z * 0.8}) rotate(${(-input.yaw * 180) / Math.PI})`,
      );
      if (partner.current) {
        partner.current.style.opacity = peer && net.snapshot.peer ? "1" : "0";
        if (peer)
          partner.current.setAttribute(
            "transform",
            `translate(${peer.x * 0.8} ${peer.z * 0.8})`,
          );
      }
      if (boat.current)
        boat.current.setAttribute(
          "transform",
          `translate(${s.boat.x * 1.9} ${62 - (s.boat.progress / riverLength) * 124})`,
        );
      if (distance.current) {
        const d = points.length
          ? Math.min(...points.map((v) => Math.hypot(v.x - p.x, v.z - p.z)))
          : 0;
        distance.current.textContent = river
          ? `${Math.round((s.boat.progress / riverLength) * 100)}% downriver`
          : d > 4
            ? `${Math.round(d)} m`
            : "You’re here";
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [points, role, river, s.boat.progress, s.boat.x]);
  return (
    <div
      className="ll-map"
      aria-label={
        hollow ? "Hollow trail map" : river ? "River chart" : "Compass map"
      }
    >
      <svg
        viewBox="-94 -94 188 188"
        role="img"
        aria-label={
          river
            ? "Your position along the river"
            : "You, your partner, and nearby destinations"
        }
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <circle r="77" />
          </clipPath>
          <radialGradient id={`${id}-paper`}>
            <stop stopColor="#334b3d" />
            <stop offset="1" stopColor="#152f2b" />
          </radialGradient>
          <linearGradient id={`${id}-sight`} x1="0" y1="1" x2="0" y2="0">
            <stop stopColor={colors[role]} stopOpacity=".24" />
            <stop offset="1" stopColor={colors[role]} stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle r="91" fill="#142d2be8" stroke="#ebd7aa75" strokeWidth=".8" />
        <circle r="86.5" fill="none" stroke="#c1ad7866" strokeWidth=".5" />
        {Array.from({ length: 48 }, (_, i) => (
          <path
            key={i}
            d={`M0 -${i % 6 === 0 ? 80 : 83}V-86`}
            transform={`rotate(${i * 7.5})`}
            stroke="#d4c49e"
            strokeOpacity={i % 6 === 0 ? 0.8 : 0.4}
            strokeWidth={i % 6 === 0 ? 0.8 : 0.4}
          />
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          <circle r="77" fill={`url(#${id}-paper)`} />
          {river ? (
            <>
              <path
                d="M-7 90C-65 48 56 18 0 -16S-30 -58 0 -90"
                fill="none"
                stroke="#638f86"
                strokeWidth="30"
              />
              <path
                d="M-7 90C-65 48 56 18 0 -16S-30 -58 0 -90"
                fill="none"
                stroke="#c3d9bd"
                strokeOpacity=".35"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              {riverStops.map((v, i) => (
                <g
                  key={v}
                  transform={`translate(26 ${62 - (v / riverLength) * 124})`}
                >
                  <path d="M-8 0H8" stroke="#d3bb8a" strokeWidth="3" />
                  <circle
                    r="3"
                    fill={i < s.boat.stop ? "#8fbd9c" : "#efc774"}
                  />
                </g>
              ))}
              <g ref={boat}>
                <path
                  d="M0 -8L5 3Q0 9 -5 3Z"
                  fill="#f4dcac"
                  stroke="#18352e"
                  strokeWidth="1.2"
                />
              </g>
            </>
          ) : (
            <>
              {Array.from({ length: 56 }, (_, i) => {
                const a = i * 2.399,
                  r = 45 + rand(i + 40) * 31;
                return (
                  <path
                    key={i}
                    d="M0 -2L2 2H-2Z"
                    transform={`translate(${Math.cos(a) * r} ${Math.sin(a) * r})`}
                    fill={i % 3 ? "#6b7850" : "#b09455"}
                    opacity=".32"
                  />
                );
              })}
              {!hollow && (
                <path
                  d="M-90 -56Q-35 -48 0 -54T90 -52"
                  stroke="#71a59f"
                  strokeWidth="14"
                  fill="none"
                  opacity=".65"
                />
              )}
              {!hollow && (
                <path
                  d="M-90 -56Q-35 -48 0 -54T90 -52"
                  stroke="#cedac0"
                  strokeWidth=".8"
                  fill="none"
                  strokeDasharray="1 6"
                  opacity=".4"
                />
              )}
              <path
                d={
                  hollow
                    ? "M0 40V15M0 15L-27 12L-50 12L-50 -8L-34 -22M0 15L27 12L50 11L49 -10L30 -24M0 15L-11 2L-5 -13L5 -22L0 -34V-50"
                    : "M0 -47V42M-24 -8L0 19L25 -20"
                }
                fill="none"
                stroke="#d1bd8b"
                strokeOpacity=".45"
                strokeWidth="3"
              />
              <path
                d={
                  hollow
                    ? "M0 40V15M0 15L-27 12L-50 12L-50 -8L-34 -22M0 15L27 12L50 11L49 -10L30 -24M0 15L-11 2L-5 -13L5 -22L0 -34V-50"
                    : "M0 -47V42M-24 -8L0 19L25 -20"
                }
                fill="none"
                stroke="#e9d6ac"
                strokeOpacity=".45"
                strokeWidth=".6"
              />
              {!hollow &&
                obstacles.map((p, i) => (
                  <rect
                    key={i}
                    x={(p.x - p.w) * 0.8}
                    y={(p.z - p.d) * 0.8}
                    width={p.w * 1.6}
                    height={p.d * 1.6}
                    rx=".5"
                    fill="#b9a576"
                    stroke="#e7d9ad"
                    strokeWidth=".5"
                    opacity=".66"
                  />
                ))}
              {hollow && (
                <>
                  <rect
                    x="-9.6"
                    y="-50.4"
                    width="19.2"
                    height="20.8"
                    rx="2"
                    fill="#91b6ad33"
                    stroke="#b6d8ce88"
                    strokeWidth=".8"
                  />
                  {(["water", "light"] as const).map((route) => (
                    <g key={route}>
                      <circle
                        cx={expeditionControls[route].x * 0.8}
                        cy={12}
                        r={3}
                        fill={route === "water" ? "#8dbab7" : "#efce8a"}
                      />
                      {(route === "water"
                        ? waterReceivers
                        : lightReceivers
                      ).map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x * 0.8}
                          cy={p.z * 0.8}
                          r={2}
                          fill={
                            s.expedition[route].includes(i)
                              ? "#aed5a7"
                              : "#73877a"
                          }
                        />
                      ))}
                    </g>
                  ))}
                  {s.expedition.carry.holders.length > 0 &&
                    !s.expedition.carry.delivered && (
                      <circle
                        cx={s.expedition.carry.x * 0.8}
                        cy={s.expedition.carry.z * 0.8}
                        r={3.5}
                        fill="#d7f1df"
                      />
                    )}
                </>
              )}
              {!hollow && s.bridge >= 6 && (
                <path
                  d="M-2 -47V-61M2 -47V-61"
                  stroke="#e0bd7e"
                  strokeWidth="1.5"
                />
              )}
              {points.map((p, i) => (
                <g key={i} transform={`translate(${p.x * 0.8} ${p.z * 0.8})`}>
                  <circle r="3.1" fill="#e4c17d" opacity=".16" />
                  <path d="M0 -2.3L2.3 0L0 2.3L-2.3 0Z" fill="#f4d392" />
                </g>
              ))}
              <g ref={partner} style={{ opacity: 0 }}>
                <circle r="6" fill={colors[1 - role]} opacity=".14" />
                <circle
                  r="3.1"
                  fill={colors[1 - role]}
                  stroke="#f7ebcf"
                  strokeWidth=".8"
                />
              </g>
              <g ref={player}>
                <path
                  d="M0 0L-19 -31Q0 -41 19 -31Z"
                  fill={`url(#${id}-sight)`}
                />
                <path
                  d="M0 -6L4 5L0 3L-4 5Z"
                  fill={colors[role]}
                  stroke="#fff5d6"
                  strokeWidth="1"
                />
              </g>
            </>
          )}
        </g>
        <text
          y="-79.5"
          textAnchor="middle"
          fill="#f6e5b9"
          fontSize="7"
          fontFamily="Georgia,serif"
        >
          N
        </text>
        <path d="M0 -92L2 -89H-2Z" fill="#f2cf86" />
      </svg>
      <span className="ll-map-distance" ref={distance} />
    </div>
  );
}
