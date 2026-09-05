/** The extended mystery keeps existing chapter numbers and saved evidence intact. */
export const dreamRoutes = [
  [20, 15, 16, 11, 12, 7, 8, 3, 4],
  [24, 23, 18, 17, 12, 13, 8, 7, 2, 1, 0],
  [22, 17, 16, 11, 6, 7, 8, 13, 14, 9, 4],
];
export const dreamGlyphs = [
  "MOON",
  "KEY",
  "FERN",
  "BELL",
  "SUN",
  "PAW",
  "TEA",
  "ROSE",
  "COMET",
  "EYE",
  "STAR",
  "WAVE",
  "CROWN",
  "LEAF",
  "DOOR",
  "FISH",
  "CLOCK",
  "BIRD",
  "HEART",
  "LILY",
  "PEARL",
  "WING",
  "BOOK",
  "FLAME",
  "SHELL",
];
export const dreamTile = (i: number) => ({
  x: ((i % 5) - 2) * 1.65,
  z: (Math.floor(i / 5) - 2) * 1.65,
});
export const dreamNavigator = (round: number) => (round === 1 ? 1 : 0);
export const circuitRoute = [
  0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12,
];
export const circuitInitial = [1, 1, 3, 2, 1, 2, 1, 3, 2, 1, 3, 2, 1, 1, 3, 2];
// North, East, South, West. Every segment must join the single unbroken return path.
export const circuitPorts = circuitRoute.reduce(
  (out, cell, index) => {
    const dir = (other: number) =>
      other === cell - 4
        ? 0
        : other === cell + 1
          ? 1
          : other === cell + 4
            ? 2
            : 3;
    out[cell] = [
      index ? dir(circuitRoute[index - 1]) : 3,
      index < circuitRoute.length - 1 ? dir(circuitRoute[index + 1]) : 3,
    ];
    return out;
  },
  {} as Record<number, number[]>,
);
export function circuitSolved(rotations: number[]) {
  if (rotations.length !== 16) return false;
  const visited = new Set<number>();
  let cell = 0,
    entry = 3;
  while (!visited.has(cell)) {
    visited.add(cell);
    const ports = circuitPorts[cell].map((d) => (d + rotations[cell]) % 4);
    if (!ports.includes(entry)) return false;
    const exit = ports.find((d) => d !== entry)!;
    if (cell === 12 && exit === 3) return visited.size === 16;
    if (
      (exit === 0 && cell < 4) ||
      (exit === 1 && cell % 4 === 3) ||
      (exit === 2 && cell >= 12) ||
      (exit === 3 && cell % 4 === 0)
    )
      return false;
    cell += [-4, 1, 4, -1][exit];
    entry = (exit + 2) % 4;
  }
  return false;
}
export const mirrorTargets = [
  [3, 8],
  [10, 1],
  [5, 5],
];
export function advancedObjective(s: any) {
  if (s.chapter === 2 && s.archiveOpen)
    return {
      title: "The rooms between",
      objective: `The music box has opened into an impossible garden. Find its three field notes, then navigate three folded maps together (${Math.min(s.dreamRound || 0, 3)}/3).`,
    };
  if (s.chapter === 4 && s.round >= 3)
    return {
      title: "A beautifully bad idea",
      objective:
        "The Star is a living machine. Work at the two wall panels to reconnect all sixteen copper pipes. Each collar controls half the board.",
    };
  if (s.chapter === 6 && s.skyAligned)
    return {
      title: "Two sides of the same sky",
      objective: `The roof has opened. Use the two mirror pedestals to hold three impossible constellations together (${Math.min(s.mirrorRound || 0, 3)}/3).`,
    };
  return null;
}
export function advancedHints(s: any) {
  if (s.chapter === 2 && s.archiveOpen)
    return [
      "The music box is beside the globe in the library. It leads somewhere much larger on the inside.",
      "One Mingy reads the atlas from its lectern. The other walks the numbered route by matching the named tiles. E commits a tile; walking over it is safe.",
      "Find the three field notes first. The atlas flips between rounds: follow the printed route numbers, not a remembered direction. Roles swap on the second map.",
    ];
  if (s.chapter === 4 && s.round >= 3)
    return [
      "The two circuit panels sit on opposite sides of the workshop. Open one each.",
      "A pipe must touch the matching edge of its neighbour. Trace the copper path from IN to OUT. Every square must be connected.",
      "Start in the upper left. The correct path winds across the top row, back across the second, across the third, and back across the fourth. Each collar turns only its own squares.",
    ];
  if (s.chapter === 6 && s.skyAligned)
    return [
      "Each mirror shows its own target, but turning either dial moves both. Read your targets aloud.",
      "Mint turns move the mint dial by one and rose by two. Rose turns move rose by one and mint by three. Dial positions wrap around twelve.",
      "Choose a number of mint turns, then use rose turns to finish the rose target. If mint is still wrong, try the next number of mint turns. You can always reverse a turn. Both press Hold when aligned.",
    ];
  return null;
}
