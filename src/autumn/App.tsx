import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Leaf,
  LoaderCircle,
  Maximize,
  Mic,
  MicOff,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { net } from "./network";
import { media } from "./media";
import { sound } from "./sound";
import { input, setupInput } from "./controls";
import {
  acts,
  colors,
  names,
  recipes,
  recipeNames,
  riverStops,
  riverLength,
  stations,
  towers,
  wishes,
  windAt,
} from "./content";
import type { Role } from "./content";
import { skillPhase } from "../../server/autumn/rules";
import type { State } from "../../server/autumn/rules";
import type { Target } from "./World";
import { MiniMap } from "./MiniMap";
import { Journal } from "./Journal";
import { finishDisplayCalibration } from "./displayCadence";
import "./autumn.css";
const World = lazy(() => import("./World"));
const LanternPreview = lazy(() => import("./LanternPreview"));
const palette = [
  "#ffbd68",
  "#9ce0cc",
  "#e9a7c8",
  "#a9b9ed",
  "#e6d58f",
  "#e89b78",
];
class Boundary extends Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="ll-recovery">
        <Moon size={32} />
        <h2>The world needs a moment.</h2>
        <p>Your saved evening is safe.</p>
        <button onClick={() => location.reload()}>Reopen the world</button>
        <a href="/">Back to the collection</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Meter({
  start,
  hold = false,
  label = "Release in the gold",
}: {
  start: number;
  hold?: boolean;
  label?: string;
}) {
  const marker = useRef<HTMLElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const position = skillPhase(
        start,
        hold ? performance.now() : Date.now() + net.clockOffset,
      );
      if (marker.current) marker.current.style.left = `${position * 100}%`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [start, hold]);
  return (
    <div className="ll-meter">
      <span>{label}</span>
      <div className="ll-meter-track">
        <i className="ll-meter-gold" />
        <b ref={marker} style={{ left: "0%" }} />
      </div>
    </div>
  );
}
// Animate the tiny HUD markers without reconciling the entire game world.
function ChargeBar({ start }: { start: number }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (bar.current)
        bar.current.style.transform = `scaleX(${Math.min(1, (performance.now() - start) / 1500)})`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [start]);
  return <i ref={bar} className="ll-charge-fill" />;
}
function KiteWindBand({ tower }: { tower: number }) {
  const band = useRef<HTMLElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (band.current)
        band.current.style.left = `${(Math.sin((Date.now() + net.clockOffset) / 3300 + tower) * 0.65 + 1) * 50}%`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [tower]);
  return <i ref={band} />;
}
function Preview({ large = false }: { large?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null),
    [, update] = useState(0);
  useEffect(() => {
    const f = () => update((n) => n + 1);
    media.addEventListener("change", f);
    return () => media.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = media.stream;
      void ref.current.play().catch(() => {});
    }
  }, [media.cameraOn]);
  return (
    <div className={`ll-self ${large ? "large" : ""}`}>
      {media.cameraOn ? (
        <video autoPlay playsInline muted ref={ref} />
      ) : (
        <div className="ll-self-placeholder">
          <CameraOff size={large ? 24 : 17} />
        </div>
      )}
      {!large && <span>You</span>}
    </div>
  );
}
function Progress({ s, role }: { s: State; role: Role }) {
  if (s.phase === 0) return <span>{s.ready.length}/2 lanterns lit</span>;
  if (s.phase === 1)
    return (
      <span>
        {["apple", "pumpkin", "mushroom"].map((k, i) => (
          <span key={k}>
            {i > 0 ? " · " : ""}
            {k[0].toUpperCase() + k.slice(1)} {Math.min(s.harvest[k], 10)}/10
          </span>
        ))}
      </span>
    );
  if (s.phase === 2)
    return (
      <span>
        {s.bridge}/6 sections · {s.timber}/3 timber ·{" "}
        {s.strokes[0] + s.strokes[1]}/6 strikes
      </span>
    );
  if (s.phase === 3)
    return (
      <span>
        {s.boarded.length < 2
          ? `${s.boarded.length}/2 aboard`
          : `${s.boat.stop}/3 landings · ${Math.round((s.boat.progress / riverLength) * 100)}% downriver`}
      </span>
    );
  if (s.phase === 4)
    return (
      <span>
        {s.order}/8 served · {recipeNames[s.order]}
      </span>
    );
  if (s.phase === 5)
    return (
      <span>
        Round {(s.fair?.round || 0) + 1}/4 · {s.fair?.throws[role] || 0}/5
        throws · Harsha {s.fair?.scores[0] || 0} — Mingy{" "}
        {s.fair?.scores[1] || 0}
      </span>
    );
  if (s.phase === 6) return <span>{s.towers.length}/6 towers awake</span>;
  if (s.phase === 7)
    return (
      <span>
        {Object.keys(s.lanterns).length}/12 lanterns ·{" "}
        {
          Object.keys(s.lanterns).filter(
            (k) => Number(k.split("-")[1]) % 2 === role,
          ).length
        }
        /6 yours
      </span>
    );
  return <span>Twelve wishes. One very good evening.</span>;
}
function Game() {
  const snapshot = useSyncExternalStore(net.subscribe, net.getSnapshot),
    s = snapshot.state,
    role = snapshot.role;
  const [chosen, setChosen] = useState<Role>(
      (Number(localStorage.getItem("autumn-role")) || 0) as Role,
    ),
    [entered, setEntered] = useState(false),
    [near, setNear] = useState<Target | null>(null),
    [modal, setModal] = useState<"help" | "settings" | "craft" | null>(null),
    [chapter, setChapter] = useState(-1),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [mediaVersion, updateMedia] = useState(0),
    [holding, setHolding] = useState(0),
    [quality, setQuality] = useState(
      localStorage.getItem("autumn-quality") || "high",
    ),
    [music, setMusic] = useState(true),
    [craft, setCraft] = useState({ color: 0, shape: 0, wish: 0 }),
    [copied, setCopied] = useState(false),
    [sail, setSail] = useState(0),
    [kite, setKite] = useState(0),
    [endHidden, setEndHidden] = useState(false);
  const sRef = useRef(s),
    nearRef = useRef(near),
    modalRef = useRef(modal),
    chapterRef = useRef(chapter),
    lastPhase = useRef(-1),
    toastTimer = useRef(0),
    holdTarget = useRef<Target | null>(null),
    sailRef = useRef(0),
    kiteRef = useRef(0);
  sRef.current = s;
  nearRef.current = near;
  modalRef.current = modal;
  chapterRef.current = chapter;
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4500);
  }, []);
  const river = s?.phase === 3 && s.boarded.length === 2;
  const paused =
    !!modal || chapter >= 0 || !entered || snapshot.status === "error";
  useEffect(() => {
    input.blocked = paused;
    input.keys.clear();
    input.holding = 0;
    setHolding(0);
    if (paused && document.pointerLockElement) document.exitPointerLock();
  }, [paused]);
  useEffect(() => {
    const onNotice = (e: any) => {
      notify(e.detail);
      if (
        /Perfect|section|Prepped|Ready|happy|untangled|Gathered|stacked/.test(
          e.detail,
        )
      )
        sound.chime();
    };
    const onMedia = () => updateMedia((v) => v + 1);
    const ping = () =>
      notify("Your Mingy is calling you over. Follow their marker on the map.");
    net.addEventListener("notice", onNotice);
    net.addEventListener("ping-mark", ping);
    media.addEventListener("change", onMedia);
    return () => {
      net.removeEventListener("notice", onNotice);
      net.removeEventListener("ping-mark", ping);
      media.removeEventListener("change", onMedia);
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    if (s && s.phase !== lastPhase.current) {
      const old = lastPhase.current;
      lastPhase.current = s.phase;
      sound.phase = s.phase;
      setModal(null);
      setNear(null);
      setHolding(0);
      if (s.phase !== 8) setChapter(s.phase);
      else if (old >= 0) {
        setEndHidden(false);
        sound.chime();
      }
      if (old >= 0) sound.chime();
    }
  }, [s?.phase]);
  useEffect(() => {
    if (snapshot.status === "connected" && snapshot.peer) void media.connect();
    else media.disconnect();
  }, [snapshot.status, snapshot.peer]);
  useEffect(
    () => () => {
      media.stop();
      sound.stop();
      net.leave();
    },
    [],
  );
  const action = useCallback(
    (down: boolean) => {
      const state = sRef.current,
        target = nearRef.current;
      if (!state || modalRef.current || chapterRef.current >= 0) return;
      const r = net.snapshot.role;
      if (down) {
        if (state.phase === 6 && state.kite?.role === r) {
          net.action({ kind: "kite-stop" });
          return;
        }
        if (state.phase === 3 && state.boarded.length === 2) {
          net.action({ kind: "parcel" });
          return;
        }
        if (state.challenge?.role === r) {
          net.action({ kind: "hit" });
          sound.tap();
          return;
        }
        if (!target) return;
        if (target.kind === "ground") {
          notify("Stay on this amber switch while your Mingy flies the kite.");
          return;
        }
        if (target.kind === "throw") {
          if (target.role !== r) {
            notify("Your throwing line is the other one.");
            return;
          }
          input.holding = performance.now();
          setHolding(input.holding);
          holdTarget.current = target;
          return;
        }
        if (target.kind === "collect") {
          if (state.phase === 2) {
            net.action({ kind: "collect", target: target.id });
            sound.tap();
          } else {
            input.holding = performance.now();
            setHolding(input.holding);
            holdTarget.current = target;
          }
          return;
        }
        if (target.kind === "moth") {
          net.action({ kind: "moth", target: target.id });
          sound.chime();
          return;
        }
        if (target.kind === "kite") {
          net.action({ kind: "kite-begin", target: target.id });
          return;
        }
        if (target.kind === "lantern") {
          net.action({ kind: "place", target: target.id });
          sound.chime();
          return;
        }
        if (target.kind === "table") {
          net.action({ kind: "serve", target: target.id });
          return;
        }
        if (target.id === "lanternTable") {
          setModal("craft");
          return;
        }
        if (target.id.startsWith("pantry")) {
          net.action({ kind: "ingredient", target: target.id });
          return;
        }
        if (target.id === "bench" && !state.bags[r]?.length) {
          net.action({ kind: "begin", target: target.id });
          return;
        }
        if (target.id === "prep" || target.id === "stove") {
          net.action({ kind: "begin", target: target.id });
          return;
        }
        net.action({ kind: "interact", target: target.id });
        sound.tap();
      } else if (input.holding) {
        const elapsed = performance.now() - input.holding;
        input.holding = 0;
        setHolding(0);
        if (holdTarget.current)
          net.action(
            holdTarget.current.kind === "throw"
              ? {
                  kind: "throw",
                  target: holdTarget.current.id,
                  held: elapsed,
                  value: input.yaw,
                  pitch: input.pitch,
                }
              : {
                  kind: "collect",
                  target: holdTarget.current.id,
                  held: elapsed,
                },
          );
        holdTarget.current = null;
      }
    },
    [notify],
  );
  useEffect(
    () =>
      setupInput(
        action,
        () => setModal((m) => (m === "help" ? null : "help")),
        () => {
          net.gesture = "wave";
          net.gestureAt = Date.now() + net.clockOffset;
          net.send({ type: "ping-mark" });
          notify("You called your Mingy over.");
          sound.chime();
        },
      ),
    [action, notify],
  );
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setModal((m) => (m ? null : "settings"));
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    if (!river && !s?.kite) return;
    let last = performance.now();
    const t = setInterval(() => {
      const state = sRef.current;
      if (!state || net.snapshot.status !== "connected") return;
      const time = performance.now(),
        dt = Math.min(0.35, (time - last) / 1000);
      last = time;
      const direction =
        (input.keys.has("KeyD") || input.keys.has("ArrowRight") ? 1 : 0) -
        (input.keys.has("KeyA") || input.keys.has("ArrowLeft") ? 1 : 0) +
        input.touch.x;
      if (state.phase === 3 && state.boarded.length === 2) {
        if (net.snapshot.role === 1) {
          sailRef.current = Math.max(
            -1,
            Math.min(1, sailRef.current + direction * dt * 0.85),
          );
          setSail(sailRef.current);
        }
        if (net.snapshot.role === 0)
          net.action({ kind: "sail", value: direction });
        else {
          net.control = sailRef.current;
          net.local.control = net.control;
          net.send({ type: "pose", pose: net.local });
        }
      }
      if (state.phase === 6 && state.kite?.role === net.snapshot.role) {
        kiteRef.current = Math.max(
          -1,
          Math.min(1, kiteRef.current + direction * dt * 0.8),
        );
        setKite(kiteRef.current);
        net.action({
          kind: "kite",
          target: `tower-${state.kite.tower}`,
          value: kiteRef.current,
        });
      }
    }, 350);
    return () => clearInterval(t);
  }, [river, s?.kite?.tower, s?.kite?.role]);
  const enable = async (kind: "camera" | "mic") => {
    setBusy(true);
    try {
      if (kind === "camera" ? media.cameraOn : media.micOn) media.disable(kind);
      else await media.enable(kind);
      localStorage.setItem(
        `autumn-${kind}`,
        String(kind === "camera" ? media.cameraOn : media.micOn),
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const join = () => {
    // Stop before scene parsing, shader compilation or uploads can affect it.
    finishDisplayCalibration();
    setEntered(true);
    void media.unlock();
    sound.start();
    for (const kind of ["camera", "mic"] as const)
      if (
        localStorage.getItem(`autumn-${kind}`) === "true" &&
        !(kind === "camera" ? media.cameraOn : media.micOn)
      )
        void media.enable(kind).catch((e) => notify(e.message));
    const room = new URLSearchParams(location.hash.slice(1)).get("room") || "";
    net.enter(chosen, /^[a-zA-Z0-9_-]{20,64}$/.test(room) ? room : "");
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/last-light${net.requestedRoom ? "#room=" + net.requestedRoom : ""}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Send your Mingy this page’s address.");
    }
  };
  const setGraphics = (value: string) => {
    setQuality(value);
    localStorage.setItem("autumn-quality", value);
  };
  const holdLabel =
    near?.kind === "collect" && s?.phase === 1
      ? "Hold E to harvest"
      : near?.id === "bench" && s?.bags[role]?.length
        ? "Unload timber"
        : near?.label;
  if (!entered)
    return (
      <main className="ll ll-lobby">
        <img
          className="ll-lobby-art"
          src="/posters/last-light.webp"
          alt="An autumn valley at twilight"
        />
        <div className="ll-lobby-shade" />
        <a className="ll-back" href="/">
          <ArrowLeft size={16} /> Collection
        </a>
        <section className="ll-lobby-content">
          <span className="ll-eyebrow">A MINGY ORIGINAL · 02</span>
          <h1>
            The
            <br />
            Last Light
          </h1>
          <p className="ll-lobby-description">
            An autumn adventure. Just the two of you.
          </p>
          <div className="ll-choose" aria-label="Choose your character">
            {([0, 1] as Role[]).map((r) => (
              <button
                key={r}
                aria-pressed={chosen === r}
                className={chosen === r ? "selected" : ""}
                onClick={() => setChosen(r)}
              >
                <i style={{ background: colors[r] }} />
                {names[r]}
                {chosen === r && <Check size={15} />}
              </button>
            ))}
          </div>
          <button className="ll-primary ll-start" onClick={join}>
            Step into the evening <ArrowRight size={18} />
          </button>
          <div className="ll-lobby-media">
            <button disabled={busy} onClick={() => enable("camera")}>
              {media.cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}{" "}
              Camera {media.cameraOn ? "on" : "off"}
            </button>
            <button disabled={busy} onClick={() => enable("mic")}>
              {media.micOn ? <Mic size={17} /> : <MicOff size={17} />} Mic{" "}
              {media.micOn ? "on" : "off"}
            </button>
          </div>
          {media.cameraOn && <Preview large />}
          <span className="ll-duration">
            2 players <i /> About an hour <i /> Progress saved
          </span>
        </section>
        {toast && (
          <div className="ll-toast" role="status">
            {toast}
          </div>
        )}
      </main>
    );
  return (
    <main className="ll ll-game">
      {s ? (
        <div className="ll-world">
          <Boundary>
            <Suspense
              fallback={
                <div className="ll-loading">
                  <Leaf />
                  <span>Waking the valley…</span>
                </div>
              }
            >
              <World
                s={s}
                role={role}
                onNear={setNear}
                paused={paused}
                quality={quality}
                focus={
                  modal === "help"
                    ? "journal"
                    : modal === "craft"
                      ? "craft"
                      : chapter >= 0
                        ? "chapter"
                        : null
                }
              />
            </Suspense>
          </Boundary>
        </div>
      ) : (
        <div className="ll-loading">
          <LoaderCircle className="ll-spin" />
          <span>
            {snapshot.status === "error"
              ? "The evening is waiting."
              : "Finding your way to Bramblewick…"}
          </span>
        </div>
      )}
      {s && (
        <>
          <header className="ll-hud">
            <div className="ll-objective">
              <span className="ll-eyebrow">
                {String(s.phase + 1).padStart(2, "0")} / {acts[s.phase].place}
              </span>
              <h1>{acts[s.phase].name}</h1>
              <p>{acts[s.phase].goal}</p>
              <div className="ll-progress">
                <Progress s={s} role={role} />
              </div>
            </div>
            {snapshot.status !== "connected" && (
              <div className="ll-status" role="status">
                <i />
                <span>Reconnecting…</span>
              </div>
            )}
          </header>
          <div className="ll-call">
            <Preview />
            <div className="ll-peer-status">
              <i className={snapshot.peer ? "online" : ""} />
              {snapshot.peer
                ? `${names[1 - role]} is here`
                : "Waiting for your Mingy"}
              <button aria-label="Copy invitation" onClick={share}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            {snapshot.peer && (media.cameraOn || media.micOn) && (
              <span className="ll-call-mode">
                {media.mode === "direct" ? "Live call" : "Relay call"}
                {media.remoteMic ? " · mic on" : ""}
              </span>
            )}
          </div>
          <MiniMap s={s} role={role} />
          <div className="ll-inventory">
            {s.bags[role]?.length > 0 && (
              <>
                <span>{s.bags[role].length}/3 in your arms</span>
                <b>{s.bags[role].join(" · ")}</b>
              </>
            )}
            {s.hands[role] && (
              <>
                <span>A wish in your hands</span>
                <b>{wishes[s.hands[role]!.wish]}</b>
              </>
            )}
          </div>
          {!paused && (
            <>
              <div className="ll-crosshair" />
              {holding ? (
                <div className="ll-interaction">
                  {near?.kind === "throw" ? (
                    <div className="ll-meter">
                      <span>Follow the arc. Release E to throw.</span>
                      <div className="ll-meter-track">
                        <ChargeBar start={holding} />
                      </div>
                    </div>
                  ) : (
                    <Meter start={holding} hold />
                  )}
                </div>
              ) : s.challenge?.role === role ? (
                <div className="ll-interaction">
                  <Meter
                    start={s.challenge.start}
                    label="Press E when the marker crosses gold"
                  />
                </div>
              ) : near && !river ? (
                <button
                  className="ll-interaction ll-prompt"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    action(true);
                  }}
                  onPointerUp={() => action(false)}
                  onPointerCancel={() => action(false)}
                >
                  <kbd>E</kbd>
                  <span>{holdLabel}</span>
                  {near.role !== undefined && near.role !== role && (
                    <small>For {names[near.role]}</small>
                  )}
                </button>
              ) : null}
            </>
          )}
          {river && !paused && (
            <div className="ll-river-hud">
              <span className="ll-eyebrow">
                {s.boat.stop < 3 && s.boat.progress >= riverStops[s.boat.stop]
                  ? "AT THE LANDING"
                  : role === 0
                    ? "AT THE RUDDER"
                    : "CATCH THE WIND"}
              </span>
              {s.boat.stop < 3 && s.boat.progress >= riverStops[s.boat.stop] ? (
                <button
                  onClick={() => net.action({ kind: "parcel" })}
                  className="ll-primary"
                >
                  {s.boat.parcels.includes(role)
                    ? "Waiting for your Mingy…"
                    : "Collect your parcel · E"}
                </button>
              ) : (
                <>
                  {role === 1 ? (
                    <>
                      <p>Match your sail to the gold wind marker.</p>
                      <div className="ll-wind-track">
                        <i
                          style={{
                            left: `${(windAt(s.boat.progress) + 1) * 50}%`,
                          }}
                        />
                        <b style={{ left: `${(sail + 1) * 50}%` }} />
                      </div>
                    </>
                  ) : (
                    <p>
                      Steer through the little lights. Your Mingy catches the
                      wind.
                    </p>
                  )}
                  <div className="ll-steer">
                    <button
                      aria-label="Steer left"
                      onPointerDown={() => (input.touch.x = -1)}
                      onPointerUp={() => (input.touch.x = 0)}
                      onPointerLeave={() => (input.touch.x = 0)}
                    >
                      <ArrowLeft size={17} />
                    </button>
                    <span>A / D</span>
                    <button
                      aria-label="Steer right"
                      onPointerDown={() => (input.touch.x = 1)}
                      onPointerUp={() => (input.touch.x = 0)}
                      onPointerLeave={() => (input.touch.x = 0)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {s.kite?.role === role && !paused && (
            <div className="ll-kite-hud">
              <span className="ll-eyebrow">
                HOLD THE WIND · A / D · E TO PUT DOWN
              </span>
              <div className="ll-wind-track">
                <KiteWindBand tower={s.kite.tower} />
                <b style={{ left: `${(kite + 1) * 50}%` }} />
              </div>
              <p>
                {Math.round((s.towerProgress[s.kite.tower] || 0) * 100)}%
                untangled · your Mingy holds the switch
              </p>
              <div className="ll-steer">
                <button
                  aria-label="Kite left"
                  onPointerDown={() => (input.touch.x = -1)}
                  onPointerUp={() => (input.touch.x = 0)}
                  onPointerLeave={() => (input.touch.x = 0)}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  aria-label="Kite right"
                  onPointerDown={() => (input.touch.x = 1)}
                  onPointerUp={() => (input.touch.x = 0)}
                  onPointerLeave={() => (input.touch.x = 0)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
          {!paused && !river && <TouchControls action={action} />}
          <nav className="ll-tools" aria-label="Game controls">
            <button
              title={media.micOn ? "Mute microphone" : "Enable microphone"}
              aria-label={media.micOn ? "Mute microphone" : "Enable microphone"}
              className={media.micOn ? "active" : ""}
              disabled={busy}
              onClick={() => enable("mic")}
            >
              {media.micOn ? <Mic /> : <MicOff />}
            </button>
            <button
              title={media.cameraOn ? "Turn camera off" : "Enable camera"}
              aria-label={media.cameraOn ? "Turn camera off" : "Enable camera"}
              className={media.cameraOn ? "active" : ""}
              disabled={busy}
              onClick={() => enable("camera")}
            >
              {media.cameraOn ? <Camera /> : <CameraOff />}
            </button>
            <button
              title="Music"
              aria-label="Toggle music"
              onClick={() => setMusic(sound.toggle())}
            >
              {music ? <Volume2 /> : <VolumeX />}
            </button>
            <span />
            <button
              title="Field guide · H"
              aria-label="Open field guide"
              onClick={() => setModal("help")}
            >
              <CircleHelp />
            </button>
            <button
              title="Settings"
              aria-label="Open settings"
              onClick={() => setModal("settings")}
            >
              <Settings2 />
            </button>
          </nav>
          <div className="ll-controls-hint">
            WASD move <i /> Mouse / two-finger look <i /> E interact <i /> H
            help
          </div>
        </>
      )}
      {snapshot.status === "reconnecting" && (
        <div className="ll-connection-banner" role="status">
          <LoaderCircle className="ll-spin" size={15} /> Reconnecting. Your
          evening is saved.
        </div>
      )}
      {snapshot.status === "error" && (
        <div className="ll-overlay">
          <section className="ll-modal">
            <Radio />
            <h2>Let’s reconnect.</h2>
            <p>{snapshot.error}</p>
            <button
              className="ll-primary"
              onClick={() => {
                net.enter(role, net.requestedRoom);
              }}
            >
              Rejoin the evening
            </button>
            <a href="/">Back to collection</a>
          </section>
        </div>
      )}
      {chapter >= 0 && s && (
        <div className="ll-overlay ll-story-overlay" key={chapter}>
          <div className="ll-chapter-grain" aria-hidden="true" />
          <section
            className="ll-story"
            role="dialog"
            aria-modal="true"
            aria-label={acts[chapter].name}
          >
            <span className="ll-chapter-location">{acts[chapter].place}</span>
            <span className="ll-eyebrow">
              CHAPTER {String(chapter + 1).padStart(2, "0")}
            </span>
            <h2>{acts[chapter].name}</h2>
            <p>{acts[chapter].line}</p>
            <div className="ll-story-rule" />
            <p className="ll-story-tip">{acts[chapter].tip}</p>
            <button
              className="ll-primary"
              onClick={() => {
                setChapter(-1);
                void media.unlock();
              }}
            >
              Let’s go <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
      {s && (
        <Journal open={modal === "help"} s={s} onClose={() => setModal(null)} />
      )}
      {modal === "settings" && (
        <div className="ll-overlay">
          <section className="ll-modal">
            <button
              className="ll-close"
              aria-label="Close settings"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            <span className="ll-eyebrow">TAKE A BREATH</span>
            <h2>Your evening.</h2>
            <label className="ll-setting">
              Graphics
              <select
                value={quality}
                onChange={(e) => setGraphics(e.target.value)}
              >
                <option value="high">Beautiful</option>
                <option value="balanced">Balanced</option>
                <option value="low">Lighter on the laptop</option>
              </select>
            </label>
            <label className="ll-setting">
              Look sensitivity
              <input
                type="range"
                min=".4"
                max="1.8"
                step=".1"
                defaultValue={input.sensitivity}
                onChange={(e) => (input.sensitivity = Number(e.target.value))}
              />
            </label>
            <button
              className="ll-setting"
              onClick={() => {
                input.third = !input.third;
                setModal(null);
              }}
            >
              Change camera view <Compass size={17} />
            </button>
            <button
              className="ll-setting"
              onClick={() => {
                void media.unlock();
                void media.connect();
                notify("Refreshing the call connection.");
              }}
            >
              Repair voice & video <RotateCcw size={17} />
            </button>
            <button className="ll-setting" onClick={share}>
              Invite your Mingy{" "}
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
            <button
              className="ll-setting"
              onClick={() => {
                if (!document.fullscreenElement)
                  void document.documentElement
                    .requestFullscreen?.()
                    .catch(() => {});
                else void document.exitFullscreen();
              }}
            >
              Full screen <Maximize size={17} />
            </button>
            <p className="ll-small">
              Camera and microphone stay on until you turn them off or leave.
              Voice falls back to the game connection if a direct call cannot
              connect.
            </p>
            <button className="ll-primary" onClick={() => setModal(null)}>
              Back to the evening
            </button>
            <a className="ll-return" href="/">
              Save & return to collection
            </a>
          </section>
        </div>
      )}
      {modal === "craft" && s && (
        <div className="ll-overlay ll-craft-overlay">
          <section
            className="ll-modal ll-craft"
            role="dialog"
            aria-modal="true"
            aria-label="Make a lantern"
          >
            <button
              className="ll-close"
              aria-label="Close lantern maker"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            <span className="ll-eyebrow">
              MADE BY {names[role].toUpperCase()}
            </span>
            <h2>A little light.</h2>
            <Suspense fallback={<div className="ll-lantern-preview" />}>
              <LanternPreview
                color={palette[craft.color]}
                shape={craft.shape}
              />
            </Suspense>
            <div className="ll-swatches">
              {palette.map((c, i) => (
                <button
                  key={c}
                  aria-label={`Lantern color ${i + 1}`}
                  aria-pressed={craft.color === i}
                  style={{ background: c }}
                  onClick={() => setCraft({ ...craft, color: i })}
                >
                  {craft.color === i && <Check size={18} />}
                </button>
              ))}
            </div>
            <div className="ll-shapes">
              {["Classic", "Round", "Star"].map((name, i) => (
                <button
                  key={name}
                  aria-pressed={craft.shape === i}
                  onClick={() => setCraft({ ...craft, shape: i })}
                >
                  {name}
                </button>
              ))}
            </div>
            <label className="ll-wish">
              A wish to carry
              <select
                value={craft.wish}
                onChange={(e) =>
                  setCraft({ ...craft, wish: Number(e.target.value) })
                }
              >
                {wishes.map((w, i) => (
                  <option key={w} value={i}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ll-primary"
              onClick={() => {
                net.action({ kind: "craft", ...craft });
                setModal(null);
                sound.chime();
              }}
            >
              Make this lantern <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
      {s?.phase === 8 && !endHidden && chapter < 0 && (
        <div className="ll-ending">
          <span className="ll-eyebrow">AN EVENING BY HARSHA & MINGY</span>
          <h2>The light stays.</h2>
          <p>{acts[8].line}</p>
          <div className="ll-ending-stats">
            <span>12 wishes made</span>
            <span>{s.moths.length} little lights found</span>
          </div>
          <button onClick={() => setEndHidden(true)}>
            Stay a little <ArrowRight size={16} />
          </button>
        </div>
      )}
      {toast && (
        <div className="ll-toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
function TouchControls({ action }: { action: (down: boolean) => void }) {
  const moveOrigin = useRef({ x: 0, y: 0 });
  const lookLast = useRef({ x: 0, y: 0 });
  return (
    <div className="ll-touch">
      <div
        className="ll-touch-pad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveOrigin.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          input.touch.x = Math.max(
            -1,
            Math.min(1, (e.clientX - moveOrigin.current.x) / 35),
          );
          input.touch.z = Math.max(
            -1,
            Math.min(1, (e.clientY - moveOrigin.current.y) / 35),
          );
        }}
        onPointerUp={() => (input.touch = { x: 0, z: 0 })}
        onPointerCancel={() => (input.touch = { x: 0, z: 0 })}
      >
        <Compass />
      </div>
      <div
        className="ll-touch-look"
        aria-label="Drag to look"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          lookLast.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          input.yaw -= (e.clientX - lookLast.current.x) * 0.006;
          input.pitch = Math.max(
            -1.15,
            Math.min(
              1.15,
              input.pitch - (e.clientY - lookLast.current.y) * 0.005,
            ),
          );
          lookLast.current = { x: e.clientX, y: e.clientY };
        }}
      />
      <button
        className="ll-touch-use"
        onPointerDown={() => action(true)}
        onPointerUp={() => action(false)}
        onPointerCancel={() => action(false)}
      >
        E
      </button>
    </div>
  );
}
if (import.meta.env.DEV)
  Object.assign(window, { __autumn: { net, media, input, sound } });
export default function Autumn() {
  return (
    <Boundary>
      <Game />
    </Boundary>
  );
}
