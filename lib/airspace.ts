export type Aircraft = {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  category?: string;
  squawk?: string;
  seen?: number;
  seen_pos?: number;
  dst?: number;
  dir?: number;
};
export type Config = {
  lat: number;
  lon: number;
  bearing: number;
  width: number;
  range: number;
  minAltitude: number;
};
export function normalizeAngle(v: number) {
  return ((((v + 180) % 360) + 360) % 360) - 180;
}
export function haversineNm(a: number, b: number, c: number, d: number) {
  const r = 3440.065,
    p1 = (a * Math.PI) / 180,
    p2 = (c * Math.PI) / 180,
    dp = ((c - a) * Math.PI) / 180,
    dl = ((d - b) * Math.PI) / 180,
    x =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function bearingTo(a: number, b: number, c: number, d: number) {
  const p1 = (a * Math.PI) / 180,
    p2 = (c * Math.PI) / 180,
    dl = ((d - b) * Math.PI) / 180,
    y = Math.sin(dl) * Math.cos(p2),
    x =
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
export function destinationPoint(
  lat: number,
  lon: number,
  bearing: number,
  distanceNm: number,
) {
  const r = 3440.065,
    d = distanceNm / r,
    b = (bearing * Math.PI) / 180,
    p = (lat * Math.PI) / 180,
    l = (lon * Math.PI) / 180,
    p2 = Math.asin(
      Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b),
    ),
    l2 =
      l +
      Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.cos(p),
        Math.cos(d) - Math.sin(p) * Math.sin(p2),
      );
  return [(p2 * 180) / Math.PI, (((l2 * 180) / Math.PI + 540) % 360) - 180] as [
    number,
    number,
  ];
}
