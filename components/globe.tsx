"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
type Coordinate = [number, number];
type Land = {
  features: {
    geometry: { type: string; coordinates: Coordinate[][] | Coordinate[][][] };
  }[];
};
type FlightRoute = {
  from: Coordinate;
  to: Coordinate;
  fromLabel: string;
  toLabel: string;
};
export function Globe({
  lat,
  lon,
  flight,
  route,
}: {
  lat: number;
  lon: number;
  flight?: string;
  route?: FlightRoute;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(
      null,
    );
  const [center, setCenter] = useState({ lat: 23, lon: -55 }),
    [land, setLand] = useState<Land | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/land.geojson", { signal: controller.signal })
      .then((r) => r.json())
      .then((value) => setLand(value as Land))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const node = canvas.current,
      ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const size = 600,
      r = 247,
      mid = 300,
      rad = Math.PI / 180;
    node.width = size * 2;
    node.height = size * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, size, size);
    const project = ([lng, lt]: Coordinate) => {
      const p = lt * rad,
        d = (lng - center.lon) * rad,
        c = center.lat * rad;
      const x = Math.cos(p) * Math.sin(d),
        y = Math.cos(c) * Math.sin(p) - Math.sin(c) * Math.cos(p) * Math.cos(d),
        z = Math.sin(c) * Math.sin(p) + Math.cos(c) * Math.cos(p) * Math.cos(d);
      return { x: mid + r * x, y: mid - r * y, z };
    };
    ctx.beginPath();
    ctx.arc(mid, mid, r, 0, Math.PI * 2);
    ctx.fillStyle = "#151518";
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (land)
      for (const f of land.features) {
        const polygons =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates as Coordinate[][]]
            : (f.geometry.coordinates as Coordinate[][][]);
        for (const polygon of polygons) {
          const ring = polygon[0];
          if (!ring.some((c) => project(c).z > 0)) continue;
          ctx.beginPath();
          ring.forEach((c, i) => {
            const projected = project(c),
              z = projected.z;
            let { x, y } = projected;
            if (z < 0) {
              const d = Math.hypot(x - mid, y - mid);
              x = mid + ((x - mid) / d) * r;
              y = mid + ((y - mid) / d) * r;
            }
            if (!i) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = "#3c3b3e";
          ctx.fill();
          ctx.strokeStyle = "#69666b";
          ctx.lineWidth = 0.65;
          ctx.stroke();
        }
      }
    ctx.strokeStyle = "#aaa8ad22";
    ctx.lineWidth = 0.7;
    const line = (points: Coordinate[]) => {
      ctx.beginPath();
      let pen = false;
      for (const p of points) {
        const q = project(p);
        if (q.z < 0) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
        pen = true;
      }
      ctx.stroke();
    };
    for (let lt = -60; lt <= 60; lt += 20)
      line(Array.from({ length: 181 }, (_, i) => [i * 2 - 180, lt]));
    for (let lng = -180; lng < 180; lng += 20)
      line(Array.from({ length: 91 }, (_, i) => [lng, i * 2 - 90]));
    const labels: { text: string; x: number; y: number; color: string }[] = [];
    if (route) {
      const vector = ([lng, lt]: Coordinate) => [
        Math.cos(lt * rad) * Math.cos(lng * rad),
        Math.cos(lt * rad) * Math.sin(lng * rad),
        Math.sin(lt * rad),
      ];
      const a = vector(route.from),
        b = vector(route.to),
        omega = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              a.reduce((n, v, i) => n + v * b[i], 0),
            ),
          ),
        );
      const points: Coordinate[] = Array.from({ length: 81 }, (_, i) => {
        const t = i / 80,
          sin = Math.sin(omega);
        if (Math.abs(sin) < 1e-6)
          return [
            route.from[0] + (route.to[0] - route.from[0]) * t,
            route.from[1] + (route.to[1] - route.from[1]) * t,
          ];
        const v = a.map(
          (n, j) =>
            (Math.sin((1 - t) * omega) * n + Math.sin(t * omega) * b[j]) / sin,
        );
        return [
          Math.atan2(v[1], v[0]) / rad,
          Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad,
        ];
      });
      ctx.strokeStyle = "#d4b382";
      ctx.lineWidth = 1.2;
      line(points);
      ctx.font = '12px "Public Sans", sans-serif';
      ctx.fillStyle = "#d4b382";
      for (const [coord, label] of [
        [route.from, route.fromLabel],
        [route.to, route.toLabel],
      ] as [Coordinate, string][]) {
        const q = project(coord);
        if (q.z < 0) continue;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
        ctx.fill();
        labels.push({ text: label, x: q.x, y: q.y, color: "#d4b382" });
      }
      if (flight) {
        const q = project(points[40]);
        if (q.z > 0) {
          ctx.fillStyle = "#e1c69f";
          if (
            Math.hypot(
              project(route.from).x - project(route.to).x,
              project(route.from).y - project(route.to).y,
            ) > 100
          )
            labels.push({ text: flight, x: q.x, y: q.y, color: "#e1c69f" });
        }
      }
    }
    const home = project([lon, lat]);
    if (home.z > 0) {
      for (const radius of [7, 16, 26]) {
        ctx.beginPath();
        ctx.arc(home.x, home.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = radius === 7 ? "#d4b382" : "#d4b38245";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(home.x, home.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#d4b382";
      ctx.fill();
      ctx.font = '12px "Public Sans", sans-serif';
      labels.unshift({
        text: "Your window",
        x: home.x,
        y: home.y,
        color: "#d4b382",
      });
    }
    ctx.restore();
    ctx.font = '13px "Public Sans", sans-serif';
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    for (const label of labels) {
      const w = ctx.measureText(label.text).width;
      const candidates = [
        [label.x + 17, label.y - 16],
        [label.x + 17, label.y + 23],
        [label.x - w - 17, label.y - 16],
        [label.x - w - 17, label.y + 23],
        [label.x + 17, label.y - 36],
      ];
      for (const [x, y] of candidates) {
        const rect = { x: x - 4, y: y - 14, w: w + 8, h: 20 };
        if (
          x < 8 ||
          x + w > 592 ||
          y < 16 ||
          y > 584 ||
          occupied.some(
            (b) =>
              rect.x < b.x + b.w &&
              rect.x + rect.w > b.x &&
              rect.y < b.y + b.h &&
              rect.y + rect.h > b.y,
          )
        )
          continue;
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, x, y);
        occupied.push(rect);
        break;
      }
    }
    ctx.beginPath();
    ctx.arc(mid, mid, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#aaa8ad40";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.ellipse(mid, mid, 290, 267, -0.35, 0, Math.PI * 2);
    ctx.strokeStyle = "#aaa8ad22";
    ctx.stroke();
    ctx.setLineDash([]);
  }, [center, land, lat, lon, flight, route]);
  return (
    <div className="globe-wrap">
      <canvas
        ref={canvas}
        className="earth-canvas"
        tabIndex={0}
        role="img"
        aria-label="Interactive globe. Drag or use arrow keys to rotate; use Locate view to center your window."
        onKeyDown={(e) => {
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          )
            return;
          e.preventDefault();
          setCenter((c) => ({
            lon:
              c.lon +
              (e.key === "ArrowLeft" ? -8 : e.key === "ArrowRight" ? 8 : 0),
            lat: Math.max(
              -85,
              Math.min(
                85,
                c.lat +
                  (e.key === "ArrowUp" ? 8 : e.key === "ArrowDown" ? -8 : 0),
              ),
            ),
          }));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ...center };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d)
            setCenter({
              lon: d.lon - (e.clientX - d.x) * 0.35,
              lat: Math.max(-85, Math.min(85, d.lat + (e.clientY - d.y) * 0.3)),
            });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="globe-caption">
        <span>Drag to explore</span>
        <button onClick={() => setCenter({ lat, lon })}>
          <Crosshair size={12} /> Locate view
        </button>
      </div>
    </div>
  );
}
