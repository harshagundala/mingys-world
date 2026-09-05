import { Reset } from "./components/Reset";
import { advancedObjective, advancedHints } from "./game/adventure";
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
  BookOpen,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  HelpCircle,
  House,
  Leaf,
  LoaderCircle,
  MapPin,
  Maximize,
  Minimize,
  MoveUpRight,
  PawPrint,
  Settings2,
  Share2,
  Volume2,
  VolumeX,
  X,
  Heart,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Radio,
  RotateCcw,
} from "lucide-react";
import { Lobby } from "./components/Lobby";
import { Puzzle } from "./components/Puzzle";
import { Gallery } from "./components/Gallery";
import { CameraTile } from "./components/CameraTile";
import { session } from "./network/session";
import { camera } from "./network/camera";
import {
  chapters,
  clues,
  places,
  required,
  hints,
  fuses,
} from "./game/content";
import type { Role, Place } from "./game/content";
import { controls, setupControls } from "./game/controls";
import { sound, toggleAudio, setMusicScene, audioStatus } from "./game/audio";
if (import.meta.env.DEV)
  Object.assign(window, {
    __mingy: { session, camera, controls, audioStatus },
  });
const World = lazy(() => import("./game/World"));
const parsed = new URLSearchParams(location.hash.slice(1));
const linkedRoom = parsed.get("room") || "";
const invitedRoom = /^[a-zA-Z0-9_-]{20,64}$/.test(linkedRoom) ? linkedRoom : "";
const shareUrl = `${location.origin}/${invitedRoom ? `#${new URLSearchParams({ room: invitedRoom })}` : ""}`;
class Boundary extends Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(e: any) {
    console.error("World rendering error", e);
  }
  render() {
    return this.state.error ? (
      <div className="render-error">
        <PawPrint />
        <h2>The house needs a moment.</h2>
        <p>Your progress is saved. Reload to wake it up.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload the house
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [auth, setAuth] = useState(false),
    [authError, setAuthError] = useState(""),
    [playing, setPlaying] = useState(false);
  const role = s.role;
  const room = s.room || invitedRoom;
  const [near, setNear] = useState<string | null>(null),
    [panel, setPanel] = useState<string | null>(null),
    [tutorial, setTutorial] = useState(false),
    [toast, setToast] = useState(""),
    [hintLevel, setHintLevel] = useState(0),
    [chapterCard, setChapterCard] = useState(-1),
    [audioOn, setAudioOn] = useState(false),
    [cameraOn, setCameraOn] = useState(false),
    [cameraBusy, setCameraBusy] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [endHidden, setEndHidden] = useState(false),
    [now, setNow] = useState(Date.now()),
    [copied, setCopied] = useState(false);
  const toastTimer = useRef(0),
    cardTimer = useRef(0),
    lastChapter = useRef(-1),
    nearRef = useRef(near);
  nearRef.current = near;
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 6500);
  }, []);
  useEffect(() => {
    async function authenticate() {
      try {
        const result = await fetch("/api/session");
        const data = await result.json();
        if (result.ok && data.authorized) {
          setAuth(true);
          setAuthError("");
        } else
          setAuthError(
            data.error ||
              "The house is reconnecting. Please refresh in a moment.",
          );
      } catch {
        setAuthError(
          "The house couldn’t connect. Check your connection and refresh.",
        );
      }
    }
    void authenticate();
  }, []);
  useEffect(() => {
    const off = setupControls();
    const notice = (e: any) => notify(e.detail);
    const bark = () => {
      sound("bark");
      notify("Your Mingy says: woof.");
    };
    session.addEventListener("notice", notice);
    session.addEventListener("bark", bark);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      off();
      clearInterval(tick);
      session.removeEventListener("notice", notice);
      session.removeEventListener("bark", bark);
    };
  }, [notify]);
  useEffect(() => {
    controls.blocked =
      !!panel ||
      tutorial ||
      chapterCard >= 0 ||
      !playing ||
      (s.state?.chapter === 8 && !endHidden);
    controls.keys.clear();
  }, [panel, tutorial, chapterCard, playing, s.state?.chapter, endHidden]);
  useEffect(() => {
    if (s.state && s.state.chapter !== lastChapter.current) {
      const previous = lastChapter.current;
      lastChapter.current = s.state.chapter;
      setHintLevel(0);
      if (previous >= 0 && s.state.chapter > previous) {
        setPanel(null);
        sound("success");
        if (s.state.chapter < 8) {
          setChapterCard(s.state.chapter);
          clearTimeout(cardTimer.current);
          cardTimer.current = window.setTimeout(() => setChapterCard(-1), 6500);
        } else setEndHidden(false);
      }
    }
  }, [s.state]);
  useEffect(() => {
    if (s.status === "connected") {
      localStorage.setItem(`mingy-room-role-${s.room}`, String(s.role));
      localStorage.setItem("mingy-last-role", String(s.role));
    }
  }, [s.status, s.room, s.role]);
  useEffect(() => {
    if (s.status === "connected" && s.otherOnline) void camera.connect();
    else camera.disconnect();
    return () => camera.disconnect();
  }, [s.status, s.otherOnline]);
  const inspect = useCallback(
    (id: string) => {
      if (id.startsWith("dream-tile-")) {
        session.action({ kind: "dream-step", tile: Number(id.slice(11)) });
        return;
      }
      if (id.startsWith("f") && fuses.some((f) => f.id === id)) {
        session.action({ kind: "fuse", id });
        sound("clue");
        return;
      }
      const c = clues.find((c) => c.id === id);
      if (!c) return;
      if (c.kind === "portal") {
        if (
          (c.gate === "archive" && !session.snapshot.state?.archiveOpen) ||
          c.chapter > (session.snapshot.state?.chapter || 0)
        ) {
          notify(
            "The house will open this passage when the investigation leads here.",
          );
          return;
        }
        setPanel(null);
        setNear(null);
        session.action({ kind: "travel", id });
        return;
      }
      if (c.kind === "ball") {
        session.action({ kind: "ball", id });
        sound("clue");
        return;
      }
      setPanel(id);
      sound("clue");
      if (!c.kind || c.kind === "photo") session.action({ kind: "read", id });
    },
    [notify],
  );
  useEffect(() => {
    controls.interact = () => {
      if (nearRef.current) inspect(nearRef.current);
    };
    controls.bark = () => {
      sound("bark");
      session.send({ type: "bark" });
      notify("Woof. A compelling contribution to the investigation.");
    };
  }, [inspect, notify]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        setPanel(null);
        setTutorial(false);
        setChapterCard(-1);
      }
      if (e.code === "KeyJ" && playing) {
        setPanel((p) => (p === "notebook" ? null : "notebook"));
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [playing]);
  useEffect(() => {
    if (!panel && !tutorial) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      (document.querySelector(".modal button") as HTMLElement)?.focus();
    }, 0);
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".modal button:not([disabled]),.modal input,.modal select,.modal textarea,.modal summary",
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", trap);
      previous?.focus?.();
    };
  }, [panel, tutorial]);
  useEffect(() => {
    setMusicScene(s.place, s.state?.chapter || 0);
  }, [s.place, s.state?.chapter]);
  const enter = (chosen: Role, fresh: boolean) => {
    if (fresh) {
      location.assign("/reset");
      return;
    }
    if (!audioOn)
      void toggleAudio()
        .then(setAudioOn)
        .catch(() => {});
    setPlaying(true);
    setTutorial(true);
    setEndHidden(false);
    lastChapter.current = -1;
    history.replaceState(
      null,
      "",
      invitedRoom ? `/#${new URLSearchParams({ room: invitedRoom })}` : "/",
    );
    session.enter(invitedRoom, chosen);
  };
  const share = async () => {
    const url = shareUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch {
      setPanel("share");
    }
  };
  useEffect(() => {
    const refresh = () => setCameraOn(camera.active);
    camera.addEventListener("change", refresh);
    return () => camera.removeEventListener("change", refresh);
  }, []);
  const toggleCamera = async () => {
    setCameraBusy(true);
    setCameraError("");
    try {
      if (camera.active) {
        camera.disable();
        setCameraOn(false);
      } else {
        await camera.enable();
        setCameraOn(true);
        setToast("");
      }
    } catch (e: any) {
      const message =
        e.name === "CameraUnavailableError"
          ? e.message
          : e.name === "NotAllowedError" || e.name === "SecurityError"
            ? "Camera access is blocked. Allow Camera in your browser’s site permissions, then try again. If you are in an embedded preview, open the game directly in Chrome."
            : e.name === "NotFoundError"
              ? "This browser cannot find a camera. Connect one and try again."
              : "The camera is busy or unavailable. Turn off video in your other call or app, then try again. Keep that call open for audio.";
      setCameraError(message);
      notify(message);
    } finally {
      setCameraBusy(false);
    }
  };
  if (location.pathname === "/reset")
    return <Reset authorized={auth} error={authError} />;
  if (!playing)
    return (
      <Lobby
        authorized={auth}
        authError={authError}
        onEnter={enter}
        initialRole={
          Number(
            localStorage.getItem(`mingy-room-role-${room}`) ??
              localStorage.getItem("mingy-last-role") ??
              "0",
          ) as Role
        }
      />
    );
  const state = s.state,
    chapter = state?.chapter || 0,
    current = { ...chapters[chapter], ...advancedObjective(state || {}) },
    currentHints = advancedHints(state || {}) || hints[chapter] || [],
    activeClue = clues.find((c) => c.id === panel),
    nearClue = clues.find((c) => c.id === near),
    remaining = state?.powerUntil
      ? Math.max(0, Math.ceil((state.powerUntil - now) / 1000))
      : 0;
  if (chapter === 8 && !endHidden)
    return (
      <Gallery
        onReturn={() => setEndHidden(true)}
        index={state?.galleryIndex || 0}
        role={s.role}
        cameraOn={cameraOn}
        cameraBusy={cameraBusy}
        onCamera={toggleCamera}
      />
    );
  return (
    <main className="game">
      <Boundary>
        <Suspense
          fallback={<div className="world-start">Opening the front door…</div>}
        >
          {state && <World onNear={setNear} onInspect={inspect} />}
        </Suspense>
      </Boundary>
      <header className="game-header">
        <div className="game-brand">
          <PawPrint size={25} />
          <div>
            <strong>mingy’s world</strong>
            <span>
              <MapPin size={10} />
              {places[s.place as Place]?.name || "The house"}
            </span>
          </div>
        </div>
        <div className="connection-pill">
          <i className={s.status === "connected" ? "online" : ""} />
          <span>
            {s.status === "connected"
              ? s.otherOnline
                ? "Together in the house"
                : "Waiting for your Mingy"
              : s.status === "reconnecting"
                ? "Reconnecting · progress saved"
                : "Connecting to the house"}
          </span>
        </div>
        <div className="toolbar">
          <button
            aria-label={
              audioOn ? "Mute soundtrack" : "Play original soundtrack"
            }
            title="Gentle ambience"
            onClick={async () => setAudioOn(await toggleAudio())}
          >
            {audioOn ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            title="Video only · no microphone"
            disabled={cameraBusy}
            onClick={toggleCamera}
          >
            {cameraBusy ? (
              <LoaderCircle className="spin" />
            ) : cameraOn ? (
              <Camera />
            ) : (
              <CameraOff />
            )}
          </button>
          <button
            aria-label="How to play"
            title="How to play"
            onClick={() => setTutorial(true)}
          >
            <HelpCircle />
          </button>
          <button
            aria-label="Share game link"
            title="Copy game link"
            onClick={share}
          >
            {copied ? <Check /> : <Share2 />}
          </button>
          <button
            aria-label="Full screen"
            title="Full screen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void document.documentElement
                  .requestFullscreen?.()
                  .catch(() => {});
            }}
          >
            <Maximize />
          </button>
        </div>
      </header>
      <section className="objective-card">
        <div className="chapter-eyebrow">
          <span>
            {chapter === 0
              ? "PROLOGUE"
              : chapter === 8
                ? "EPILOGUE"
                : `CHAPTER ${String(chapter).padStart(2, "0")}`}
          </span>
          <div className="chapter-dots">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={i + 1 <= chapter ? "lit" : ""} />
            ))}
          </div>
        </div>
        <h2>{current.title}</h2>
        <p>{current.objective}</p>
        <div className="objective-bottom">
          <button onClick={() => setPanel("notebook")}>
            <BookOpen size={15} /> Notebook <kbd>J</kbd>
          </button>
          <button onClick={() => setPanel("hints")}>
            A little nudge <ChevronRight size={13} />
          </button>
        </div>
      </section>
      {!s.otherOnline && s.status === "connected" && (
        <div className="invite-card">
          <span>
            Your Mingy can open this same address. You’ll connect automatically.
          </span>
          <button onClick={share}>
            {copied ? (
              <>
                <Check size={14} /> Link copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy game link
              </>
            )}
          </button>
        </div>
      )}
      {s.otherOnline && session.poses[1 - role]?.place !== s.place && (
        <aside className="away-partner">
          <CameraTile role={1 - role} />
          <span>
            Your Mingy is in
            <br />
            <strong>
              {places[session.poses[1 - role]?.place as Place]?.name ||
                "the house"}
            </strong>
          </span>
        </aside>
      )}
      {chapter === 5 && state?.powerUntil && (
        <div className={`timer-card ${remaining < 25 ? "urgent" : ""}`}>
          <Radio size={20} />
          <div>
            <strong>
              {remaining
                ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                : "Try again"}
            </strong>
            <span>
              {remaining
                ? `${state.fuses.length} of 6 fuses · find your ${role === 0 ? "mint" : "rose"} ones`
                : "Restart at the backup console. Your clues are safe."}
            </span>
          </div>
        </div>
      )}
      {state?.chapter === 3 && state.water && s.place === "garden" && (
        <div className="plate-status">
          <PawPrint size={17} />
          {state.plateSince
            ? "Stay on the seals…"
            : "One puppy on each glowing seal"}
        </div>
      )}
      <footer className="game-footer">
        <div className="controls-strip">
          <span>
            <kbd>↑</kbd>
            <kbd>←</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> move
          </span>
          <span>
            <kbd>Space</kbd> jump
          </span>
          <span>
            <kbd>Shift</kbd> sprint
          </span>
          <span>
            <kbd>Q</kbd> sniff
          </span>
          <span>
            <kbd>B</kbd> bark
          </span>
          <span>scroll to zoom</span>
        </div>
        <span className={`collar-indicator role-${role}`}>
          <i />
          {role === 0 ? "Mint" : "Rose"} collar
        </span>
      </footer>
      {near && !panel && !tutorial && chapterCard < 0 && (
        <button className="interaction-prompt" onClick={() => inspect(near)}>
          <kbd>E</kbd>
          <span>
            {fuses.some((f) => f.id === near)
              ? "Restore your fuse"
              : nearClue?.kind === "portal"
                ? "Take the passage"
                : nearClue?.kind === "ball"
                  ? "An excellent tennis ball"
                  : nearClue?.kind === "photo"
                    ? "Look a little closer"
                    : nearClue?.title}
          </span>
          <ChevronRight size={17} />
        </button>
      )}
      <div className="touch-controls">
        <div className="direction-pad">
          {[
            { label: "Up", x: 0, z: -1, icon: ArrowUp },
            { label: "Left", x: -1, z: 0, icon: ArrowLeft },
            { label: "Down", x: 0, z: 1, icon: ArrowDown },
            { label: "Right", x: 1, z: 0, icon: ArrowRight },
          ].map(({ label, x, z, icon: Icon }) => (
            <button
              key={label}
              aria-label={`Move ${label}`}
              className={label.toLowerCase()}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                controls.touch = { x, z };
              }}
              onPointerUp={() => (controls.touch = { x: 0, z: 0 })}
              onPointerCancel={() => (controls.touch = { x: 0, z: 0 })}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
        <button
          className="touch-jump"
          onPointerDown={() => (controls.jumpQueued = true)}
        >
          Jump
        </button>
        <button
          className="touch-sniff"
          onPointerDown={() => (controls.sniffUntil = performance.now() + 5000)}
        >
          Sniff
        </button>
      </div>
      {chapter === 8 && (
        <button
          className="reopen-gallery button primary"
          onClick={() => setEndHidden(false)}
        >
          Our memories <Heart size={16} />
        </button>
      )}
      {toast && (
        <div className="toast" role="status">
          <PawPrint size={16} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {s.status === "error" && (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>A small detour</h2>
            <p>{s.error}</p>
            <button
              className="button primary"
              onClick={() => {
                camera.disable();
                setCameraOn(false);
                session.leave();
                setPlaying(false);
                setTutorial(false);
              }}
            >
              Back to the welcome screen
            </button>
          </section>
        </div>
      )}
      {tutorial && s.status !== "error" && (
        <div className="modal-backdrop">
          <section className="modal tutorial">
            <button
              className="modal-close"
              aria-label="Close tutorial"
              onClick={() => setTutorial(false)}
            >
              <X />
            </button>
            <span className="edition">A QUICK PAW-ORIENTATION</span>
            <h2>
              Welcome home,
              <br />
              <em>little detectives.</em>
            </h2>
            <p className="modal-intro">
              Keep your call open. The house has a story to tell, and you’ll
              each hear a different part.
            </p>
            <div className="tutorial-grid">
              <div>
                <span className="tutorial-number">01</span>
                <h3>Find your paws</h3>
                <p>
                  <kbd>Arrows</kbd> or <kbd>WASD</kbd> to move. <kbd>Space</kbd>{" "}
                  to jump. Hold <kbd>Shift</kbd> to sprint. Scroll to zoom.
                  Right-drag to look around.
                </p>
              </div>
              <div>
                <span className="tutorial-number">02</span>
                <h3>Follow your nose</h3>
                <p>
                  Walk up to a sparkling object and press <kbd>E</kbd>. Press{" "}
                  <kbd>Q</kbd> to sniff out nearby clues. <kbd>J</kbd> opens
                  your notebook.
                </p>
              </div>
              <div>
                <span className="tutorial-number">03</span>
                <h3>Compare your stories</h3>
                <p>
                  Mint and rose collars reveal different evidence. Read it to
                  each other. There’s no penalty for wrong answers, and hints
                  are always there.
                </p>
              </div>
            </div>
            <div className="camera-onboarding">
              <div className="camera-onboarding-copy">
                <Camera size={23} />
                <div>
                  <h3>Put a face above those paws</h3>
                  <p>
                    Choose Enable camera below to request access. You’ll see a
                    preview as soon as it works. Video only; your microphone is
                    never requested. Keep your other call for audio.
                  </p>
                </div>
              </div>
              <div className="camera-onboarding-action">
                <CameraTile local role={s.role} />
                <button
                  className="button subtle"
                  disabled={cameraBusy}
                  onClick={toggleCamera}
                >
                  {cameraBusy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : cameraOn ? (
                    <Check size={18} />
                  ) : (
                    <Camera size={18} />
                  )}{" "}
                  {cameraBusy
                    ? "Waiting for camera permission…"
                    : cameraOn
                      ? "Camera on · turn off"
                      : "Enable camera"}
                </button>
              </div>
              {cameraError && (
                <p role="alert" className="camera-setup-error">
                  {cameraError}
                </p>
              )}
              {cameraBusy && (
                <p className="helper">
                  Check your browser’s camera prompt or the permissions icon
                  beside the address. You can continue playing while camera
                  access is pending.
                </p>
              )}
            </div>
            <button
              className="button primary wide"
              onClick={() => {
                setTutorial(false);
                sound("click");
              }}
            >
              Ready, Mingy <PawPrint size={18} />
            </button>
            <small className="helper">
              About an hour, at your pace. Progress saves automatically. Laptop
              + Chrome or Edge recommended.
            </small>
          </section>
        </div>
      )}
      {chapterCard >= 0 && !tutorial && (
        <div className="chapter-overlay" onClick={() => setChapterCard(-1)}>
          <span className="edition">
            CHAPTER {String(chapterCard).padStart(2, "0")}
          </span>
          <h2>{chapters[chapterCard].title}</h2>
          <p>{chapters[chapterCard].subtitle}</p>
          <button className="text-button">
            Continue together <ChevronRight size={16} />
          </button>
        </div>
      )}
      {panel && state && !tutorial && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <section
            className={`modal ${panel === "notebook" ? "notebook-modal" : ""} ${activeClue?.kind === "photo" ? "photo-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            <button
              className="modal-close"
              aria-label="Close panel"
              onClick={() => setPanel(null)}
            >
              <X />
            </button>
            <span className="edition">
              {panel === "notebook"
                ? "THE SHARED CASE FILE"
                : panel === "hints"
                  ? "NO SHAME IN A LITTLE HELP"
                  : activeClue?.kind === "photo"
                    ? "SOME THINGS FEEL FAMILIAR"
                    : activeClue?.kind === "puzzle"
                      ? "TWO PAWS ARE BETTER THAN ONE"
                      : `EVIDENCE · ${role === 0 ? "MINT" : "ROSE"} COLLAR`}
            </span>
            <h2 id="panel-title">
              {panel === "notebook"
                ? "Notes from the house"
                : panel === "hints"
                  ? "A little nudge"
                  : panel === "share"
                    ? "Bring your Mingy"
                    : activeClue?.title}
            </h2>
            {panel === "notebook" && (
              <>
                <div className="notebook-summary">
                  <span>
                    {state.found.filter((id) => !id.startsWith("photo")).length}{" "}
                    traces collected
                  </span>
                  <span>{state.balls.length} / 5 tennis balls</span>
                  <span>
                    Saved together <Check size={12} />
                  </span>
                </div>
                <p className="modal-intro">
                  Your partner’s collar sees different details. These are{" "}
                  <strong>your</strong> readings of the evidence you’ve found
                  together.
                </p>
                {chapters.slice(0, Math.min(chapter + 1, 8)).map((c, i) => (
                  <details key={i} open={i === chapter}>
                    <summary>
                      <span>
                        {i === 0 ? "Prologue" : `Chapter ${i}`} · {c.title}
                      </span>
                      {i < chapter ? (
                        <Check size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </summary>
                    <div className="notebook-entries">
                      {clues
                        .filter((c) => c.chapter === i && !c.kind)
                        .map((c) => (
                          <div
                            className={`notebook-entry ${state.found.includes(c.id) ? "found" : "undiscovered"}`}
                            key={c.id}
                          >
                            <h3>
                              {state.found.includes(c.id)
                                ? c.title
                                : "An undiscovered trace"}
                              <small>{places[c.place].name}</small>
                            </h3>
                            {state.found.includes(c.id) ? (
                              <p>{c.text?.[role]}</p>
                            ) : (
                              <p>
                                Explore this part of the house. Your nose may
                                find something.
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </details>
                ))}
              </>
            )}
            {panel === "hints" && (
              <>
                <p>
                  You’re in <strong>{current.title}</strong>. Take a breath.
                  Good detectives ask each other ridiculous questions.
                </p>
                <div className="hint-stack">
                  {currentHints.slice(0, hintLevel).map((h, i) => (
                    <div key={i}>
                      <span>Nudge {i + 1}</span>
                      <p>{h}</p>
                    </div>
                  ))}
                </div>
                <button
                  className="button primary wide"
                  disabled={hintLevel >= (currentHints?.length || 0)}
                  onClick={() => setHintLevel((v) => v + 1)}
                >
                  {hintLevel === 0
                    ? "Give us a gentle nudge"
                    : hintLevel < (currentHints?.length || 0)
                      ? "A more specific nudge"
                      : "That’s every nudge for this chapter"}
                  <Leaf size={18} />
                </button>
                <small className="helper">
                  Hints get more direct one at a time. Open only what you want.
                </small>
              </>
            )}
            {panel === "share" && (
              <>
                <p>
                  Open this same address on your other device. Choose a puppy
                  and press play; the game connects you automatically.
                </p>
                <textarea
                  className="share-url"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </>
            )}
            {activeClue?.text && (
              <>
                <div className="clue-paper">
                  {activeClue.text[role].split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <div className="saved-note">
                  <Check size={14} /> Added to your shared notebook
                </div>
              </>
            )}
            {activeClue?.kind === "photo" && (
              <>
                <img
                  className="memory-photo"
                  src={`/api/photo?id=${activeClue.photo}`}
                  alt="A familiar memory of the two of you"
                />
                <p className="photo-caption">
                  The house seems to know your favourite people.
                </p>
              </>
            )}
            {activeClue?.kind === "puzzle" && (
              <Puzzle
                key={`${activeClue.id}-${chapter}`}
                id={activeClue.id}
                state={state}
                role={role}
              />
            )}
          </section>
        </div>
      )}
    </main>
  );
}
export default App;
