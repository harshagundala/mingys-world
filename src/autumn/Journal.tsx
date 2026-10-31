import { useEffect, useRef, useState } from "react";
import { ArrowRight, Leaf, X } from "lucide-react";
import { acts, names, chapterNumber, chapterTip } from "./content";
import type { State } from "../../server/autumn/rules";

const keys = [
  ["W A S D", "Walk"],
  ["Mouse / trackpad", "Look"],
  ["E", "Use / gather"],
  ["Shift", "Run"],
  ["Space", "Jump"],
  ["V", "Change view"],
  ["Q", "Call your Mingy"],
  ["Esc", "Release mouse / menu"],
];
// These observations follow saved progress, so a refresh never retells a future event.
function currentNote(s: State) {
  if (s.phase === 9 && s.expedition) {
    const e = s.expedition;
    if (e.assembly >= 3)
      return "The roof opens. The storm was caught in an unfinished circuit: water without light, light without a home. The glassheart has both again. The weather can finally move on.";
    if (e.carry.delivered)
      return "The glassheart settles into its cradle. Its two halves answer from opposite sides of the room. Finish the same beat together; let it hear you agree.";
    if (e.carry.holders.length === 2)
      return "The glassheart changes its rhythm as you walk. When you match each other’s pace, the light steadies between you. A shared weight has become a shared direction.";
    if (e.water.length >= 3 && e.light.length >= 3)
      return e.routeOrder[0] === "light"
        ? "The lantern trail showed where the light belongs. The waterworks gave it a pulse. The glasshouse has been calling for its missing heart. Bring it home together."
        : "The waterworks gave the heart a pulse. The lantern trail showed where its light belongs. The glasshouse has been calling for its missing heart. Bring it home together.";
    if (e.water.length >= 3)
      return "The waterworks runs again, but its glass gauges still pulse toward the Lantern Trail. The heart has a rhythm. It is waiting for its other half.";
    if (e.light.length >= 3)
      return "The lanterns agree on a pattern: the glassheart is whole. It is waiting for the old waterworks to give it a pulse.";
    if (e.firstRoute === "light" && e.light.length)
      return "The first light answers yours. Its beam points deeper into the hollow, toward something that is reflecting the storm back at the sky.";
    if (e.firstRoute === "water" && e.water.length)
      return "Pressure returns to the old pipes. Beneath the rushing water is another sound: a slow, uneven pulse. Something in the glasshouse is trying to wake.";
  }
  if (s.phase === 8 && s.expedition?.completed && s.expedition.at > 0)
    return "Below the hill, the glassheart keeps time. Above it, twelve wishes drift. The keeper’s register has two new names. Under ‘what was saved’: the evening.";

  if (
    s.phase === 1 &&
    Object.values(s.harvest).reduce((a, b) => a + b, 0) >= 15
  )
    return "The cart smells of apples and wet leaves. There will be enough for a proper supper. Somewhere, the keeper has underlined the word ‘everyone.’";
  if (s.phase === 2 && s.bridge >= 3)
    return "The crossing is taking shape. The boards are different colors, but every joint holds. No one will mistake this bridge for something made by strangers.";
  if (s.phase === 3 && s.boat.stop >= 2)
    return "Paper from Willow Bend. Wicks from The Little Landing. One more parcel at Moonwater, and the town will have everything it needs to make its own stars.";
  if (s.phase === 3 && s.boat.stop >= 1)
    return "Inside the first parcel: folded lantern paper, kept perfectly dry. Its label says: ‘For the wishes you haven’t thought of yet.’";
  if (s.phase === 4 && s.order >= 4)
    return "The tables are filling. The harvest you carried through the orchard is becoming someone’s favorite part of the evening.";
  if (s.phase === 5 && s.fair.round >= 2) {
    const [a, b] = s.fair.scores;
    return a === b
      ? "The championship is tied. The official regulations recommend looking very serious about this, then throwing another pumpkin."
      : `${names[a > b ? 0 : 1]} is ahead and is therefore treating this as a legitimate sport. The official regulations remain suspiciously silent on technique.`;
  }
  if (s.phase === 6 && s.towers.length >= 3)
    return "The towers are finding the wind again. From here, the bridge and the supper tables belong to the same small, glowing town. You have been putting it back together.";
  if (s.phase === 7 && Object.keys(s.lanterns).length >= 6)
    return "The meadow is filling with wishes. Paper from the river, light from the station, and all the little choices that make this evening yours.";
  return acts[s.phase].note;
}
export function Journal({
  open,
  s,
  onClose,
}: {
  open: boolean;
  s: State;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(open),
    [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let timer = 0;
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      timer = window.setTimeout(() => setVisible(false), 380);
    }
    return () => clearTimeout(timer);
  }, [open, visible]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => close.current?.focus(), 80);
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialog.current) return;
      const buttons = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button,[href],select,input,[tabindex="0"]',
        ),
      );
      if (e.shiftKey && document.activeElement === buttons[0]) {
        e.preventDefault();
        buttons.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
        e.preventDefault();
        buttons[0]?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", trap);
      previous?.focus?.();
    };
  }, [open]);
  if (!visible) return null;
  return (
    <div
      className={`ll-journal-scene ${closing ? "closing" : ""}`}
      aria-hidden={!open}
    >
      <div
        className="ll-journal"
        role="dialog"
        aria-modal={open}
        aria-labelledby="ll-journal-title"
        ref={dialog}
      >
        <div className="ll-journal-cover" aria-hidden="true">
          <Leaf size={40} />
          <span>THE LAST LIGHT</span>
          <small>Field notes · Harsha & Mingy</small>
        </div>
        <div className="ll-journal-pages">
          <section className="ll-journal-page ll-journal-left">
            <span className="ll-journal-running">
              BRAMBLEWICK · FIELD NOTES
            </span>
            <h2 id="ll-journal-title">{acts[s.phase].name}</h2>
            <p className="ll-journal-place">{acts[s.phase].place}</p>
            <div className="ll-journal-etching" aria-hidden="true">
              {s.phase === 9 ? (
                <svg viewBox="0 0 320 142" fill="none">
                  <path
                    d="M109 80V34L160 9L211 34V80ZM103 35L160 5L217 35M160 10V79M134 22V79M186 22V79M110 48H210M110 65H210"
                    stroke="currentColor"
                    strokeWidth=".8"
                  />
                  <path
                    d="M150 80V56Q160 42 170 56V80"
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                  <path
                    d="M151 121C125 110 45 112 45 79S70 49 104 49M169 121C194 110 277 112 277 79S252 49 216 49"
                    stroke="currentColor"
                    strokeWidth=".8"
                    strokeDasharray="2 4"
                    opacity=".7"
                  />
                  <g transform="translate(45 75)" stroke="currentColor">
                    <circle r="12" strokeWidth=".8" />
                    <circle r="3" />
                    {[0, 60, 120].map((a) => (
                      <path
                        key={a}
                        d="M-11 0H11"
                        transform={`rotate(${a})`}
                        strokeWidth=".6"
                      />
                    ))}
                  </g>
                  <g transform="translate(277 75)" stroke="currentColor">
                    <path
                      d="M-7 -10H7V10H-7ZM-5 -10V-14Q0 -21 5 -14V-10M-9 11H9M-9 -11H9M0 -9V9"
                      strokeWidth=".8"
                    />
                  </g>
                  <path
                    d="M160 113L151 121L160 133L169 121ZM151 121H169M160 113V133"
                    stroke="currentColor"
                    strokeWidth=".9"
                  />
                  <path
                    d="M15 126Q45 119 88 129M232 129Q275 119 305 126"
                    stroke="currentColor"
                    opacity=".3"
                  />
                  <text
                    x="45"
                    y="103"
                    fill="currentColor"
                    stroke="none"
                    textAnchor="middle"
                    fontSize="7"
                    letterSpacing="1.4"
                  >
                    WATER
                  </text>
                  <text
                    x="277"
                    y="103"
                    fill="currentColor"
                    stroke="none"
                    textAnchor="middle"
                    fontSize="7"
                    letterSpacing="1.4"
                  >
                    LIGHT
                  </text>
                </svg>
              ) : (
                <svg viewBox="0 0 320 142" fill="none">
                  <path
                    d="M0 85L33 48L49 63L88 21L112 48L141 13L181 57L207 32L247 77L272 49L320 88"
                    stroke="currentColor"
                    strokeWidth=".8"
                  />
                  <path
                    d="M5 91L60 66L109 88L154 62L198 92L258 76L315 96M0 111Q88 86 170 109T320 114M0 123Q70 112 133 126T320 122"
                    stroke="currentColor"
                    opacity=".45"
                  />
                  {[22, 51, 73, 260, 287, 303].map((x, i) => (
                    <g
                      key={x}
                      transform={`translate(${x} ${67 + (i % 3) * 8})`}
                    >
                      <path
                        d="M0 33V-8M0 -8L-7 8H-4L-10 22H10L4 8H7Z"
                        stroke="currentColor"
                        strokeWidth=".7"
                      />
                    </g>
                  ))}
                  <path
                    d="M116 97V72L138 58L160 72V97M110 73L138 54L166 73M130 97V80H143V97M150 78H156V86H150ZM121 78H127V86H121Z"
                    stroke="currentColor"
                  />
                  <path
                    d="M194 115V95H225V115M191 98Q209 85 228 98M197 98V108M204 95V107M211 95V107M219 98V108"
                    stroke="currentColor"
                    strokeWidth=".9"
                  />
                  <circle
                    cx="219"
                    cy="25"
                    r="10"
                    stroke="currentColor"
                    strokeWidth=".6"
                  />
                </svg>
              )}
            </div>
            <p className="ll-journal-note">{currentNote(s)}</p>
            <div className="ll-pressed-leaf" aria-hidden="true">
              <Leaf size={63} strokeWidth={0.8} />
            </div>
            <span className="ll-journal-folio">
              {String(chapterNumber(s.phase) * 2 - 1).padStart(2, "0")}
            </span>
          </section>
          <section className="ll-journal-page ll-journal-right">
            <button
              ref={close}
              className="ll-close"
              aria-label="Close field guide"
              onClick={onClose}
            >
              <X />
            </button>
            <span className="ll-journal-running">THIS EVENING</span>
            <p className="ll-journal-instruction">
              {chapterTip(s.phase, s.expedition)}
            </p>
            <div className="ll-guide-keys">
              {keys.map(([key, label]) => (
                <span key={key}>
                  <kbd>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
            <p className="ll-journal-small">
              Two-finger drag over the world looks around without clicking. For
              mouse look, click the world or right-drag. Escape releases the
              mouse. Your evening is saved.
            </p>
            {s.phase === 1 && (
              <div className="ll-friendly-score">
                <span>
                  {names[0]} <b>{s.score[0]}</b>
                </span>
                <Leaf size={17} />
                <span>
                  {names[1]} <b>{s.score[1]}</b>
                </span>
              </div>
            )}
            <button className="ll-journal-return" onClick={onClose}>
              Back to the evening <ArrowRight size={15} />
            </button>
            <span className="ll-journal-folio">
              {String(chapterNumber(s.phase) * 2).padStart(2, "0")}
            </span>
          </section>
        </div>
        <div className="ll-journal-ribbon" aria-hidden="true" />
      </div>
    </div>
  );
}
