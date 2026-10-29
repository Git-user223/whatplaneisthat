// Regional, approximate river corridors. These are geographic context, not FAA
// procedure geometry, assigned clearances, or a statement of the active flow.
// Source: Metropolitan Washington Airports Authority's typical operations overview.
export const DCA_CORRIDOR_SOURCE =
  "https://www.flyreagan.com/about-airport/aircraft-noise-information/dca-reagan-national-aircraft-procedures";
export type CorridorFlow = "all" | "north" | "south" | "off";
export const DCA_POSITION: [number, number] = [38.8512, -77.0402];
export const DCA_CORRIDORS: {
  id: string;
  name: string;
  points: [number, number][];
  north: string;
  south: string | null;
}[] = [
  {
    id: "potomac-north",
    name: "Potomac north",
    north: "North-flow departures",
    south: "South-flow arrivals",
    points: [
      [38.8512, -77.0402],
      [38.865, -77.045],
      [38.876, -77.05],
      [38.887, -77.061],
      [38.899, -77.063],
      [38.906, -77.073],
      [38.915, -77.09],
      [38.926, -77.108],
      [38.938, -77.124],
      [38.948, -77.135],
      [38.961, -77.147],
      [38.973, -77.164],
      [38.974, -77.183],
      [38.967, -77.199],
      [38.974, -77.225],
    ],
  },
  {
    id: "potomac-south",
    name: "Potomac south",
    north: "North-flow arrivals",
    south: "South-flow departures",
    points: [
      [38.8512, -77.0402],
      [38.837, -77.037],
      [38.821, -77.032],
      [38.805, -77.03],
      [38.792, -77.041],
      [38.773, -77.038],
      [38.754, -77.042],
      [38.735, -77.052],
      [38.719, -77.067],
    ],
  },
  {
    id: "anacostia",
    name: "Anacostia",
    north: "North-flow northeast departures",
    south: null,
    points: [
      [38.8512, -77.0402],
      [38.856, -77.027],
      [38.862, -77.014],
      [38.868, -77.003],
      [38.872, -76.987],
      [38.88, -76.974],
      [38.891, -76.962],
      [38.902, -76.951],
      [38.914, -76.937],
    ],
  },
];
