import { useState } from "react";
import { PawPrint, ArrowUpRight, RotateCcw, LoaderCircle } from "lucide-react";
export function Reset({
  authorized,
  error,
}: {
  authorized: boolean;
  error: string;
}) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [resetError, setResetError] = useState(""),
    [previousRoom, setPreviousRoom] = useState("");
  const create = async () => {
    setBusy(true);
    setResetError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setPreviousRoom(result.previousRoom || "");
      setReady(true);
    } catch (e) {
      setResetError(
        e instanceof Error
          ? e.message
          : "The house couldn’t connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="reset-page">
      <a className="wordmark" href="/">
        <PawPrint size={23} /> mingy’s world
      </a>
      <section className="reset-card">
        <div className="reset-emblem">
          <RotateCcw size={32} />
        </div>
        <span className="edition">A CLEAN LITTLE SLATE</span>
        <h1>
          Fresh paws.
          <br />
          <em>Fresh case.</em>
        </h1>
        <p>
          Start a new shared adventure for a test run or your date. Every clue,
          puzzle and surprise starts at the beginning.
        </p>
        <p className="reset-small">
          Both devices keep using the same address. If your Mingy is already
          here, their game returns to the welcome screen too.
        </p>
        {!authorized ? (
          <p role="alert">{error || "Opening the house…"}</p>
        ) : !ready ? (
          <button
            className="button primary wide"
            onClick={create}
            disabled={busy}
          >
            {busy ? "Preparing your adventure…" : "Start a fresh adventure"}
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ArrowUpRight size={18} />
            )}
          </button>
        ) : (
          <div className="fresh-invitation">
            <p>Your new case is ready. Both Mingys can head straight in.</p>
            <a className="button primary wide" href="/">
              Enter our world <ArrowUpRight size={17} />
            </a>
            {previousRoom && (
              <a
                className="text-button"
                href={`/#${new URLSearchParams({ room: previousRoom })}`}
              >
                Revisit the previous saved adventure
              </a>
            )}
          </div>
        )}
        {resetError && <p role="alert">{resetError}</p>}
      </section>
      <span className="reset-foot">
        Same two Mingys. A brand-new beginning.
      </span>
    </main>
  );
}
