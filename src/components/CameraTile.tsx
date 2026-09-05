import { useEffect, useRef, useState } from "react";
import { camera } from "../network/camera";
import { CameraOff } from "lucide-react";
export function CameraTile({
  local = false,
  role = 0,
}: {
  local?: boolean;
  role?: number;
}) {
  const video = useRef<HTMLVideoElement>(null),
    img = useRef<HTMLImageElement>(null);
  const [mode, setMode] = useState("off");
  useEffect(() => {
    const refresh = () => {
      const stream = local ? camera.stream : camera.remote;
      if (stream) {
        if (video.current) {
          video.current.srcObject = stream;
          void video.current.play().catch(() => {});
        }
        setMode("video");
      } else if (!local && camera.remoteFrame) {
        setMode("frame");
        if (img.current) img.current.src = camera.remoteFrame;
      } else setMode("off");
    };
    const frame = () => {
      if (!local && !camera.remote) {
        if (img.current) img.current.src = camera.remoteFrame;
        setMode("frame");
      }
    };
    camera.addEventListener("change", refresh);
    camera.addEventListener("frame", frame);
    refresh();
    return () => {
      camera.removeEventListener("change", refresh);
      camera.removeEventListener("frame", frame);
    };
  }, [local]);
  return (
    <div
      className={`camera-tile role-${role} ${mode === "off" ? "camera-idle" : ""}`}
    >
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        style={{
          display: mode === "video" ? "block" : "none",
          transform: local ? "scaleX(-1)" : undefined,
        }}
      />
      <img
        ref={img}
        alt="Your Mingy’s live camera"
        style={{ display: mode === "frame" ? "block" : "none" }}
      />
      {mode === "off" && (
        <div className="camera-placeholder">
          <CameraOff size={15} />
          <span>{local ? "You" : "Mingy"}</span>
        </div>
      )}
      <span className="camera-tag">
        <i />
        {local ? "you" : "your Mingy"}
      </span>
    </div>
  );
}
