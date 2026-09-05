import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Float, Sparkles } from "@react-three/drei";
import {
  ArrowUpRight,
  Check,
  Heart,
  LockKeyhole,
  PawPrint,
} from "lucide-react";
import { Puppy } from "../game/Puppy";
import { Box, Plant, Lamp } from "../game/Primitives";
import type { Role } from "../game/content";
function LittleHouse() {
  return (
    <group position={[1, 0, -3]}>
      <Box p={[0, 0.1, 0]} s={[9, 0.5, 7]} color="#64664f" />
      <Box p={[0, 2.1, 0]} s={[8, 4, 6]} color="#426257" />
      <Box p={[0, 0.55, 3.02]} s={[8, 0.7, 0.12]} color="#ddd0ac" />
      <Box p={[0, 2.9, 3.02]} s={[8, 0.1, 0.14]} color="#ba9a63" />
      <Box p={[0, 1.6, 3.06]} s={[1.6, 2.7, 0.15]} color="#39483e" />
      <Box p={[0, 1.7, 3.15]} s={[1.32, 2.35, 0.06]} color="#bc9662" />
      <Box p={[0.46, 1.55, 3.21]} s={[0.08, 0.2, 0.06]} color="#ead19a" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            p={[side * 2.6, 2.25, 3.05]}
            s={[1.9, 2, 0.15]}
            color="#e6d2a4"
          />
          <Box
            p={[side * 2.6, 2.25, 3.14]}
            s={[1.65, 1.75, 0.035]}
            color="#edca83"
            emissive="#bd8438"
          />
          <Box
            p={[side * 2.6, 2.25, 3.19]}
            s={[0.06, 1.75, 0.07]}
            color="#646a54"
          />
          <Box
            p={[side * 2.6, 2.25, 3.19]}
            s={[1.65, 0.065, 0.07]}
            color="#646a54"
          />
          <Box
            p={[side * 2.6, 1.2, 3.3]}
            s={[2.2, 0.14, 0.45]}
            color="#d9c49a"
          />
          <Plant p={[side * 3.6, 0.3, 3.8]} scale={1.4} />
        </group>
      ))}
      <Box p={[0, 4.08, 0]} s={[8.6, 0.22, 6.6]} color="#d8c391" />
      <mesh position={[0, 5.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[6.1, 2.8, 4]} />
        <meshStandardMaterial color="#35494b" roughness={0.85} />
      </mesh>
      <Box p={[-2.6, 5.5, -1]} s={[0.7, 2.4, 0.8]} color="#7c5a45" />
      <Box p={[-2.6, 6.73, -1]} s={[0.9, 0.2, 1]} color="#ac8c6b" />
      <Box p={[0, 0.02, 5.5]} s={[3, 0.12, 5]} color="#a19373" />
      {[-1, 1].map((s) => (
        <Lamp key={s} p={[s * 2.4, 0.2, 4.3]} height={1.6} />
      ))}
      <pointLight
        position={[0, 2, 4]}
        color="#ffd88c"
        intensity={15}
        distance={9}
      />
    </group>
  );
}
export function Lobby({
  authorized,
  authError,
  onEnter,
  room,
  initialRole = 0,
}: {
  authorized: boolean;
  authError: string;
  onEnter: (r: Role, newRoom: boolean) => void;
  room: string;
  initialRole?: Role;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  return (
    <main className="lobby">
      <div className="lobby-scene">
        <Canvas
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{ position: [12, 9, 17], fov: 40 }}
        >
          <color attach="background" args={["#15332e"]} />
          <fog attach="fog" args={["#15332e", 22, 47]} />
          <ambientLight intensity={0.9} />
          <hemisphereLight intensity={1.6} args={["#dfddc8", "#2b463b"]} />
          <directionalLight
            position={[-5, 12, 9]}
            intensity={3}
            color="#ffe0a5"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <Suspense fallback={null}>
            <group position={[2, -1, 0]} rotation={[0, -0.15, 0]}>
              <LittleHouse />
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.25, 0]}
                receiveShadow
              >
                <circleGeometry args={[16, 80]} />
                <meshStandardMaterial color="#29483b" />
              </mesh>
              <group position={[-0.7, 0, 4.8]} rotation={[0, -0.28, 0]}>
                <Puppy role={0} scale={1.45} />
              </group>
              <group position={[1.25, 0, 5.1]} rotation={[0, 0.15, 0]}>
                <Puppy role={1} scale={1.4} />
              </group>
              <Plant p={[-5, 0, 1]} scale={3.2} />
              <Plant p={[7, 0, 1]} scale={3.4} />
              <Sparkles
                count={45}
                scale={[15, 7, 15]}
                position={[0, 3, 0]}
                size={3}
                color="#e3c685"
                speed={0.3}
              />
              <ContactShadows
                position={[0, -0.18, 0]}
                scale={30}
                opacity={0.4}
                blur={2}
                far={7}
              />
            </group>
          </Suspense>
        </Canvas>
      </div>
      <div className="lobby-shade" />
      <header className="lobby-header">
        <a className="wordmark" href="/" onClick={(e) => e.preventDefault()}>
          <PawPrint size={22} /> mingy’s world
        </a>
        <span className="private-label">
          <LockKeyhole size={13} /> a world for just us
        </span>
      </header>
      <section className="lobby-content">
        <div className="edition">
          <span /> THE HOUSE OF ALMOST HOME
        </div>
        <h1>
          Small paws.
          <br />
          Big mystery.
          <br />
          <em>Just us.</em>
        </h1>
        <p className="lobby-description">
          A curious house. A missing North Star.
          <br />
          And two puppies who are better together.
        </p>
        <div className="choose-label">
          First things first. Which Mingy are you?
        </div>
        <div className="avatar-options">
          {([0, 1] as Role[]).map((r) => (
            <button
              key={r}
              className={`avatar-option ${r === role ? "chosen" : ""} role-${r}`}
              onClick={() => setRole(r)}
              aria-pressed={r === role}
            >
              <span className="avatar-photo">
                {authorized ? (
                  <img
                    src={`/api/photo?id=${r === 0 ? 22 : 0}&thumb=1`}
                    alt={r === 0 ? "Golden boy Mingy" : "Golden girl Mingy"}
                  />
                ) : (
                  <PawPrint />
                )}
              </span>
              <span>
                <strong>{r === 0 ? "Golden boy" : "Golden girl"}</strong>
                <small>
                  {r === 0
                    ? "Mint collar, big heart"
                    : "Rose collar, sharp instincts"}
                </small>
              </span>
              <span className="radio-mark">
                {r === role && <Check size={12} />}
              </span>
            </button>
          ))}
        </div>
        <button
          className="button primary enter-button"
          disabled={!authorized}
          onClick={() => onEnter(role, false)}
        >
          {room ? "Join our adventure" : "Enter our world"}
          <ArrowUpRight size={20} />
        </button>
        {room && (
          <button
            className="text-button fresh-room"
            onClick={() => onEnter(role, true)}
          >
            Start a fresh adventure
          </button>
        )}
        {authError && (
          <p role="alert" className="lobby-error">
            {authError}
          </p>
        )}
        <div className="lobby-meta">
          <span>2 puppies</span>
          <i />
          <span>About an hour</span>
          <i />
          <span>One very good evening</span>
        </div>
      </section>
      <div className="scene-caption">
        <span className="handwritten">meet me where the light’s on.</span>
        <span className="caption-line" />
      </div>
      <footer className="lobby-footer">
        <span>Made for the distance between us.</span>
        <span>
          Keep your call open. We’ll take care of the adventure.{" "}
          <Heart size={13} />
        </span>
      </footer>
    </main>
  );
}
