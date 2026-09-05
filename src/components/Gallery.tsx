import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, PawPrint } from "lucide-react";
import photos from "../game/photos.json";
import { session } from "../network/session";
import { CameraTile } from "./CameraTile";
import { Video, VideoOff } from "lucide-react";
const lines = [
  "Home isn’t a coordinate. It’s you.",
  "For all the places we’ve been.",
  "And all the places we haven’t found yet.",
  "My favourite part is still who I’m with.",
  "Same sky. Same team. Same two Mingys.",
  "Every good story needs a little us.",
];
export function Gallery({
  onReturn,
  index,
  role,
  cameraOn,
  cameraBusy,
  onCamera,
}: {
  onReturn: () => void;
  index: number;
  role: number;
  cameraOn: boolean;
  cameraBusy: boolean;
  onCamera: () => void;
}) {
  const [show, setShow] = useState(false);
  const setIndex = (next: number | ((previous: number) => number)) =>
    session.action({
      kind: "memory",
      index: typeof next === "function" ? next(index) : next,
    });
  const start = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") setIndex((v) => (v + 1) % photos.count);
      if (e.code === "ArrowLeft")
        setIndex((v) => (v - 1 + photos.count) % photos.count);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
    };
  }, [index]);
  return (
    <main className={`ending ${show ? "revealed" : ""}`}>
      <div className="ending-stars" />
      <header>
        <PawPrint size={21} />
        <span>Mingy’s World</span>
      </header>
      <div className="ending-title">
        <span className="edition">CASE CLOSED. DISTANCE, OVERRULED.</span>
        <h1>
          Home is <em>a who.</em>
        </h1>
        <p>
          Two puppies. One very good team.
          <br />
          And a whole world of us.
        </p>
      </div>
      <div
        className="memory-carousel"
        onTouchStart={(e) => (start.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const d = e.changedTouches[0].clientX - start.current;
          if (Math.abs(d) > 40)
            setIndex(
              (v) => (v + (d < 0 ? 1 : -1) + photos.count) % photos.count,
            );
        }}
      >
        <button
          className="gallery-arrow"
          aria-label="Previous memory"
          onClick={() => setIndex((v) => (v - 1 + photos.count) % photos.count)}
        >
          <ArrowLeft />
        </button>
        <figure>
          <img
            key={index}
            src={`/api/photo?id=${index}`}
            alt={`A memory of you two, ${index + 1} of ${photos.count}`}
          />
          <figcaption>
            {lines[index % lines.length]} <Heart size={14} />
          </figcaption>
        </figure>
        <button
          className="gallery-arrow"
          aria-label="Next memory"
          onClick={() => setIndex((v) => (v + 1) % photos.count)}
        >
          <ArrowRight />
        </button>
      </div>
      <div className="gallery-progress">
        {String(index + 1).padStart(2, "0")} <span>/ {photos.count}</span>
      </div>
      <p className="gallery-shared">
        One album, two Mingys. Either of you can turn the page.
      </p>
      <div className="gallery-thumbs">
        {Array.from({ length: photos.count }, (_, i) => (
          <button
            aria-label={`View memory ${i + 1}`}
            aria-pressed={i === index}
            key={i}
            className={i === index ? "active" : ""}
            onClick={() => setIndex(i)}
          >
            <img loading="lazy" src={`/api/photo?id=${i}&thumb=1`} alt="" />
          </button>
        ))}
      </div>
      <button className="text-button" onClick={onReturn}>
        Stay a little longer in the house <ArrowRight size={15} />
      </button>
      <aside className="ending-cameras" aria-label="Your cameras">
        <CameraTile local role={role} />
        <CameraTile role={1 - role} />
        <button
          className="icon-button"
          disabled={cameraBusy}
          onClick={onCamera}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          {cameraOn ? <Video size={19} /> : <VideoOff size={19} />}
        </button>
      </aside>
    </main>
  );
}
