import {
  Check,
  ArrowRight,
  RotateCcw,
  RotateCw,
  PawPrint,
  Telescope,
} from "lucide-react";
import { session } from "../network/session";
import {
  dreamRoutes,
  dreamGlyphs,
  dreamNavigator,
  circuitPorts,
  circuitInitial,
  mirrorTargets,
} from "../game/adventure";
import type { GameState } from "../../server/rules";
export function AdvancedPuzzle({
  id,
  state: s,
  role,
}: {
  id: string;
  state: GameState;
  role: number;
}) {
  if (id === "atlas") {
    const round = Math.min(s.dreamRound || 0, 2),
      nav = dreamNavigator(round),
      route = dreamRoutes[round];
    if (s.chapter > 2)
      return (
        <div className="solved-panel">
          <Check />
          <h3>The impossible room remembers you.</h3>
          <p>
            The garden is open. Follow the moonflowers through the far doorway.
          </p>
        </div>
      );
    return (
      <>
        <p className="puzzle-story">
          The map rearranges itself when a second pair of eyes tries to read it.
          One Mingy must guide the other by voice.
        </p>
        <div className="challenge-meta">
          <span>Fold {round + 1} / 3</span>
          <span>
            {s.dreamStep || 0} / {route.length} threads followed
          </span>
        </div>
        {role !== nav ? (
          <div className="asymmetric-note">
            <PawPrint size={34} />
            <h3>You’re the explorer.</h3>
            <p>
              Your Mingy reads the atlas. Walk onto the tile they name, then
              press <kbd>E</kbd>. Walking across other tiles is safe.
            </p>
            <p>Close this card with Escape. Your reader stays here.</p>
          </div>
        ) : (
          <>
            <p>
              You’re the reader. Stay at this lectern. Read the tile names in{" "}
              <strong>number order</strong>, one at a time, to your Mingy. The
              sheet is turned; the tile names are your anchors.
            </p>
            <div
              className="dream-map"
              style={{ transform: `rotate(${round * 90}deg)` }}
            >
              {dreamGlyphs.map((name, i) => {
                const n = route.indexOf(i);
                return (
                  <div
                    key={name}
                    className={n >= 0 ? "route" : ""}
                    style={{ transform: `rotate(${-round * 90}deg)` }}
                  >
                    {n >= 0 && (
                      <b className={n < (s.dreamStep || 0) ? "visited" : ""}>
                        {n + 1}
                      </b>
                    )}
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
            <p className="helper">
              If a tile is wrong, only the current fold restarts. Roles swap on
              the second fold.
            </p>
          </>
        )}
      </>
    );
  }
  if (id.startsWith("circuit-")) {
    if (s.chapter > 4)
      return (
        <div className="solved-panel">
          <Check />
          <h3>The heartbeat is back.</h3>
          <p>The backup console is ready.</p>
        </div>
      );
    if (s.round < 3)
      return (
        <p>The wall panels are asleep. Decode the three transmissions first.</p>
      );
    const owns = id === (role === 0 ? "circuit-mint" : "circuit-rose"),
      rotations = s.circuit || circuitInitial;
    return (
      <>
        <p className="puzzle-story">
          “I tried to build a home that nobody could leave.” The machine’s voice
          shakes. “I think I accidentally built a prison with excellent
          curtains.”
        </p>
        <p>
          Restore a single copper path from <strong>IN</strong> to{" "}
          <strong>OUT</strong>. Every one of the sixteen pipes belongs to that
          path. Mint turns mint squares; rose turns rose squares. All changes
          appear on both boards.
        </p>
        {!owns && (
          <p className="helper">
            This is your partner’s panel. Your controls are across the room.
          </p>
        )}
        <div className="circuit-board">
          <span className="circuit-in">IN →</span>
          <span className="circuit-out">OUT ←</span>
          {Array.from({ length: 16 }, (_, i) => {
            const owner = (Math.floor(i / 4) + (i % 4)) % 2;
            return (
              <button
                key={i}
                aria-label={`Turn pipe ${i + 1}`}
                disabled={!owns || owner !== role}
                onClick={() =>
                  session.action({ kind: "circuit-turn", cell: i })
                }
                className={`role-${owner}`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <g transform={`rotate(${rotations[i] * 90} 50 50)`}>
                    {circuitPorts[i].map((d) => (
                      <line
                        key={d}
                        x1="50"
                        y1="50"
                        x2={[50, 100, 50, 0][d]}
                        y2={[0, 50, 100, 50][d]}
                        strokeWidth="14"
                        strokeLinecap="round"
                      />
                    ))}
                  </g>
                  <circle cx="50" cy="50" r="10" />
                </svg>
                <small>{i + 1}</small>
              </button>
            );
          })}
        </div>
        <p className="helper">
          Click a square to rotate it clockwise. A straight pipe looks the same
          after two turns. The machine will wake when the whole path connects.
        </p>
      </>
    );
  }
  if (id.startsWith("mirror-")) {
    if (s.chapter > 6)
      return (
        <div className="solved-panel">
          <Check />
          <h3>The sky is holding.</h3>
          <p>The house is ready for your last two paws.</p>
        </div>
      );
    if (!s.skyAligned) return <p>The mirrors wait for the celestial orrery.</p>;
    const owns = id === (role === 0 ? "mirror-mint" : "mirror-rose"),
      round = Math.min(s.mirrorRound || 0, 2),
      angles = s.mirrors || [0, 0],
      target = mirrorTargets[round][role];
    return (
      <>
        <div className="challenge-meta">
          <span>Constellation {round + 1} / 3</span>
          <Telescope size={20} />
        </div>
        <p className="puzzle-story">
          The sky is not a ceiling anymore. It is every light that someone has
          left on for somebody else.
        </p>
        <p>
          Your collar reveals{" "}
          <strong>your target: {target === 0 ? 12 : target}</strong>. Ask your
          Mingy for theirs. Turning your own dial also moves their reflection.
        </p>
        <div className="mirror-pair">
          {[0, 1].map((r) => (
            <div key={r} className={`mirror-dial role-${r}`}>
              <svg viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="63" />
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i * Math.PI) / 6;
                  return (
                    <text
                      key={i}
                      x={80 + Math.sin(a) * 52}
                      y={84 - Math.cos(a) * 52}
                    >
                      {i || 12}
                    </text>
                  );
                })}
                <line
                  x1="80"
                  y1="80"
                  x2={80 + Math.sin((angles[r] * Math.PI) / 6) * 37}
                  y2={80 - Math.cos((angles[r] * Math.PI) / 6) * 37}
                />
                <circle cx="80" cy="80" r="4" className="dial-pin" />
              </svg>
              <span>
                {r === 0 ? "Mint" : "Rose"} · {angles[r] || 12}
              </span>
            </div>
          ))}
        </div>
        <div className="mirror-controls">
          <button
            className="button subtle"
            disabled={!owns}
            onClick={() =>
              session.action({ kind: "mirror-turn", direction: -1 })
            }
          >
            <RotateCcw size={17} /> One step back
          </button>
          <button
            className="button primary"
            disabled={!owns}
            onClick={() =>
              session.action({ kind: "mirror-turn", direction: 1 })
            }
          >
            One step forward <RotateCw size={17} />
          </button>
        </div>
        <p className="helper">
          Mint: own dial +1, rose +2. Rose: own dial +1, mint +3. Both wrap
          around twelve; turning back reverses both. When both targets match,
          each hold your reflection within eight seconds.
        </p>
        <button
          className="button primary wide"
          disabled={!owns}
          onClick={() => session.action({ kind: "mirror-hold" })}
        >
          Hold my reflection <PawPrint size={18} />
        </button>
      </>
    );
  }
  if (id === "evidence" && s.archiveOpen && s.chapter === 2)
    return (
      <div className="asymmetric-note">
        <Check />
        <h3>The suspect asked for help.</h3>
        <p>
          Iris carried the Star outside because it asked her to. Behind the
          ledger is a music-box key.
        </p>
        <p>
          The box beside the globe has opened. Step inside. The next room has an
          unusual relationship with scale.
        </p>
        <ArrowRight />
      </div>
    );
  if (id === "signal" && s.round >= 3 && s.chapter === 4)
    return (
      <div className="asymmetric-note">
        <Check />
        <h3>That was a heartbeat.</h3>
        <p>
          Something inside the machine is alive. The two wall panels have lit
          up. Each of you takes the panel matching your collar.
        </p>
        <p>Keep talking. It is listening.</p>
      </div>
    );
  if (id === "sky" && s.skyAligned && s.chapter === 6)
    return (
      <div className="asymmetric-note">
        <Telescope />
        <h3>The roof has become a sky.</h3>
        <p>
          The western and eastern mirror pedestals are awake. One for each
          collar. Three reflections need to be held together.
        </p>
      </div>
    );
  return null;
}
