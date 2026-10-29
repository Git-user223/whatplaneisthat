import { haversineNm, type Aircraft } from "./airspace";
export type TrailPoint = { lat: number; lon: number; at: number };
export type FlightTrails = Record<string, TrailPoint[]>;
const KEEP_MS = 10 * 60_000;
export function recordTrails(
  previous: FlightTrails,
  aircraft: Aircraft[],
  now: number,
): FlightTrails {
  const next: FlightTrails = {};
  for (const [hex, points] of Object.entries(previous)) {
    const recent = points.filter((p) => p.at >= now - KEEP_MS);
    if (recent.length) next[hex] = recent;
  }
  for (const ac of aircraft) {
    if (
      !Number.isFinite(ac.lat) ||
      !Number.isFinite(ac.lon) ||
      Math.abs(ac.lat!) > 90 ||
      Math.abs(ac.lon!) > 180
    )
      continue;
    const age = Math.max(0, ac.seen_pos ?? ac.seen ?? 0);
    if (!Number.isFinite(age) || age > 90) continue;
    const point = { lat: ac.lat!, lon: ac.lon!, at: now - age * 1000 },
      points = next[ac.hex] ?? [],
      last = points.at(-1);
    if (last && point.at <= last.at) continue;
    next[ac.hex] =
      last && last.lat === point.lat && last.lon === point.lon
        ? [...points.slice(0, -1), point]
        : [...points, point].slice(-90);
  }
  return next;
}
// Break gaps and implausible position jumps rather than inventing a continuous path.
export function trailSegments(points: TrailPoint[]): TrailPoint[][] {
  const segments: TrailPoint[][] = [];
  let current: TrailPoint[] = [];
  for (const point of points) {
    const last = current.at(-1),
      dt = last ? point.at - last.at : 0;
    if (
      last &&
      (dt <= 0 ||
        dt > 90_000 ||
        haversineNm(last.lat, last.lon, point.lat, point.lon) /
          (dt / 3_600_000) >
          1500)
    ) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
