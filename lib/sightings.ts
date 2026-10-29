export type Observation = {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
};
export type Sighting = {
  id: string;
  viewId: string;
  type: string;
  hex: string;
  flight: string;
  registration: string;
  firstSeen: number;
  lastSeen: number;
  altitude: number | null;
};
export const HISTORY_KEY = "windowwatch-sightings-v1";
// A continuous pass is one sighting; a return after five minutes is a new visit.
export function recordSightings(
  history: Sighting[],
  viewId: string,
  aircraft: Observation[],
  now: number,
): Sighting[] {
  const next = [...history];
  for (const ac of aircraft) {
    const flight = ac.flight?.trim() || "Unknown flight";
    const previous = next.findLastIndex(
      (s) => s.viewId === viewId && s.hex === ac.hex && s.flight === flight,
    );
    const data = {
      type: ac.t?.trim().toUpperCase() || "UNKNOWN",
      registration: ac.r || ac.hex.toUpperCase(),
      lastSeen: now,
      altitude: typeof ac.alt_baro === "number" ? ac.alt_baro : null,
    };
    if (previous >= 0 && now - next[previous].lastSeen <= 300_000)
      next[previous] = { ...next[previous], ...data };
    else
      next.push({
        ...data,
        id: `${viewId}:${ac.hex}:${now}`,
        viewId,
        hex: ac.hex,
        flight,
        firstSeen: now,
      });
  }
  return next;
}
export function readHistory(raw: string | null): Sighting[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? value.filter(
          (s) =>
            s &&
            typeof s.id === "string" &&
            typeof s.viewId === "string" &&
            typeof s.type === "string" &&
            typeof s.hex === "string" &&
            typeof s.flight === "string" &&
            typeof s.registration === "string" &&
            Number.isFinite(s.firstSeen) &&
            Number.isFinite(s.lastSeen),
        )
      : [];
  } catch {
    return [];
  }
}
