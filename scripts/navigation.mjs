export function findPath(start, goal, boxes) {
  const radius = 0.32,
    step = 0.35,
    offset = -11.55,
    size = 67;
  const blocked = (x, z) =>
    Math.abs(x) > 11.65 ||
    Math.abs(z) > 10.65 ||
    boxes.some(
      (b) =>
        Math.abs(x - b.x) < b.hx + radius && Math.abs(z - b.z) < b.hz + radius,
    );
  const node = (p) => ({
    x: Math.max(0, Math.min(size - 1, Math.round((p.x - offset) / step))),
    z: Math.max(0, Math.min(size - 1, Math.round((p.z - offset) / step))),
  });
  const point = (n) => ({ x: n.x * step + offset, z: n.z * step + offset });
  const key = (n) => n.x + "," + n.z;
  const first = node(start);
  let end = node(goal);
  if (blocked(point(end).x, point(end).z)) {
    let candidates = [];
    for (let dx = -5; dx <= 5; dx++)
      for (let dz = -5; dz <= 5; dz++) {
        let n = { x: end.x + dx, z: end.z + dz },
          p = point(n);
        if (!blocked(p.x, p.z))
          candidates.push({ n, d: Math.hypot(goal.x - p.x, goal.z - p.z) });
      }
    candidates.sort((a, b) => a.d - b.d);
    if (!candidates.length) throw Error("No free navigation goal");
    end = candidates[0].n;
  }
  const frontier = [first],
    from = new Map(),
    g = new Map([[key(first), 0]]),
    f = new Map([[key(first), 0]]),
    done = new Set();
  let found = false;
  while (frontier.length) {
    let best = 0;
    for (let i = 1; i < frontier.length; i++)
      if (f.get(key(frontier[i])) < f.get(key(frontier[best]))) best = i;
    const current = frontier.splice(best, 1)[0],
      ck = key(current);
    if (ck === key(end)) {
      found = true;
      break;
    }
    done.add(ck);
    for (const dx of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dz) continue;
        const n = { x: current.x + dx, z: current.z + dz },
          nk = key(n),
          p = point(n);
        if (
          n.x < 0 ||
          n.z < 0 ||
          n.x >= size ||
          n.z >= size ||
          done.has(nk) ||
          blocked(p.x, p.z)
        )
          continue;
        if (
          dx &&
          dz &&
          (blocked(point(current).x, p.z) || blocked(p.x, point(current).z))
        )
          continue;
        const score = g.get(ck) + Math.hypot(dx, dz);
        if (score < (g.get(nk) ?? Infinity)) {
          from.set(nk, current);
          g.set(nk, score);
          f.set(nk, score + Math.hypot(end.x - n.x, end.z - n.z));
          if (!frontier.some((q) => key(q) === nk)) frontier.push(n);
        }
      }
  }
  if (!found) throw Error("No traversable route to " + JSON.stringify(goal));
  const path = [point(end)];
  let cur = end;
  while (key(cur) !== key(first)) {
    cur = from.get(key(cur));
    if (!cur) break;
    path.unshift(point(cur));
  }
  path[0] = start;
  if (!blocked(goal.x, goal.z)) path[path.length - 1] = goal;
  const clear = (a, b) => {
    const length = Math.hypot(a.x - b.x, a.z - b.z),
      steps = Math.ceil(length / 0.12);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  };
  const smooth = [path[0]];
  for (let i = 0; i < path.length - 1;) {
    let next = i + 1;
    for (let j = i + 2; j < path.length; j++) {
      if (clear(path[i], path[j])) next = j;
      else break;
    }
    smooth.push(path[next]);
    i = next;
  }
  return smooth.slice(1);
}
