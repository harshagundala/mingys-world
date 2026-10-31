import { useEffect, useRef, useState } from "react";
import { ArrowRight, Leaf, X } from "lucide-react";
import { acts, names } from "./content";
import type { State } from "../../server/autumn/rules";

const keys = [
  ["W A S D", "Walk"],
  ["Mouse", "Look around"],
  ["E", "Use / gather"],
  ["Shift", "Run"],
  ["Space", "Jump"],
  ["V", "Change view"],
  ["Q", "Call your Mingy"],
  ["Esc", "Release mouse / menu"],
];
const notes = [
  "Two tickets. No return time. A pressed maple leaf between them.",
  "The best apples are never quite the same color. Neither are the best evenings.",
  "Measure twice. Laugh as often as necessary. Leave your initials somewhere only you will notice.",
  "A river remembers the shape of everything it passes. Take the long way.",
  "A warm plate is a small way of saying: you belong here.",
  "House rules: enthusiasm counts. Dignity is optional.",
  "The wind is not in a hurry. Listen before you pull.",
  "Write a wish small enough to carry. Let the sky make room for it.",
  "Keep this leaf. It was here with you.",
];
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
                  <g key={x} transform={`translate(${x} ${67 + (i % 3) * 8})`}>
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
            </div>
            <p className="ll-journal-note">{notes[s.phase]}</p>
            <div className="ll-pressed-leaf" aria-hidden="true">
              <Leaf size={63} strokeWidth={0.8} />
            </div>
            <span className="ll-journal-folio">
              {String(s.phase * 2 + 1).padStart(2, "0")}
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
            <p className="ll-journal-instruction">{acts[s.phase].tip}</p>
            <div className="ll-guide-keys">
              {keys.map(([key, label]) => (
                <span key={key}>
                  <kbd>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
            <p className="ll-journal-small">
              Click the world to capture the mouse. Right-drag also works. Your
              place in the story is saved.
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
              {String(s.phase * 2 + 2).padStart(2, "0")}
            </span>
          </section>
        </div>
        <div className="ll-journal-ribbon" aria-hidden="true" />
      </div>
    </div>
  );
}
