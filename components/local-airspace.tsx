"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Minus, Plus, Plane } from "lucide-react";
import type * as Leaflet from "leaflet";
import {
  bearingTo,
  destinationPoint,
  type Aircraft,
  type Config,
} from "@/lib/airspace";
import {
  DCA_CORRIDORS,
  DCA_CORRIDOR_SOURCE,
  DCA_POSITION,
  type CorridorFlow,
} from "@/lib/dca-corridors";
import { trailSegments, type FlightTrails } from "@/lib/flight-trails";

export function LocalAirspace({
  config,
  aircraft,
  visibleAircraft,
  selectedHex,
  trails,
  onSelect,
}: {
  config: Config;
  aircraft: Aircraft[];
  visibleAircraft: Aircraft[];
  selectedHex?: string;
  trails: FlightTrails;
  onSelect: (aircraft: Aircraft) => void;
}) {
  const node = useRef<HTMLDivElement>(null),
    mapRef = useRef<Leaflet.Map | null>(null),
    LRef = useRef<typeof Leaflet | null>(null),
    contextRef = useRef<Leaflet.LayerGroup | null>(null),
    trafficRef = useRef<Leaflet.LayerGroup | null>(null),
    initialConfig = useRef(config),
    selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false),
    [flow, setFlow] = useState<CorridorFlow>("all"),
    [tileError, setTileError] = useState(false);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let cancelled = false;
    const resize = new ResizeObserver(() =>
      mapRef.current?.invalidateSize({ pan: false }),
    );
    if (node.current) resize.observe(node.current);
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !node.current) return;
      LRef.current = L;
      const map = L.map(node.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
        zoomAnimation: false,
        markerZoomAnimation: false,
        fadeAnimation: false,
      }).setView([initialConfig.current.lat, initialConfig.current.lon], 11);
      mapRef.current = map;
      // Reuse the existing view selector's tile provider and attribution.
      const tiles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map);
      tiles.on("tileerror", () => {
        if (!cancelled) setTileError(true);
      });
      tiles.on("load", () => {
        if (!cancelled) setTileError(false);
      });
      contextRef.current = L.layerGroup().addTo(map);
      trafficRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      resize.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      contextRef.current = null;
      trafficRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map)
      map.setView(
        [config.lat, config.lon],
        Math.max(
          8,
          Math.min(14, Math.round(14 - Math.log2(Math.max(1, config.range)))),
        ),
        { animate: false },
      );
  }, [ready, config.lat, config.lon, config.range]);
  useEffect(() => {
    const L = LRef.current,
      layers = contextRef.current;
    if (!ready || !L || !layers) return;
    layers.clearLayers();
    const cone: [number, number][] = [[config.lat, config.lon]];
    for (let i = 0; i <= 40; i++)
      cone.push(
        destinationPoint(
          config.lat,
          config.lon,
          config.bearing - config.width / 2 + (config.width * i) / 40,
          config.range,
        ),
      );
    L.circle([config.lat, config.lon], {
      radius: config.range * 1852,
      color: "#bfa77e",
      weight: 1,
      opacity: 0.25,
      fill: false,
      dashArray: "3 7",
      interactive: false,
    }).addTo(layers);
    L.polygon(cone, {
      color: "#d4b382",
      weight: 1.4,
      opacity: 0.75,
      fillColor: "#d4b382",
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(layers);
    const observerIcon = L.divIcon({
      className: "observer-map-pin",
      html: '<svg viewBox="0 0 26 34" aria-hidden="true"><path d="M13 32S2 20 2 13a11 11 0 0 1 22 0c0 7-11 19-11 19Z" fill="#d4b382" stroke="#f3dec1" stroke-width="1.2"/><circle cx="13" cy="13" r="4" fill="#252326"/></svg>',
      iconSize: [26, 34],
      iconAnchor: [13, 32],
    });
    L.marker([config.lat, config.lon], {
      icon: observerIcon,
      title: "Your viewpoint",
      alt: "Your configured observer location",
      zIndexOffset: 2000,
    })
      .bindTooltip("Your viewpoint", { className: "airspace-tooltip" })
      .addTo(layers);
    if (flow !== "off") {
      for (const corridor of DCA_CORRIDORS) {
        if (flow === "south" && !corridor.south) continue;
        const label = document.createElement("span");
        label.textContent =
          flow === "north"
            ? corridor.north
            : flow === "south"
              ? corridor.south
              : `${corridor.name} · ${corridor.north}${corridor.south ? ` / ${corridor.south}` : ""}`;
        L.polyline(corridor.points, {
          color: "#90a6b7",
          weight: 2.5,
          opacity: 0.75,
          dashArray: "6 8",
        })
          .bindTooltip(label, { className: "airspace-tooltip", sticky: true })
          .addTo(layers);
        if (flow !== "all") {
          const reverse =
            (flow === "north" && corridor.id === "potomac-south") ||
            (flow === "south" && corridor.id === "potomac-north");
          const points = reverse
            ? [...corridor.points].reverse()
            : corridor.points;
          for (const fraction of [0.35, 0.7]) {
            const i = Math.min(
                points.length - 2,
                Math.floor(points.length * fraction),
              ),
              a = points[i],
              b = points[i + 1],
              angle = bearingTo(a[0], a[1], b[0], b[1]);
            const icon = L.divIcon({
              className: "corridor-arrow",
              html: `<svg viewBox="0 0 16 16" style="transform:rotate(${angle}deg)" aria-hidden="true"><path d="M8 2 13 12 8 9 3 12Z" fill="currentColor"/></svg>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            L.marker(a, { icon, interactive: false }).addTo(layers);
          }
        }
      }
    }
    L.circleMarker(DCA_POSITION, {
      radius: 4,
      color: "#d1d7dc",
      weight: 1.5,
      fillColor: "#171719",
      fillOpacity: 1,
    })
      .bindTooltip("DCA", {
        permanent: true,
        direction: "right",
        className: "dca-map-label",
        offset: [12, 0],
      })
      .addTo(layers);
  }, [ready, config, flow]);
  useEffect(() => {
    const L = LRef.current,
      layers = trafficRef.current;
    if (!ready || !L || !layers) return;
    layers.clearLayers();
    const visible = new Set(visibleAircraft.map((a) => a.hex));
    for (const [hex, points] of Object.entries(trails))
      for (const segment of trailSegments(
        points.filter((point) => point.at >= Date.now() - 600_000),
      ))
        L.polyline(
          segment.map((p) => [p.lat, p.lon] as [number, number]),
          {
            color: hex === selectedHex ? "#e9c489" : "#a9b0b8",
            weight: hex === selectedHex ? 2.5 : 1.3,
            opacity: hex === selectedHex ? 0.95 : 0.4,
            interactive: false,
          },
        ).addTo(layers);
    for (const ac of aircraft) {
      if (!Number.isFinite(ac.lat) || !Number.isFinite(ac.lon)) continue;
      const selected = ac.hex === selectedHex,
        angle = Number.isFinite(ac.track) ? ac.track! : 0;
      const icon = L.divIcon({
        className: `airspace-plane ${selected ? "focused-plane" : visible.has(ac.hex) ? "in-view-plane" : "nearby-plane"}`,
        html: `<svg viewBox="0 0 24 24" style="transform:rotate(${angle}deg)" aria-hidden="true"><path d="M12 2c-.8 0-1.4.8-1.4 2v5.4L3 14v2l7.6-2.1v5L8 21v1l4-1 4 1v-1l-2.6-2.1v-5L21 16v-2l-7.6-4.6V4C13.4 2.8 12.8 2 12 2Z" fill="currentColor" stroke="#121215" stroke-width=".7"/></svg>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const title = ac.flight?.trim() || ac.r || ac.hex.toUpperCase(),
        content = document.createElement("span");
      content.textContent = `${title} · ${ac.t || "Type unknown"} · ${typeof ac.alt_baro === "number" ? `${ac.alt_baro.toLocaleString()} ft` : "Altitude unavailable"}${visible.has(ac.hex) ? " · In your view" : " · Nearby"}`;
      const marker = L.marker([ac.lat!, ac.lon!], {
        icon,
        title,
        alt: `Select ${title}`,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 500,
      })
        .bindTooltip(content, {
          permanent: selected,
          direction: "right",
          offset: [13, 0],
          className: "airspace-tooltip",
        })
        .addTo(layers);
      marker.on("click", () => selectRef.current(ac));
    }
  }, [ready, aircraft, visibleAircraft, selectedHex, trails]);
  return (
    <div className="local-airspace">
      <div
        ref={node}
        className="local-airspace-map"
        role="region"
        aria-label="Live geographic aircraft map with your viewing cone and DCA corridors"
      />
      <div className="airspace-map-toolbar">
        <label>
          <Plane size={13} />
          <select
            aria-label="DCA corridor overlay"
            value={flow}
            onChange={(e) => setFlow(e.target.value as CorridorFlow)}
          >
            <option value="all">DCA corridors</option>
            <option value="north">North flow</option>
            <option value="south">South flow</option>
            <option value="off">Hide corridors</option>
          </select>
        </label>
        <button
          onClick={() =>
            mapRef.current?.setView([config.lat, config.lon], 11, {
              animate: false,
            })
          }
        >
          <Crosshair size={13} /> My view
        </button>
        <button
          onClick={() => {
            const L = LRef.current;
            if (L)
              mapRef.current?.fitBounds(
                L.latLngBounds(DCA_CORRIDORS.flatMap((c) => c.points)),
                { padding: [30, 30], animate: false },
              );
          }}
        >
          DCA
        </button>
      </div>
      <div className="airspace-map-zoom">
        <button
          aria-label="Zoom map in"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus size={16} />
        </button>
        <button
          aria-label="Zoom map out"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus size={16} />
        </button>
      </div>
      <div className="airspace-map-key">
        <span>
          <i />
          Observed trails · last 10 min
        </span>
        {flow !== "off" && (
          <a href={DCA_CORRIDOR_SOURCE} target="_blank" rel="noreferrer">
            <i />
            Typical DCA corridors · approximate ↗
          </a>
        )}
      </div>
      {tileError && (
        <div className="map-tile-error" role="status">
          Map tiles unavailable. Aircraft and overlays still update.
        </div>
      )}
    </div>
  );
}
