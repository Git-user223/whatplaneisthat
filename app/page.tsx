"use client";

import {
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Globe2,
  Maximize2,
  Radar as RadarIcon,
  ArrowUp,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Compass,
  MapPin,
  Navigation,
  Plane,
  Radio,
  RotateCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Globe } from "@/components/globe";
import { LocalAirspace } from "@/components/local-airspace";
import { AircraftImage } from "@/components/aircraft-image";
import {
  type Aircraft,
  type Config,
  normalizeAngle,
  haversineNm,
  bearingTo,
  destinationPoint,
} from "@/lib/airspace";
import { recordTrails, type FlightTrails } from "@/lib/flight-trails";
import { Logbook } from "@/components/logbook";
import {
  HISTORY_KEY,
  readHistory,
  recordSightings,
  type Sighting,
} from "@/lib/sightings";
import { useCallback, useEffect, useRef, useState } from "react";

type Airport = {
  latitude?: number;
  longitude?: number;
  iata_code?: string;
  icao_code?: string;
  municipality?: string;
  name?: string;
};
type FlightDetails = {
  aircraft?: {
    type?: string;
    icao_type?: string;
    manufacturer?: string;
    registration?: string;
    registered_owner?: string;
    registered_owner_country_name?: string;
    url_photo?: string;
    url_photo_thumbnail?: string;
  } | null;
  route?: {
    airline?: { name?: string; country?: string };
    origin?: Airport;
    destination?: Airport;
  } | null;
};
type SavedView = {
  id: string;
  name: string;
  config: Config;
  updatedAt: number;
};

const DEFAULT_CONFIG: Config = {
  lat: 38.8512,
  lon: -77.0402,
  bearing: 340,
  width: 90,
  range: 12,
  minAltitude: 250,
};
const DEMO: Aircraft[] = [
  {
    hex: "a4c8ee",
    flight: "AAL2134",
    r: "N408AN",
    t: "B738",
    alt_baro: 2875,
    gs: 186,
    track: 164,
    baro_rate: -704,
    category: "A3",
    squawk: "4123",
    seen: 0.2,
  },
  {
    hex: "a31cd2",
    flight: "JBU1247",
    r: "N298JB",
    t: "E190",
    alt_baro: 4200,
    gs: 211,
    track: 348,
    baro_rate: 1280,
    category: "A3",
    squawk: "5261",
    seen: 0.5,
  },
];
const TYPE_NAMES: Record<string, [string, string]> = {
  A319: ["Airbus", "A319"],
  A320: ["Airbus", "A320"],
  A321: ["Airbus", "A321"],
  A20N: ["Airbus", "A320neo"],
  A21N: ["Airbus", "A321neo"],
  B738: ["Boeing", "737-800"],
  B737: ["Boeing", "737"],
  B739: ["Boeing", "737-900"],
  B38M: ["Boeing", "737 MAX 8"],
  B39M: ["Boeing", "737 MAX 9"],
  CRJ7: ["Bombardier", "CRJ-700"],
  CRJ9: ["Bombardier", "CRJ-900"],
  E170: ["Embraer", "E170"],
  E75L: ["Embraer", "E175"],
  E190: ["Embraer", "E190"],
  C172: ["Cessna", "172 Skyhawk"],
  C208: ["Cessna", "208 Caravan"],
  H60: ["Sikorsky", "UH-60 Black Hawk"],
};

function altitude(ac?: Aircraft) {
  return typeof ac?.alt_baro === "number" ? ac.alt_baro : 0;
}
function callsign(v?: string) {
  return v?.trim() || "Unknown flight";
}
function compass(v?: number) {
  if (v == null) return "—";
  const l = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${l[Math.round(v / 45) % 8]} ${Math.round(v)}°`;
}
function climbState(r?: number) {
  if (!r || Math.abs(r) < 160) return { label: "Level", icon: ChevronRight };
  return r > 0
    ? { label: "Climbing", icon: ArrowUp }
    : { label: "Descending", icon: ArrowDown };
}
function relativeTime(date: Date | null, now: number) {
  if (!date) return "Waiting for signal";
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  return s < 2 ? "just now" : `${s}s ago`;
}

function sectorPoints(c: Config) {
  const points: [number, number][] = [[c.lat, c.lon]];
  for (let i = 0; i <= 20; i++)
    points.push(
      destinationPoint(
        c.lat,
        c.lon,
        c.bearing - c.width / 2 + (c.width * i) / 20,
        Math.min(3.2, Math.max(1.6, c.range * 0.28)),
      ),
    );
  return points;
}
function MapPicker({
  value,
  onChange,
  onUseLocation,
}: {
  value: Config;
  onChange: (next: Config) => void;
  onUseLocation: (done?: (next: Config) => void) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null),
    mapRef = useRef<import("leaflet").Map | null>(null),
    valueRef = useRef(value),
    changeRef = useRef(onChange),
    layersRef = useRef<{
      pin: import("leaflet").Marker;
      handle: import("leaflet").Marker;
      cone: import("leaflet").Polygon;
      line: import("leaflet").Polyline;
    } | null>(null);
  useEffect(() => {
    valueRef.current = value;
    changeRef.current = onChange;
  }, [value, onChange]);
  const syncLayers = useCallback((c: Config) => {
    const layers = layersRef.current;
    if (!layers) return;
    const end = destinationPoint(
      c.lat,
      c.lon,
      c.bearing,
      Math.min(3.2, Math.max(1.6, c.range * 0.28)),
    );
    layers.pin.setLatLng([c.lat, c.lon]);
    layers.handle.setLatLng(end);
    layers.cone.setLatLngs(sectorPoints(c));
    layers.line.setLatLngs([[c.lat, c.lon], end]);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapNode.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapNode.current) return;
      const c = valueRef.current,
        map = L.map(mapNode.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([c.lat, c.lon], 13);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const pinIcon = L.divIcon({
          className: "map-pin-icon",
          html: '<div class="map-pin-pulse"></div><div class="map-pin-dot"><span></span></div>',
          iconSize: [42, 48],
          iconAnchor: [21, 39],
        }),
        handleIcon = L.divIcon({
          className: "bearing-handle-icon",
          html: '<div class="bearing-handle"><span>DRAG</span><b>↗</b></div>',
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        }),
        end = destinationPoint(
          c.lat,
          c.lon,
          c.bearing,
          Math.min(3.2, Math.max(1.6, c.range * 0.28)),
        ),
        cone = L.polygon(sectorPoints(c), {
          color: "#ed583b",
          weight: 1.5,
          fillColor: "#ed583b",
          fillOpacity: 0.22,
          interactive: false,
        }).addTo(map),
        line = L.polyline([[c.lat, c.lon], end], {
          color: "#ed583b",
          weight: 2,
          dashArray: "5 6",
          interactive: false,
        }).addTo(map),
        pin = L.marker([c.lat, c.lon], {
          icon: pinIcon,
          draggable: true,
          zIndexOffset: 1000,
        }).addTo(map),
        handle = L.marker(end, {
          icon: handleIcon,
          draggable: true,
          zIndexOffset: 900,
        }).addTo(map);
      layersRef.current = { pin, handle, cone, line };
      pin.on("drag", (e) => {
        const p = (e.target as import("leaflet").Marker).getLatLng(),
          next = {
            ...valueRef.current,
            lat: +p.lat.toFixed(6),
            lon: +p.lng.toFixed(6),
          };
        changeRef.current(next);
        syncLayers(next);
      });
      pin.on("dragend", () => map.panTo(pin.getLatLng()));
      handle.on("drag", (e) => {
        const p = (e.target as import("leaflet").Marker).getLatLng(),
          current = valueRef.current,
          next = {
            ...current,
            bearing: Math.round(
              bearingTo(current.lat, current.lon, p.lat, p.lng),
            ),
          };
        changeRef.current(next);
        syncLayers(next);
      });
      map.on("click", (e) => {
        const next = {
          ...valueRef.current,
          lat: +e.latlng.lat.toFixed(6),
          lon: +e.latlng.lng.toFixed(6),
        };
        changeRef.current(next);
        syncLayers(next);
      });
      setTimeout(() => {
        if (mapRef.current === map) map.invalidateSize();
      }, 50);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [syncLayers]);
  useEffect(() => syncLayers(value), [value, syncLayers]);
  return (
    <div className="map-picker-shell">
      <div ref={mapNode} className="map-picker" />
      <div className="map-help">
        <span>
          <i className="pin-key" />
          Click map or drag pin to move
        </span>
        <span>
          <i className="angle-key" />
          Drag arrow to aim view
        </span>
      </div>
      <button
        className="map-locate"
        onClick={(e) => {
          e.stopPropagation();
          onUseLocation((next) =>
            mapRef.current?.setView([next.lat, next.lon], 14),
          );
        }}
      >
        <MapPin size={15} /> Use my location
      </button>
      <div className="map-bearing">
        <small>WINDOW FACING</small>
        <strong>{compass(value.bearing)}</strong>
        <span>{value.width}° view</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG),
    [draft, setDraft] = useState<Config>(DEFAULT_CONFIG),
    [aircraft, setAircraft] = useState<Aircraft[]>([]),
    [nearby, setNearby] = useState<Aircraft[]>([]),
    [trails, setTrails] = useState<FlightTrails>({}),
    [selected, setSelected] = useState<Aircraft | null>(null),
    [detailsData, setDetails] = useState<
      FlightDetails & { matchedHex?: string }
    >({}),
    [status, setStatus] = useState<"connecting" | "live" | "demo">(
      "connecting",
    ),
    [settingsOpen, setSettingsOpen] = useState(false),
    [lastUpdate, setLastUpdate] = useState<Date | null>(null),
    [clock, setClock] = useState(0),
    [sound, setSound] = useState(false),
    [savedViews, setSavedViews] = useState<SavedView[]>([]),
    [viewName, setViewName] = useState(""),
    [activeViewId, setActiveViewId] = useState<string | null>(null),
    [trackingViewId, setTrackingViewId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"earth" | "sky">("sky"),
    [logbookOpen, setLogbookOpen] = useState(false),
    [mobilePane, setMobilePane] = useState<"sky" | "flight">("sky");
  const [history, setHistory] = useState<Sighting[]>([]),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  const details: FlightDetails =
    detailsData.matchedHex === selected?.hex ? detailsData : {};
  const historyRef = useRef<Sighting[]>([]);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  const seen = useRef(new Set<string>()),
    selectedRef = useRef<string | null>(null),
    audioRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setTrackingViewId(localStorage.getItem("windowwatch-active-view"));
        const s = localStorage.getItem("dca-window-config"),
          views = localStorage.getItem("dca-saved-views");
        if (s) {
          const p = { ...DEFAULT_CONFIG, ...JSON.parse(s) };
          setConfig(p);
          setDraft(p);
        }
        if (views) {
          const v = JSON.parse(views);
          if (Array.isArray(v)) setSavedViews(v);
        }
        const h = readHistory(localStorage.getItem(HISTORY_KEY));
        historyRef.current = h;
        setHistory(h);
      } catch {
        setStorageError(
          "Browser storage is unavailable. Sightings remain in memory; export your logbook before closing.",
        );
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const persistSightings = useCallback(
    (viewId: string, visible: Aircraft[]) => {
      if (!visible.length) return;
      const next = recordSightings(
        historyRef.current,
        viewId,
        visible,
        Date.now(),
      );
      historyRef.current = next;
      setHistory(next);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        setStorageError(
          "The logbook could not be saved to browser storage. Export it to keep a copy.",
        );
      }
    },
    [],
  );
  const currentViewId =
    trackingViewId ||
    savedViews.find((v) => JSON.stringify(v.config) === JSON.stringify(config))
      ?.id ||
    `location:${config.lat},${config.lon},${config.bearing},${config.width},${config.range},${config.minAltitude}`;

  useEffect(() => {
    queueMicrotask(() => setClock(Date.now()));
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const isInView = useCallback((ac: Aircraft, c: Config) => {
    if (ac.lat == null || ac.lon == null) return false;
    return (
      haversineNm(c.lat, c.lon, ac.lat, ac.lon) <= c.range &&
      Math.abs(
        normalizeAngle(bearingTo(c.lat, c.lon, ac.lat, ac.lon) - c.bearing),
      ) <=
        c.width / 2 &&
      altitude(ac) >= c.minAltitude
    );
  }, []);
  const fetchAircraft = useCallback(async () => {
    if (!ready) return;
    const requestViewId = currentViewId;
    const requestConfig = config;
    try {
      const r = await fetch(
        `/api/aircraft?lat=${config.lat}&lon=${config.lon}&range=${Math.max(config.range, 5)}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw 0;
      const d = (await r.json()) as { ac?: Aircraft[] };
      if (configRef.current !== requestConfig) return;
      const near = (d.ac ?? [])
          .filter(
            (a) =>
              a.lat != null &&
              a.lon != null &&
              altitude(a) >= config.minAltitude,
          )
          .sort((a, b) => (a.dst ?? 99) - (b.dst ?? 99)),
        visible = near.filter((a) => isInView(a, config)),
        newcomers = visible.filter((a) => !seen.current.has(a.hex));
      visible.forEach((a) => seen.current.add(a.hex));
      setNearby(near);
      setTrails((previous) => recordTrails(previous, near, Date.now()));
      persistSightings(requestViewId, visible);
      setAircraft(visible);
      const next =
        newcomers[0] ??
        visible.find((a) => a.hex === selectedRef.current) ??
        visible[0] ??
        null;
      if (next && next.hex !== selectedRef.current) {
        selectedRef.current = next.hex;
        setSelected(next);
        if (sound && audioRef.current) {
          const ctx = audioRef.current,
            o = ctx.createOscillator(),
            g = ctx.createGain();
          o.frequency.setValueAtTime(620, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.27);
        }
      } else if (next) setSelected(next);
      else {
        selectedRef.current = null;
        setSelected(null);
      }
      setStatus("live");
      setLastUpdate(new Date());
    } catch {
      if (configRef.current !== requestConfig) return;
      const fallback = DEMO.map((a, i) => ({
        ...a,
        lat: config.lat + 0.02 + i * 0.015,
        lon: config.lon + 0.003 - i * 0.01,
      }));
      setNearby([]);
      setAircraft(fallback);
      selectedRef.current = fallback[0].hex;
      setSelected(fallback[0]);
      setStatus("demo");
      setLastUpdate(new Date());
    }
  }, [config, isInView, sound, ready, currentViewId, persistSightings]);
  useEffect(() => {
    seen.current.clear();
    selectedRef.current = null;
    queueMicrotask(() => {
      setSelected(null);
      void fetchAircraft();
    });
    const id = window.setInterval(fetchAircraft, 10000);
    return () => clearInterval(id);
  }, [fetchAircraft]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false,
      busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      await Promise.allSettled(
        savedViews
          .filter((v) => v.id !== currentViewId)
          .map(async (v) => {
            const c = v.config;
            const r = await fetch(
              `/api/aircraft?lat=${c.lat}&lon=${c.lon}&range=${c.range}`,
              { cache: "no-store" },
            );
            if (!r.ok) return;
            const d = (await r.json()) as { ac?: Aircraft[] };
            if (!cancelled)
              persistSightings(
                v.id,
                (d.ac ?? []).filter((a) => isInView(a, c)),
              );
          }),
      );
      busy = false;
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, savedViews, currentViewId, isInView, persistSightings]);
  const selectedHex = selected?.hex,
    selectedFlight = selected?.flight,
    selectedRegistration = selected?.r;
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (!c.signal.aborted) setDetails({});
    });
    if (selectedHex)
      fetch(
        `/api/details?callsign=${encodeURIComponent(callsign(selectedFlight))}&registration=${encodeURIComponent(selectedRegistration ?? "")}`,
        { signal: c.signal },
      )
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((value) => {
          if (!c.signal.aborted)
            setDetails({
              ...(value as FlightDetails),
              matchedHex: selectedHex,
            });
        })
        .catch(() => {
          if (!c.signal.aborted) setDetails({});
        });
    return () => c.abort();
  }, [selectedHex, selectedFlight, selectedRegistration]);

  const select = (a: Aircraft) => {
      selectedRef.current = a.hex;
      setSelected(a);
    },
    known = selected?.t ? TYPE_NAMES[selected.t] : undefined,
    manufacturer = details.aircraft?.manufacturer || known?.[0] || "Aircraft",
    model =
      details.aircraft?.type || known?.[1] || selected?.t || "Model unknown",
    motion = climbState(selected?.baro_rate),
    MotionIcon = motion.icon,
    origin = details.route?.origin,
    destination = details.route?.destination;
  const save = () => {
    const s = {
      ...draft,
      range: Math.max(1, Math.min(50, draft.range)),
      width: Math.max(10, Math.min(180, draft.width)),
    };
    setConfig(s);
    setTrackingViewId(activeViewId);
    if (activeViewId)
      localStorage.setItem("windowwatch-active-view", activeViewId);
    else localStorage.removeItem("windowwatch-active-view");
    localStorage.setItem("dca-window-config", JSON.stringify(s));
    setSettingsOpen(false);
  };
  const storeViews = (next: SavedView[]) => {
    setSavedViews(next);
    localStorage.setItem("dca-saved-views", JSON.stringify(next));
  };
  const saveNamedView = () => {
    const name = viewName.trim() || `Window view ${savedViews.length + 1}`,
      existing = savedViews.find((v) => v.id === activeViewId);
    if (existing) {
      storeViews(
        savedViews.map((v) =>
          v.id === existing.id
            ? { ...v, name, config: { ...draft }, updatedAt: Date.now() }
            : v,
        ),
      );
    } else {
      const item = {
        id: crypto.randomUUID(),
        name,
        config: { ...draft },
        updatedAt: Date.now(),
      };
      if (
        currentViewId.startsWith("location:") &&
        JSON.stringify(draft) === JSON.stringify(config)
      ) {
        const next = historyRef.current.map((s) =>
          s.viewId === currentViewId ? { ...s, viewId: item.id } : s,
        );
        historyRef.current = next;
        setHistory(next);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          setStorageError(
            "Could not save logbook. Export a copy before closing.",
          );
        }
      }
      if (JSON.stringify(draft) === JSON.stringify(config)) {
        setTrackingViewId(item.id);
        localStorage.setItem("windowwatch-active-view", item.id);
      }
      storeViews([...savedViews, item]);
      setActiveViewId(item.id);
    }
    setViewName(name);
  };
  const loadSavedView = (view: SavedView) => {
    setDraft({ ...view.config });
    setViewName(view.name);
    setActiveViewId(view.id);
  };
  const deleteSavedView = (id: string) => {
    storeViews(savedViews.filter((v) => v.id !== id));
    if (trackingViewId === id) {
      setTrackingViewId(null);
      localStorage.removeItem("windowwatch-active-view");
    }
    if (activeViewId === id) {
      setActiveViewId(null);
      setViewName("");
    }
  };
  const useLocation = (done?: (next: Config) => void) =>
    navigator.geolocation?.getCurrentPosition(({ coords }) =>
      setDraft((d) => {
        const next = {
          ...d,
          lat: +coords.latitude.toFixed(6),
          lon: +coords.longitude.toFixed(6),
        };
        done?.(next);
        return next;
      }),
    );
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setLogbookOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!settingsOpen && !logbookOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      '.modal-backdrop [role="dialog"]',
    );
    if (!dialog) return;
    const elements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
    elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = elements(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [settingsOpen, logbookOpen]);
  const viewLabel =
    savedViews.find((v) => v.id === currentViewId)?.name || "Current window";
  const viewHistory = history.filter((s) => s.viewId === currentViewId);
  const typeCount = new Set(viewHistory.map((s) => s.type)).size;
  const recentPasses = [...viewHistory]
    .sort((a, b) => b.firstSeen - a.firstSeen)
    .slice(0, 4);
  const openViews = () => {
    setDraft(config);
    const v = savedViews.find((v) => v.id === currentViewId);
    setActiveViewId(v?.id ?? null);
    setViewName(v?.name ?? "");
    setSettingsOpen(true);
  };
  const switchView = (id: string) => {
    const v = savedViews.find((v) => v.id === id);
    if (!v) return;
    setConfig({ ...v.config });
    setTrackingViewId(v.id);
    localStorage.setItem("dca-window-config", JSON.stringify(v.config));
    localStorage.setItem("windowwatch-active-view", v.id);
  };
  return (
    <main className={`ambient-app mobile-${mobilePane}`} data-theme="dark">
      <nav className="instrument-rail" aria-label="Dashboard navigation">
        <div className="window-mark" title="whatplaneisthat?">
          <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="22"
              height="22"
              rx="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M3 14h22M14 3v22M7 19l14-11-9 14 1-8-6 5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="#171719"
            />
          </svg>
        </div>
        <button
          className={mapMode === "earth" ? "rail-active" : ""}
          onClick={() => setMapMode("earth")}
          aria-label="Earth view"
          title="Earth view"
        >
          <Globe2 size={19} />
        </button>
        <button
          className={mapMode === "sky" ? "rail-active" : ""}
          onClick={() => setMapMode("sky")}
          aria-label="Local sky"
          title="Local sky"
        >
          <RadarIcon size={19} />
        </button>
        <button
          onClick={() => setLogbookOpen(true)}
          aria-label="Open logbook"
          title="Aircraft logbook"
        >
          <BookOpen size={18} />
        </button>
        <div className="rail-bottom">
          <button
            className={sound ? "rail-active" : ""}
            aria-label="Toggle aircraft alerts"
            title={sound ? "Mute aircraft alerts" : "Enable aircraft alerts"}
            onClick={() => {
              const next = !sound;
              if (next && !audioRef.current)
                audioRef.current = new AudioContext();
              audioRef.current?.resume();
              setSound(next);
            }}
          >
            <Radio size={18} />
          </button>
          <button
            onClick={openViews}
            aria-label="Views"
            title="Configure views"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </nav>
      <header className="ambient-header">
        <div className="product-name">
          <strong>
            whatplaneisthat<span>?</span>
          </strong>
          <span>A sky worth watching</span>
        </div>
        <div className="view-switcher">
          <MapPin size={14} />
          <select
            aria-label="Active viewpoint"
            value={currentViewId}
            onChange={(e) => switchView(e.target.value)}
          >
            {!savedViews.some((v) => v.id === currentViewId) && (
              <option value={currentViewId}>Current window</option>
            )}
            {savedViews.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </div>
        <div className="ambient-time">
          <span>
            {clock
              ? new Date(clock).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "--:--"}
          </span>
          <small>
            {clock
              ? new Date(clock).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : "Local time"}
          </small>
        </div>
        <button
          className="fullscreen-control"
          aria-label="Toggle fullscreen"
          title="Fullscreen display"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else
              void document.documentElement.requestFullscreen().catch(() => {});
          }}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="mobile-view-settings"
          aria-label="Views"
          onClick={openViews}
        >
          <Settings2 size={17} />
        </button>
      </header>
      <div className="mobile-tabs">
        <button
          className={mobilePane === "sky" ? "selected-tab" : ""}
          onClick={() => setMobilePane("sky")}
        >
          Airspace
        </button>
        <button
          className={mobilePane === "flight" ? "selected-tab" : ""}
          onClick={() => setMobilePane("flight")}
        >
          Aircraft{aircraft.length ? ` · ${aircraft.length}` : ""}
        </button>
        <button onClick={() => setLogbookOpen(true)}>Logbook</button>
      </div>
      <section className="geography-pane" aria-label="Airspace observation">
        <div className="stage-heading">
          <div>
            <h1>Your airspace</h1>
            <p>
              {aircraft.length === 0
                ? "Watching for the next arrival"
                : `${aircraft.length} aircraft ${aircraft.length === 1 ? "is" : "are"} passing your window`}
            </p>
          </div>
          <div className="stage-tabs" aria-label="Airspace display">
            <button
              className={mapMode === "earth" ? "selected-tab" : ""}
              onClick={() => setMapMode("earth")}
            >
              Earth
            </button>
            <button
              className={mapMode === "sky" ? "selected-tab" : ""}
              onClick={() => setMapMode("sky")}
            >
              Local sky
            </button>
          </div>
        </div>
        <div
          className={`observation-stage ${mapMode === "sky" ? "show-local" : ""}`}
        >
          {mapMode === "earth" ? (
            <Globe
              lat={config.lat}
              lon={config.lon}
              flight={status === "live" ? selected?.flight?.trim() : undefined}
              route={
                status === "live" &&
                typeof origin?.latitude === "number" &&
                typeof origin.longitude === "number" &&
                typeof destination?.latitude === "number" &&
                typeof destination.longitude === "number"
                  ? {
                      from: [origin.longitude, origin.latitude],
                      to: [destination.longitude, destination.latitude],
                      fromLabel:
                        origin.iata_code || origin.icao_code || "Origin",
                      toLabel:
                        destination.iata_code ||
                        destination.icao_code ||
                        "Destination",
                    }
                  : undefined
              }
            />
          ) : (
            <LocalAirspace
              config={config}
              aircraft={status === "live" ? nearby : []}
              visibleAircraft={aircraft}
              selectedHex={selected?.hex}
              trails={trails}
              onSelect={select}
            />
          )}
          <div
            className={`geo-coordinate ${mapMode === "sky" ? "map-hidden-overlay" : ""}`}
          >
            <span>
              {Math.abs(config.lat).toFixed(4)}°{config.lat >= 0 ? "N" : "S"}
              <br />
              {Math.abs(config.lon).toFixed(4)}°{config.lon >= 0 ? "E" : "W"}
            </span>
            <small>Observer position</small>
          </div>
          <div
            className={`view-direction ${mapMode === "sky" ? "map-hidden-overlay" : ""}`}
          >
            <Compass size={15} />
            <span>
              {compass(config.bearing)}
              <small>{config.range} nm range</small>
            </span>
          </div>
        </div>
        <div className="stage-footnote">
          <span>
            <i
              className={
                status === "live" ? "signal-dot" : "signal-dot offline"
              }
            />
            {status === "live"
              ? "Live ADS-B"
              : status === "demo"
                ? "Demo preview · feed unavailable"
                : "Acquiring signal"}
          </span>
          <button aria-label="Refresh aircraft" onClick={fetchAircraft}>
            <RotateCw size={12} />
            <span>Updated {relativeTime(lastUpdate, clock)}</span>
          </button>
          <span className="map-scale">
            {mapMode === "earth"
              ? "Orthographic projection"
              : "Distances in nautical miles"}
          </span>
        </div>
      </section>
      <aside className="flight-pane" aria-label="Selected aircraft">
        <div className="flight-heading">
          <span>{selected ? "In focus" : "Standing by"}</span>
          <span className="focus-status">
            <i />
            {status === "demo"
              ? "Demo"
              : status === "live"
                ? "Live"
                : "Connecting"}
          </span>
        </div>
        {selected ? (
          <>
            <div className="flight-identity" key={selected.hex}>
              <div>
                <h2>{callsign(selected.flight)}</h2>
                <p>
                  {details.route?.airline?.name ||
                    details.aircraft?.registered_owner ||
                    selected.r ||
                    "Unidentified operator"}
                </p>
              </div>
              <span>
                {selected.t || details.aircraft?.icao_type || "Type pending"}
              </span>
            </div>
            <div className="aircraft-display">
              <AircraftImage
                key={`${selected.hex}:${selected.r || ""}`}
                registration={selected.r}
                type={selected.t || details.aircraft?.icao_type}
                exactPhoto={details.aircraft?.url_photo}
                exactThumbnail={details.aircraft?.url_photo_thumbnail}
                model={`${manufacturer} ${model}`}
              />
              <div className="aircraft-caption">
                <strong>
                  {manufacturer} {model}
                </strong>
                <span>{selected.r || selected.hex.toUpperCase()}</span>
              </div>
            </div>
            <div className="flight-route">
              <div>
                <span>{origin?.iata_code || origin?.icao_code || "—"}</span>
                <small>{origin?.municipality || "Origin unavailable"}</small>
              </div>
              <div className="route-track">
                <span />
                <Plane size={15} />
                <span />
              </div>
              <div>
                <span>
                  {destination?.iata_code || destination?.icao_code || "—"}
                </span>
                <small>
                  {destination?.municipality || "Destination unavailable"}
                </small>
              </div>
            </div>
            <div className="telemetry">
              <div>
                <span>Altitude</span>
                <strong>
                  {typeof selected.alt_baro === "number"
                    ? selected.alt_baro.toLocaleString()
                    : "—"}
                  <small> ft</small>
                </strong>
              </div>
              <div>
                <span>Ground speed</span>
                <strong>
                  {selected.gs != null ? Math.round(selected.gs) : "—"}
                  <small> kt</small>
                </strong>
              </div>
              <div>
                <span>Distance</span>
                <strong>
                  {selected.lat != null && selected.lon != null
                    ? haversineNm(
                        config.lat,
                        config.lon,
                        selected.lat,
                        selected.lon,
                      ).toFixed(1)
                    : "—"}
                  <small> nm</small>
                </strong>
              </div>
              <div>
                <span>Vertical rate</span>
                <strong>
                  {selected.baro_rate != null
                    ? `${selected.baro_rate > 0 ? "+" : ""}${selected.baro_rate.toLocaleString()}`
                    : "—"}
                  <small> ft/min</small>
                </strong>
              </div>
            </div>
            <div className="flight-meta">
              <span>
                <Navigation size={13} /> {compass(selected.track)}
              </span>
              <span>
                <MotionIcon size={13} /> {motion.label}
              </span>
            </div>
          </>
        ) : (
          <div className="standby-aircraft">
            <Plane
              className="standby-plane"
              size={80}
              strokeWidth={1.25}
              aria-hidden="true"
            />
            <h2>The sky is yours.</h2>
            <p>
              The next aircraft to enter this view will appear here
              automatically.
            </p>
            <button onClick={openViews}>
              Adjust viewpoint <ChevronRight size={13} />
            </button>
          </div>
        )}
        <div className="traffic-panel">
          <div className="panel-heading">
            <h3>Passing through</h3>
            <span>{aircraft.length} in view</span>
          </div>
          <div className="traffic-list">
            {aircraft.length ? (
              aircraft.slice(0, 4).map((ac) => (
                <button
                  key={ac.hex}
                  className={selected?.hex === ac.hex ? "selected-traffic" : ""}
                  onClick={() => select(ac)}
                >
                  <Plane size={14} />
                  <span>
                    <strong>{callsign(ac.flight)}</strong>
                    <small>
                      {ac.t || "Type pending"} · {ac.r || ac.hex.toUpperCase()}
                    </small>
                  </span>
                  <span className="traffic-alt">
                    {altitude(ac).toLocaleString()}
                    <small>ft</small>
                  </span>
                </button>
              ))
            ) : (
              <p className="traffic-empty">No aircraft in this viewing cone.</p>
            )}
          </div>
        </div>
        {storageError && (
          <p className="inline-storage-warning" role="alert">
            {storageError}
          </p>
        )}
      </aside>
      <section className="recent-pane" aria-label="Recent sightings">
        <div className="recent-heading">
          <div>
            <h3>Seen from this window</h3>
            <span>
              {typeCount} aircraft {typeCount === 1 ? "type" : "types"} ·{" "}
              {viewHistory.length}{" "}
              {viewHistory.length === 1 ? "pass" : "passes"} recorded
            </span>
          </div>
          <button onClick={() => setLogbookOpen(true)}>
            Open logbook <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="recent-sightings">
          {recentPasses.length ? (
            recentPasses.map((s) => (
              <button key={s.id} onClick={() => setLogbookOpen(true)}>
                <span className="recent-type">
                  {s.type === "UNKNOWN" ? "—" : s.type}
                </span>
                <span>
                  <strong>{TYPE_NAMES[s.type]?.join(" ") || s.type}</strong>
                  <small>
                    {s.flight} · {s.registration}
                  </small>
                </span>
                <time dateTime={new Date(s.firstSeen).toISOString()}>
                  {new Date(s.firstSeen).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </time>
              </button>
            ))
          ) : (
            <div className="recent-empty">
              <BookOpen size={19} />
              <span>
                Your collection starts with the next live aircraft.
                <small>
                  First sightings and returning flights are saved automatically.
                </small>
              </span>
            </div>
          )}
        </div>
      </section>
      <footer className="ambient-footer">
        <span>
          <i
            className={status === "live" ? "signal-dot" : "signal-dot offline"}
          />{" "}
          {status === "live"
            ? "Listening to your sky"
            : status === "demo"
              ? "Demo aircraft · no sightings recorded"
              : "Connecting to ADS-B"}
        </span>
        <span>
          {viewLabel} <span className="footer-separator">/</span> {config.width}
          ° field of view
        </span>
        <span className="data-attribution">
          <a href="https://www.adsb.lol/" target="_blank" rel="noreferrer">
            adsb.lol
          </a>
          <span>·</span>
          <a href="https://www.adsbdb.com/" target="_blank" rel="noreferrer">
            ADSBDB
          </a>
          <span>·</span>
          <a
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
          </a>
        </span>
      </footer>
      {logbookOpen && (
        <div
          className="modal-backdrop logbook-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLogbookOpen(false);
          }}
        >
          <section
            className="logbook-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Aircraft logbook"
          >
            <button
              className="close-logbook"
              onClick={() => setLogbookOpen(false)}
              aria-label="Close logbook"
            >
              <X size={18} />
            </button>
            <Logbook
              history={history}
              views={[
                { id: currentViewId, name: viewLabel },
                ...savedViews.filter((v) => v.id !== currentViewId),
              ]}
              names={TYPE_NAMES}
              storageError={storageError}
            />
          </section>
        </div>
      )}
      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="settings-modal map-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-header">
              <div>
                <span>VIEW CALIBRATION</span>
                <h2 id="settings-title">Place your window view</h2>
                <p>
                  Put the pin at your window, then aim the orange viewing cone
                  toward the sky you can see.
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X />
              </button>
            </div>
            {savedViews.length > 0 && (
              <div className="saved-views">
                <div className="saved-views-title">
                  <Bookmark size={14} />
                  <span>SAVED VIEWS</span>
                </div>
                <div className="saved-view-list">
                  {savedViews.map((view) => (
                    <div
                      key={view.id}
                      className={activeViewId === view.id ? "active" : ""}
                    >
                      <button
                        className="saved-view-load"
                        onClick={() => loadSavedView(view)}
                      >
                        <strong>{view.name}</strong>
                        <span>
                          {compass(view.config.bearing)} · {view.config.width}°
                          · {view.config.range} NM
                        </span>
                      </button>
                      <button
                        className="saved-view-delete"
                        onClick={() => deleteSavedView(view.id)}
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <MapPicker
              value={draft}
              onChange={setDraft}
              onUseLocation={useLocation}
            />
            <div className="control-grid">
              <label>
                VIEW WIDTH
                <span>
                  <input
                    type="number"
                    min="10"
                    max="180"
                    value={draft.width}
                    onChange={(e) =>
                      setDraft({ ...draft, width: +e.target.value })
                    }
                  />{" "}
                  degrees
                </span>
              </label>
              <label>
                VISIBLE RANGE
                <span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={draft.range}
                    onChange={(e) =>
                      setDraft({ ...draft, range: +e.target.value })
                    }
                  />{" "}
                  nautical miles
                </span>
              </label>
              <label>
                MINIMUM ALTITUDE
                <span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={draft.minAltitude}
                    onChange={(e) =>
                      setDraft({ ...draft, minAltitude: +e.target.value })
                    }
                  />{" "}
                  feet
                </span>
              </label>
            </div>
            <div className="save-view-row">
              <div>
                <label htmlFor="view-name">NAME THIS VIEW</label>
                <input
                  id="view-name"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g. Living room window"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNamedView();
                  }}
                />
              </div>
              <button onClick={saveNamedView}>
                <Save size={15} />
                {activeViewId ? "Update saved view" : "Save as a view"}
              </button>
            </div>
            <div className="modal-tip">
              <Navigation size={18} />
              <p>
                <strong>How to aim:</strong> drag the orange arrow until the
                cone points out through your window. Widen the view if you can
                see a broad stretch of sky.
              </p>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setDraft(DEFAULT_CONFIG);
                  setActiveViewId(null);
                  setViewName("");
                }}
              >
                Reset to DCA
              </button>
              <button className="primary" onClick={save}>
                Use this view
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
