import { useState } from "react";
import { PawPrint, ArrowUpRight, Copy, Check, RotateCcw } from "lucide-react";
export function Reset({
  authorized,
  invite,
  error,
}: {
  authorized: boolean;
  invite: string;
  error: string;
}) {
  const [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false);
  const create = () => {
    const room = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    setUrl(
      `${location.origin}/#${new URLSearchParams({ ...(invite ? { invite } : {}), room })}`,
    );
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
          Create an empty adventure for a test run or your date. It starts at
          the beginning, with every clue, puzzle and surprise reset.
        </p>
        <p className="reset-small">
          Your previous adventure stays saved at its original invitation. Both
          Mingys should open the same new link.
        </p>
        {!authorized ? (
          <p role="alert">{error || "Opening your private invitation…"}</p>
        ) : !url ? (
          <button className="button primary wide" onClick={create}>
            Create a fresh adventure <ArrowUpRight size={18} />
          </button>
        ) : (
          <div className="fresh-invitation">
            <p>Your new case is ready. Nothing has been played.</p>
            <label htmlFor="fresh-url">Private invitation</label>
            <input
              id="fresh-url"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
            />
            <div>
              <button
                className="button subtle"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                  } catch {
                    document
                      .querySelector<HTMLInputElement>("#fresh-url")
                      ?.select();
                  }
                }}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="button primary" href={url}>
                Enter our world <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
        )}
      </section>
      <span className="reset-foot">
        Same two Mingys. A brand-new beginning.
      </span>
    </main>
  );
}
