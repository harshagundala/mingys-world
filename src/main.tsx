import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import Collection from "./Collection";
const Puppy = lazy(async () => {
  await import("./styles.css");
  return import("./App");
});
const Autumn = lazy(() => import("./autumn/App"));
const path = location.pathname;
if (path === "/last-light") document.title = "The Last Light · Mingy";
else if (path === "/puppies")
  document.title = "Mingy’s World · A mystery for two";
// Retain older direct invitation links, including saved rooms.
const puppy =
  path === "/puppies" ||
  path === "/reset" ||
  (path === "/" && new URLSearchParams(location.hash.slice(1)).has("room"));
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div className="route-loading">Opening your world…</div>}>
    {path === "/last-light" ? <Autumn /> : puppy ? <Puppy /> : <Collection />}
  </Suspense>,
);
