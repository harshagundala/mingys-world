export type Place = "house" | "loft" | "garden" | "lab" | "observatory";
export type Role = 0 | 1;
export interface Clue {
  id: string;
  title: string;
  place: Place;
  pos: [number, number, number];
  chapter: number;
  kind?: "clue" | "puzzle" | "portal" | "photo" | "ball";
  text?: [string, string];
  target?: Place;
  photo?: number;
}
export const chapters = [
  {
    title: "An invitation for two",
    subtitle: "A house at the end of the world. Two very good detectives.",
    objective:
      "Meet in the entrance hall. Read the letter, then each ring the little brass bell.",
    place: "house",
  },
  {
    title: "The hour that went missing",
    subtitle: "Every clock stopped. One of them remembers why.",
    objective:
      "Search the house for four pieces of the midnight timeline, then inspect the grandfather clock.",
    place: "house",
  },
  {
    title: "The fourth guest",
    subtitle: "Four visitors. Four rooms. One story that doesn’t add up.",
    objective:
      "Explore the upstairs library. Reconstruct the guests’ route at the evidence desk.",
    place: "loft",
  },
  {
    title: "Things that grow in the dark",
    subtitle: "Someone has been watering something rather unusual.",
    objective:
      "Follow the garden’s botanical trail. Open the irrigation cabinet, then stand on the two garden seals.",
    place: "garden",
  },
  {
    title: "A signal through the static",
    subtitle: "Some messages were never meant to travel alone.",
    objective:
      "Explore the hidden workshop. Decode three transmissions together at the signal console.",
    place: "lab",
  },
  {
    title: "When the lights go out",
    subtitle: "The house has one last terrible sense of timing.",
    objective:
      "Start the backup power run at the workshop console. Find your three fuses before the power runs out.",
    place: "lab",
  },
  {
    title: "The sky between us",
    subtitle:
      "The shortest distance between two places is sometimes a constellation.",
    objective:
      "Follow the spiral stair to the observatory. Find five star records and align the sky.",
    place: "observatory",
  },
  {
    title: "Almost home",
    subtitle: "One last lock. Two paws. No place we’d rather be.",
    objective:
      "Return to the entrance hall. Read the house’s last letter and open the heart of the house together.",
    place: "house",
  },
  {
    title: "Home is a who",
    subtitle: "Case closed. Distance, overruled.",
    objective: "Stay a little. This part is yours.",
    place: "house",
  },
];
export const roleNames = ["Mingy · golden boy", "Mingy · golden girl"];
export const roleColors = ["#76cbb9", "#eda6b8"];
export const places: Record<
  Place,
  { name: string; spawn: [number, number, number] }
> = {
  house: { name: "The house", spawn: [0, 1, 8] },
  loft: { name: "The upstairs library", spawn: [0, 1, 7] },
  garden: { name: "The moon garden", spawn: [0, 1, 8] },
  lab: { name: "The hidden workshop", spawn: [0, 1, 8] },
  observatory: { name: "The observatory", spawn: [0, 1, 7] },
};
export const clues: Clue[] = [
  {
    id: "letter",
    title: "A letter addressed to two Mingys",
    place: "house",
    pos: [0, 0.9, 5],
    chapter: 0,
    text: [
      "Dear Mingys,\n\nThe house has lost its North Star: the little thing that makes somewhere feel like home. At midnight, every clock stopped. Four guests were here. Nobody admits to taking it.\n\nYou have been invited because the house requires two detectives who trust each other. Also because the previous detective was a cat and slept through the entire incident.\n\nThere is one rule: compare what you see. Your collars reveal different traces. When you’re ready, each ring the brass bell.\n\n— The Caretaker",
      "Dear Mingys,\n\nThe house has lost its North Star: the little thing that makes somewhere feel like home. At midnight, every clock stopped. Four guests were here. Nobody admits to taking it.\n\nYou have been invited because the house requires two detectives who trust each other. Also because the previous detective was a cat and slept through the entire incident.\n\nThere is one rule: compare what you see. Your collars reveal different traces. When you’re ready, each ring the brass bell.\n\n— The Caretaker",
    ],
  },
  {
    id: "bell",
    title: "The brass arrival bell",
    place: "house",
    pos: [1.1, 0.95, 5],
    chapter: 0,
    kind: "puzzle",
  },
  {
    id: "clock-a",
    title: "The watchmaker’s margin",
    place: "house",
    pos: [-9, 1.15, -7],
    chapter: 1,
    text: [
      "Your mint collar reveals an impression in the paper:\n\n‘I only kept the HOUR when the Star was carried away. It was three hours before midnight. Use the twenty-four-hour clock.’\n\nThe rest is invisible to you.",
      "Your rose collar reveals a note beneath the page:\n\n‘The MINUTE is kept by the kitchen timer. Ignore every clock hand in the house: they all stopped later, at midnight.’\n\nThe rest is invisible to you.",
    ],
  },
  {
    id: "clock-b",
    title: "A cooling cup of tea",
    place: "house",
    pos: [8, 1.2, 3],
    chapter: 1,
    text: [
      "Two cups, both untouched. A neatly written label says:\n\n‘Tea steeped for exactly ten minutes. The timer began on the half hour. The Star left the house just as the timer rang.’\n\nSomething left a little crescent of copper dust beside the saucer.",
      "Your collar picks out the hidden timer setting:\n\n‘Started at :30. Rang ten minutes later. That is the MINUTE you need.’\n\nSomeone has written ‘Please stop putting biscuit crumbs in precision instruments’ underneath.",
    ],
  },
  {
    id: "clock-c",
    title: "The departure slip",
    place: "house",
    pos: [7, 1.2, -7],
    chapter: 1,
    text: [
      "‘The time on the clock’s lock is the DEPARTURE, not the blackout. Hours first. Minutes second. Four digits.’\n\nAt the bottom: ‘The guest ledger is upstairs. Please use the stairs. Last time someone tried the chimney.’",
      "‘The time on the clock’s lock is the DEPARTURE, not the blackout. Hours first. Minutes second. Four digits.’\n\nA tiny arrow points upstairs. A smudge of copper dust points the same way.",
    ],
  },
  {
    id: "clock-d",
    title: "A photograph turned around",
    place: "house",
    pos: [-8, 0.85, 4],
    chapter: 1,
    text: [
      "On the back, in the Caretaker’s handwriting:\n\n‘The North Star is not a jewel. It is a device, and it is behaving strangely. Since it went missing, the house remembers every visit except the feeling of someone arriving.’\n\n‘Do not reset the clock before checking all four traces.’",
      "On the back, in the Caretaker’s handwriting:\n\n‘The North Star is not a jewel. It is a device, and it is behaving strangely. Since it went missing, the house remembers every visit except the feeling of someone arriving.’\n\n‘Do not reset the clock before checking all four traces.’",
    ],
  },
  {
    id: "clock",
    title: "The grandfather clock",
    place: "house",
    pos: [-1.3, 1, -9.4],
    chapter: 1,
    kind: "puzzle",
  },
  {
    id: "stairs",
    title: "Upstairs · the library",
    place: "house",
    pos: [10, 0, -9],
    chapter: 2,
    kind: "portal",
    target: "loft",
  },
  {
    id: "garden-door",
    title: "Outside · the moon garden",
    place: "house",
    pos: [0, 0, -10.2],
    chapter: 3,
    kind: "portal",
    target: "garden",
  },
  {
    id: "loft-return",
    title: "Downstairs · the entrance hall",
    place: "loft",
    pos: [0, 0, 9.4],
    chapter: 0,
    kind: "portal",
    target: "house",
  },
  {
    id: "guest-a",
    title: "The guest book",
    place: "loft",
    pos: [-8, 1.2, 4],
    chapter: 2,
    text: [
      "Four guests visited exactly one room each: Iris, Vale, Pip, and Ada. The rooms were the kitchen, music room, study, and conservatory. They arrived at 20:40, 20:55, 21:10, and 21:25, one guest per time. Nobody shared a room or arrival time.\n\nOnly the conservatory had an outside door open that evening. Whoever visited it carried the Star out.",
      "Four guests visited exactly one room each: Iris, Vale, Pip, and Ada. The rooms were the kitchen, music room, study, and conservatory. They arrived at 20:40, 20:55, 21:10, and 21:25, one guest per time. Nobody shared a room or arrival time.\n\nOnly the conservatory had an outside door open that evening. Whoever visited it carried the Star out.",
    ],
  },
  {
    id: "guest-b",
    title: "The piano tuner’s statement",
    place: "loft",
    pos: [8, 1, 4],
    chapter: 2,
    text: [
      "Mint ink appears: ‘The music-room guest arrived first. Iris arrived exactly fifteen minutes after that guest.’\n\nThe rose writing remains invisible. Ask your partner what they can read.",
      "Rose ink appears: ‘Pip arrived exactly thirty minutes after Iris. Vale arrived after Iris, but before Pip.’\n\nThe mint writing remains invisible. Ask your partner what they can read.",
    ],
  },
  {
    id: "guest-c",
    title: "A misplaced dinner card",
    place: "loft",
    pos: [-8, 1, -4],
    chapter: 2,
    text: [
      "Mint ink: ‘The kitchen guest arrived exactly fifteen minutes before the study guest.’\n\nHe left a review: ‘Excellent chairs. Terrible nightlife. Two stars.’",
      "Rose ink: ‘The conservatory guest arrived before the kitchen guest. Ada was not in the conservatory.’\n\nA fern has written ‘we were’ in the margin.",
    ],
  },
  {
    id: "guest-d",
    title: "Copper on the windowsill",
    place: "loft",
    pos: [8, 1, -4],
    chapter: 2,
    text: [
      "A mechanical feather. Copper at its hinge.\n\nThe Caretaker’s note: ‘The courier was not flying away from the house. It was flying TOWARD the greenhouse. Please determine which guest sent it before assuming a theft.’",
      "A mechanical feather. Copper at its hinge.\n\nThe Caretaker’s note: ‘The courier was not flying away from the house. It was flying TOWARD the greenhouse. Please determine which guest sent it before assuming a theft.’",
    ],
  },
  {
    id: "guest-e",
    title: "A sealed maintenance request",
    place: "loft",
    pos: [0, 1, -8],
    chapter: 2,
    text: [
      "‘The Star keeps confusing being alone with being abandoned. It has begun collecting memories to fill the difference. I have requested a quiet repair.\n\nIf you are investigating this: leave room for a kinder explanation.’\n\nThe signature has been torn off.",
      "‘The Star keeps confusing being alone with being abandoned. It has begun collecting memories to fill the difference. I have requested a quiet repair.\n\nIf you are investigating this: leave room for a kinder explanation.’\n\nThe signature has been torn off.",
    ],
  },
  {
    id: "evidence",
    title: "The evidence desk",
    place: "loft",
    pos: [0, 1, 0],
    chapter: 2,
    kind: "puzzle",
  },
  {
    id: "garden-return",
    title: "Inside · the house",
    place: "garden",
    pos: [0, 0, 10],
    chapter: 0,
    kind: "portal",
    target: "house",
  },
  {
    id: "plant-a",
    title: "The gardener’s arrangement",
    place: "garden",
    pos: [-8, 0.9, 5],
    chapter: 3,
    text: [
      "‘The four irrigation valves must be opened in the order the plants wake. Each plant has a symbol on its brass label.\n\nDawn comes before noon. Dusk comes before night. Nobody has successfully negotiated otherwise.’",
      "‘The four irrigation valves must be opened in the order the plants wake. Each plant has a symbol on its brass label.\n\nDawn comes before noon. Dusk comes before night. Nobody has successfully negotiated otherwise.’",
    ],
  },
  {
    id: "plant-b",
    title: "The sun bed",
    place: "garden",
    pos: [-8, 0.9, -4],
    chapter: 3,
    text: [
      "Your collar translates two labels:\n\n‘Dawn: the FERN wakes first.’\n‘Noon: the ROSE opens to the light.’\n\nYour partner’s collar can read the other bed.",
      "The labels in this bed glow mint. Your partner can read them.\n\nA sign says: ‘Communicating with the gardener is encouraged. Barking at the plants has shown mixed results.’",
    ],
  },
  {
    id: "plant-c",
    title: "The moon bed",
    place: "garden",
    pos: [8, 0.9, -4],
    chapter: 3,
    text: [
      "The labels in this bed glow rose. Your partner can read them.\n\nOne plant is growing around a length of copper wire. Its roots vanish below the house.",
      "Your collar translates two labels:\n\n‘Dusk: the LILY unfolds.’\n‘Night: the IVY takes its turn.’\n\nYour partner’s collar can read the other bed.",
    ],
  },
  {
    id: "plant-d",
    title: "An instruction under the watering can",
    place: "garden",
    pos: [7, 1, 5],
    chapter: 3,
    text: [
      "‘After restoring the water, two gardeners must stand on the mint and rose seals at the same time for three seconds. Either gardener may use either seal.\n\nThe mechanism measures company, not weight. A bag of compost will not fool it again.’",
      "‘After restoring the water, two gardeners must stand on the mint and rose seals at the same time for three seconds. Either gardener may use either seal.\n\nThe mechanism measures company, not weight. A bag of compost will not fool it again.’",
    ],
  },
  {
    id: "valves",
    title: "The irrigation cabinet",
    place: "garden",
    pos: [0, 1, -7],
    chapter: 3,
    kind: "puzzle",
  },
  {
    id: "hatch",
    title: "The hidden stair",
    place: "garden",
    pos: [0, 0, -9.5],
    chapter: 4,
    kind: "portal",
    target: "lab",
  },
  {
    id: "lab-return",
    title: "Upstairs · the garden",
    place: "lab",
    pos: [0, 0, 10],
    chapter: 0,
    kind: "portal",
    target: "garden",
  },
  {
    id: "signal-a",
    title: "The workshop journal",
    place: "lab",
    pos: [-8, 1, 5],
    chapter: 4,
    text: [
      "‘Iris sent the Star here to be repaired. There was no theft. The device has been hoarding perfect moments, convinced that remembering is the same as living.\n\nWe must teach it to send a message without knowing what comes back. Two operators required.’",
      "‘Iris sent the Star here to be repaired. There was no theft. The device has been hoarding perfect moments, convinced that remembering is the same as living.\n\nWe must teach it to send a message without knowing what comes back. Two operators required.’",
    ],
  },
  {
    id: "signal-b",
    title: "The transmitter manual",
    place: "lab",
    pos: [8, 1, 5],
    chapter: 4,
    text: [
      "MINT = TRANSMITTER. You see the sequence of numbers at the console. Read them to your partner, in order.\n\nROSE = RECEIVER. Your partner sees the decoder and presses the corresponding symbols.\n\nThere are three transmissions. Nothing resets if you make a mistake.",
      "MINT = TRANSMITTER. Your partner sees the sequence of numbers at the console.\n\nROSE = RECEIVER. You see the decoder. Translate each number into its symbol, then press them in order.\n\nThere are three transmissions. Nothing resets if you make a mistake.",
    ],
  },
  {
    id: "signal-c",
    title: "A note about the backup power",
    place: "lab",
    pos: [-8, 1, -5],
    chapter: 4,
    text: [
      "‘When the signal returns, the old circuit may trip. Don’t panic.\n\nStart the backup run only when BOTH operators are in the workshop. Three mint fuses belong to the mint collar. Three rose fuses belong to the rose collar. Use E beside each one.\n\nThe sweeping red field pushes you back but cannot hurt you. You can jump over it. If the timer expires, simply try again.’",
      "‘When the signal returns, the old circuit may trip. Don’t panic.\n\nStart the backup run only when BOTH operators are in the workshop. Three mint fuses belong to the mint collar. Three rose fuses belong to the rose collar. Use E beside each one.\n\nThe sweeping red field pushes you back but cannot hurt you. You can jump over it. If the timer expires, simply try again.’",
    ],
  },
  {
    id: "signal",
    title: "The signal console",
    place: "lab",
    pos: [0, 1, -6],
    chapter: 4,
    kind: "puzzle",
  },
  {
    id: "power",
    title: "The backup power console",
    place: "lab",
    pos: [7, 1, -6],
    chapter: 5,
    kind: "puzzle",
  },
  {
    id: "spire",
    title: "The spiral stair · observatory",
    place: "lab",
    pos: [0, 0, -9.5],
    chapter: 6,
    kind: "portal",
    target: "observatory",
  },
  {
    id: "observatory-return",
    title: "Downstairs · workshop",
    place: "observatory",
    pos: [0, 0, 9],
    chapter: 0,
    kind: "portal",
    target: "lab",
  },
  {
    id: "star-a",
    title: "The west window",
    place: "observatory",
    pos: [-8, 1, 4],
    chapter: 6,
    text: [
      "Mint star-chart: ‘The COMET is exactly between the MOON and the SUN. The MOON comes before the COMET.’\n\nFive symbols belong on the orrery, from left to right.",
      "Rose star-chart: ‘The KEY must come last.’\n\nFive symbols belong on the orrery, from left to right.",
    ],
  },
  {
    id: "star-b",
    title: "The east window",
    place: "observatory",
    pos: [8, 1, 4],
    chapter: 6,
    text: [
      "Mint star-chart: ‘The PAW is not at either end.’\n\nSomeone has annotated the chart with a pawprint. It is not academically useful, but it is very good.",
      "Rose star-chart: ‘The PAW is immediately before the KEY. The SUN is somewhere before the PAW.’\n\nSomeone has underlined ‘immediately’ twice.",
    ],
  },
  {
    id: "star-c",
    title: "The astronomer’s definition",
    place: "observatory",
    pos: [-7, 1, -5],
    chapter: 6,
    text: [
      "‘EXACTLY BETWEEN means consecutive neighbours: three adjacent positions, with no other symbol in the gaps.\n\nThe five symbols are MOON, COMET, SUN, PAW, KEY. Each is used once.’",
      "‘EXACTLY BETWEEN means consecutive neighbours: three adjacent positions, with no other symbol in the gaps.\n\nThe five symbols are MOON, COMET, SUN, PAW, KEY. Each is used once.’",
    ],
  },
  {
    id: "star-d",
    title: "A letter never sent",
    place: "observatory",
    pos: [7, 1, -5],
    chapter: 6,
    text: [
      "‘Dear whoever is out there,\n\nI thought that if I held on to every good moment, no one would ever have to miss anyone again. But I have made a house full of yesterday.\n\nDo you think there is a way to be far away and still be close?’\n\n— The North Star",
      "‘Dear whoever is out there,\n\nI thought that if I held on to every good moment, no one would ever have to miss anyone again. But I have made a house full of yesterday.\n\nDo you think there is a way to be far away and still be close?’\n\n— The North Star",
    ],
  },
  {
    id: "star-e",
    title: "The Caretaker’s final field note",
    place: "observatory",
    pos: [0, 1, -8.5],
    chapter: 6,
    text: [
      "‘Aligning the sky will return the Star to the entrance hall.\n\nThe last lock needs no cipher. It needs two separate choices, made together. Everything you have found belongs to both of you.’\n\nP.S. I have hidden five tennis balls around the property. That part is entirely unprofessional.",
      "‘Aligning the sky will return the Star to the entrance hall.\n\nThe last lock needs no cipher. It needs two separate choices, made together. Everything you have found belongs to both of you.’\n\nP.S. I have hidden five tennis balls around the property. That part is entirely unprofessional.",
    ],
  },
  {
    id: "sky",
    title: "The celestial orrery",
    place: "observatory",
    pos: [0, 1, -2],
    chapter: 6,
    kind: "puzzle",
  },
  {
    id: "home-door",
    title: "The house remembers the way home",
    place: "observatory",
    pos: [0, 0, 6],
    chapter: 7,
    kind: "portal",
    target: "house",
  },
  {
    id: "heart",
    title: "The heart of the house",
    place: "house",
    pos: [0, 1, 0],
    chapter: 7,
    kind: "puzzle",
  },
  ...(["house", "loft", "garden", "lab", "observatory"] as Place[]).map(
    (place, i) => ({
      id: `ball-${i}`,
      title: "A suspiciously good tennis ball",
      place,
      pos: [i % 2 === 0 ? -10 : 10, 0.25, i % 2 === 0 ? 8 : -7] as [
        number,
        number,
        number,
      ],
      chapter: 0,
      kind: "ball" as const,
    }),
  ),
  ...(
    [
      { p: "house", x: -10, z: 0, n: 0 },
      { p: "house", x: 10, z: 0, n: 5 },
      { p: "loft", x: -5, z: -8, n: 9 },
      { p: "loft", x: 5, z: -8, n: 13 },
      { p: "garden", x: -5, z: -7, n: 18 },
      { p: "lab", x: 9, z: 0, n: 22 },
      { p: "observatory", x: -5, z: 0, n: 27 },
      { p: "observatory", x: 5, z: 0, n: 29 },
    ] as const
  ).map((a, i) => ({
    id: `photo-${i}`,
    title: "A familiar little memory",
    place: a.p,
    pos: [a.x, 1.3, a.z] as [number, number, number],
    chapter: 0,
    kind: "photo" as const,
    photo: a.n,
  })),
];
export const required: Record<number, string[]> = {
  1: ["clock-a", "clock-b", "clock-c", "clock-d"],
  2: ["guest-a", "guest-b", "guest-c", "guest-d", "guest-e"],
  3: ["plant-a", "plant-b", "plant-c", "plant-d"],
  4: ["signal-a", "signal-b", "signal-c"],
  6: ["star-a", "star-b", "star-c", "star-d", "star-e"],
};
export const hints: Record<number, string[]> = {
  0: [
    "The letter and bell are on the entrance table.",
    "Both of you need to ring the bell once.",
  ],
  1: [
    "Search the study, kitchen, music room, and sitting room. Q makes nearby evidence glow.",
    "One collar reveals the hour; the other reveals the minutes. Compare notes aloud.",
    "Three hours before midnight is 21. Add ten minutes to :30. Put the hour before the minute.",
  ],
  2: [
    "The guest book defines a one-to-one match. Every guest and room is used once.",
    "Read the coloured statements to each other. Start by putting the four arrival times in order.",
    "Music came first at 20:40. Iris arrived at 20:55, Pip at 21:25, and Vale between them. Then use the kitchen/study timing and the conservatory clue.",
  ],
  3: [
    "The flower beds each have labels that only one collar can read.",
    "The order follows a single day: dawn, noon, dusk, night.",
    "Fern, rose, lily, ivy. Then one puppy stands on each glowing seal for three seconds.",
  ],
  4: [
    "Both of you should inspect the signal console. Your screens are different.",
    "The mint collar reads numbers. The rose collar has a number-to-symbol decoder.",
    "Read one number at a time. The receiver presses its matching symbol. The mapping stays the same for all three rounds.",
  ],
  5: [
    "Meet in the workshop before starting. You can plan your route beforehand.",
    "Each collar can collect only its own three fuses. E collects a nearby fuse. Space jumps the red sweep.",
    "If the timer runs out, retry with all your investigation progress intact. Sprint with Shift.",
  ],
  6: [
    "Collect all five star records. The two coloured window notes contain different constraints.",
    "Exactly between means three consecutive positions. Place that group first.",
    "The consecutive group is moon, comet, sun. Paw sits immediately before the last key.",
  ],
  7: [
    "Return to the entrance hall. A new pedestal is waiting at its centre.",
    "Open the heart of the house on both screens, then each hold the button. You need to choose within eight seconds of each other.",
  ],
};
export const signalCodes = [
  [3, 1, 4, 2],
  [2, 4, 1, 3, 2],
  [4, 3, 2, 1, 4, 2],
];
export const decoder: Record<number, string> = {
  1: "moon",
  2: "sun",
  3: "paw",
  4: "star",
};
export const fuses = [
  { id: "f0", role: 0, x: -9, z: 5 },
  { id: "f1", role: 0, x: -8, z: -5 },
  { id: "f2", role: 0, x: 3, z: -8 },
  { id: "f3", role: 1, x: 9, z: 5 },
  { id: "f4", role: 1, x: 8, z: -4 },
  { id: "f5", role: 1, x: -3, z: -8 },
];
