import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  KeyRound,
  Moon,
  Sun,
  PawPrint,
  Star,
  Sparkles,
  Leaf,
  Flower2,
  Radio,
  RotateCcw,
  Heart,
  Hand,
  Zap,
} from "lucide-react";
import { session } from "../network/session";
import type { GameState } from "../../server/rules";
import { required, signalCodes, decoder } from "../game/content";
import type { Role } from "../game/content";
export function SymbolIcon({
  name,
  size = 25,
}: {
  name: string;
  size?: number;
}) {
  const icons: Record<string, any> = {
    moon: Moon,
    sun: Sun,
    paw: PawPrint,
    star: Star,
    comet: Sparkles,
    key: KeyRound,
    fern: Leaf,
    ivy: Leaf,
    rose: Flower2,
    lily: Flower2,
  };
  const Icon = icons[name] || Star;
  return <Icon size={size} />;
}
function Sequence({
  options,
  length,
  onSubmit,
  label,
  busy = false,
}: {
  options: string[];
  length: number;
  onSubmit: (v: string[]) => void;
  label: string;
  busy?: boolean;
}) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <div className="sequence-slots" aria-label="Your sequence">
        {Array.from({ length }, (_, i) => (
          <div key={i} className={value[i] ? "filled" : ""}>
            {value[i] ? (
              <>
                <SymbolIcon name={value[i]} size={22} />
                <small>{value[i]}</small>
              </>
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
        ))}
      </div>
      <div className="symbol-options">
        {options.map((o) => (
          <button
            key={o}
            className="symbol-option"
            onClick={() => setValue((v) => (v.length < length ? [...v, o] : v))}
            disabled={value.length === length}
          >
            <SymbolIcon name={o} />
            <span>{o}</span>
          </button>
        ))}
      </div>
      <div className="puzzle-actions">
        <button className="button subtle" onClick={() => setValue([])}>
          <RotateCcw size={15} /> Clear
        </button>
        <button
          className="button primary"
          disabled={value.length !== length || busy}
          onClick={() => onSubmit(value)}
        >
          {label}
          <ChevronRight size={17} />
        </button>
      </div>
    </>
  );
}
export function Puzzle({
  id,
  state: s,
  role,
}: {
  id: string;
  state: GameState;
  role: Role;
}) {
  const [code, setCode] = useState(""),
    [guests, setGuests] = useState(["", "", "", ""]),
    [times, setTimes] = useState(["", "", "", ""]),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    setBusy(false);
  }, [s.version]);
  useEffect(() => {
    const clear = () => setBusy(false);
    session.addEventListener("notice", clear);
    return () => session.removeEventListener("notice", clear);
  }, []);
  const solve = (answer: any) => {
    if (busy) return;
    setBusy(true);
    session.action({ kind: "solve", id, answer });
    setTimeout(() => setBusy(false), 5000);
  };
  const expected: Record<string, number> = {
    bell: 0,
    clock: 1,
    evidence: 2,
    valves: 3,
    signal: 4,
    power: 5,
    sky: 6,
    heart: 7,
  };
  if (s.chapter > expected[id] && id !== "heart")
    return (
      <div className="solved-panel">
        <Check size={38} />
        <h3>This part of the story is complete.</h3>
        <p>You did that together. Your next lead is in the notebook.</p>
      </div>
    );
  const missing = (required[s.chapter] || []).filter(
    (c) => !s.found.includes(c),
  );
  if (id === "bell")
    return (
      <>
        <p>
          The bell is cool beneath your paw. Somewhere inside the walls, a
          second bell waits for an answer.
        </p>
        <div className="paired-status">
          {[0, 1].map((r) => (
            <div
              key={r}
              className={`role-${r} ${s.bells.includes(r) ? "done" : ""}`}
            >
              <PawPrint />
              <span>{r === 0 ? "Mint collar" : "Rose collar"}</span>
              {s.bells.includes(r) ? (
                <Check size={17} />
              ) : (
                <small>Waiting</small>
              )}
            </div>
          ))}
        </div>
        <button
          className="button primary wide"
          disabled={s.bells.includes(role)}
          onClick={() => session.action({ kind: "bell" })}
        >
          {s.bells.includes(role)
            ? "Your arrival is recorded"
            : "Ring the bell"}
          <PawPrint size={18} />
        </button>
      </>
    );
  if (id === "heart")
    return (
      <>
        <div className="heart-emblem">
          <Heart size={48} />
        </div>
        <p>“I thought home was a place that kept everyone from leaving.”</p>
        <p>The Star glows between your paws.</p>
        <p>
          “But you two found each other in every room. You didn’t need to be in
          the same place to see the same story.”
        </p>
        <p className="final-line">“Would you stay, just for a little while?”</p>
        <div className="paired-status">
          {[0, 1].map((r) => (
            <div
              key={r}
              className={`role-${r} ${s.finalPaws[r] && now - s.finalPaws[r] < 8000 ? "done" : ""}`}
            >
              <PawPrint />
              <span>{r === 0 ? "Mint paw" : "Rose paw"}</span>
              {s.finalPaws[r] && now - s.finalPaws[r] < 8000 ? (
                <Check size={16} />
              ) : (
                <small>Waiting</small>
              )}
            </div>
          ))}
        </div>
        <button
          className="button primary wide"
          onClick={() => session.action({ kind: "final" })}
        >
          Put my paw beside yours <Heart size={18} />
        </button>
        <small className="helper">
          Both choose within eight seconds. You can try as many times as you
          like.
        </small>
      </>
    );
  if (id === "power") {
    const remaining = s.powerUntil
      ? Math.max(0, Math.ceil((s.powerUntil - now) / 1000))
      : 0;
    return (
      <>
        <div className="puzzle-illustration">
          <Zap size={38} />
        </div>
        <p>
          Both puppies need to be in the workshop. When you start, the backup
          circuit stays open for <strong>100 seconds</strong>.
        </p>
        <p>
          Find your three coloured fuses. Press <kbd>E</kbd> next to each one.
          Sprint with <kbd>Shift</kbd>; jump over the sweep with{" "}
          <kbd>Space</kbd>.
        </p>
        <p>No lives. No lost clues. You can retry the run.</p>
        <div className="power-summary">
          <strong>{remaining ? `${remaining}s` : "Ready when you are"}</strong>
          <span>{s.fuses.length} / 6 fuses restored</span>
        </div>
        <button
          className="button primary wide"
          disabled={remaining > 0}
          onClick={() => session.action({ kind: "power-start" })}
        >
          {remaining ? "The run is underway" : "Start the backup run"}
          <Zap size={18} />
        </button>
      </>
    );
  }
  return (
    <>
      {missing.length > 0 && (
        <div className="evidence-warning">
          <span>
            {missing.length} more {missing.length === 1 ? "trace" : "traces"} to
            find
          </span>
          <p>
            You can examine the mechanism now. Collect the chapter’s evidence
            before submitting an answer.
          </p>
        </div>
      )}
      {id === "clock" && (
        <>
          <p>
            The lock wants the moment the North Star left the house.{" "}
            <strong>Hour first, minute second.</strong> The clock hands
            themselves are no help.
          </p>
          <p className="collar-note">
            Your collars reveal different parts of the timeline. Compare what
            you found.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              solve(code);
            }}
          >
            <label className="field-label" htmlFor="clock-code">
              Departure time · 24-hour format
            </label>
            <input
              id="clock-code"
              className="code-input"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{4}"
              autoComplete="off"
              placeholder="— — — —"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="button primary wide"
              disabled={busy || code.length !== 4 || missing.length > 0}
            >
              Turn the key <KeyRound size={18} />
            </button>
          </form>
        </>
      )}
      {id === "evidence" && (
        <>
          <p>
            Each guest occupied one room and had a different arrival time.
            Reconstruct both parts of the evening to find who sent the courier
            through the conservatory.
          </p>
          <div className="guest-grid">
            {["Kitchen", "Music room", "Study", "Conservatory"].map(
              (room, i) => (
                <label key={room}>
                  <span>{room}</span>
                  <select
                    value={guests[i]}
                    onChange={(e) =>
                      setGuests((v) =>
                        v.map((x, n) => (n === i ? e.target.value : x)),
                      )
                    }
                  >
                    <option value="">Choose a guest</option>
                    {["Iris", "Vale", "Pip", "Ada"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`${room} arrival time`}
                    value={times[i]}
                    onChange={(e) =>
                      setTimes((v) =>
                        v.map((x, n) => (n === i ? e.target.value : x)),
                      )
                    }
                  >
                    <option value="">Arrival time</option>
                    {["20:40", "20:55", "21:10", "21:25"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              ),
            )}
          </div>
          <button
            className="button primary wide"
            disabled={
              busy ||
              new Set(guests.filter(Boolean)).size !== 4 ||
              new Set(times.filter(Boolean)).size !== 4 ||
              missing.length > 0
            }
            onClick={() => solve({ guests, times })}
          >
            Reconstruct the evening <ChevronRight size={18} />
          </button>
        </>
      )}
      {id === "valves" &&
        (s.water ? (
          <div className="solved-panel">
            <Leaf size={36} />
            <h3>The garden is waking up.</h3>
            <p>
              Now stand on the two glowing seals outside the cabinet, one puppy
              on each. Stay there together for three seconds.
            </p>
          </div>
        ) : (
          <>
            <p>
              Open the four valves in the order the plants wake, from dawn
              through night.
            </p>
            <Sequence
              busy={busy}
              options={["ivy", "lily", "fern", "rose"]}
              length={4}
              onSubmit={solve}
              label="Open the valves"
            />
          </>
        ))}
      {id === "signal" && (
        <>
          <div className="signal-heading">
            <Radio size={21} />
            <span>Transmission {s.round + 1} of 3</span>
          </div>
          {role === 0 ? (
            <>
              <p>
                You are the transmitter. Read these numbers to your Mingy{" "}
                <strong>in order</strong>. Only their collar reveals how to
                decode them.
              </p>
              <div className="transmission-code">
                {signalCodes[s.round].map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
              <div className="quiet-note">
                Your partner submits the symbols. Keep this panel open; the next
                transmission will arrive here.
              </div>
            </>
          ) : (
            <>
              <p>
                You are the receiver. Ask your Mingy for the numbers on their
                screen, then translate each using your decoder.
              </p>
              <div className="decoder">
                {Object.entries(decoder).map(([n, v]) => (
                  <div key={n}>
                    <b>{n}</b>
                    <span>=</span>
                    <SymbolIcon name={v} size={18} />
                    <small>{v}</small>
                  </div>
                ))}
              </div>
              <Sequence
                busy={busy}
                key={s.round}
                options={["sun", "star", "moon", "paw"]}
                length={signalCodes[s.round].length}
                onSubmit={solve}
                label="Send the reply"
              />
            </>
          )}
        </>
      )}
      {id === "sky" && (
        <>
          <p>
            Five celestial symbols, one possible order. Use both sets of window
            notes and the astronomer’s definition to align them from left to
            right.
          </p>
          <Sequence
            busy={busy}
            options={["key", "sun", "comet", "moon", "paw"]}
            length={5}
            onSubmit={solve}
            label="Align the sky"
          />
        </>
      )}
    </>
  );
}
