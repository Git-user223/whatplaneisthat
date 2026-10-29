"use client";
import { useState } from "react";
import { ArrowDownToLine, BookOpen, ChevronDown, Search } from "lucide-react";
import { AircraftImage } from "@/components/aircraft-image";
import { SightingPhoto } from "@/components/sighting-photo";
import type { Sighting } from "@/lib/sightings";
type View = { id: string; name: string };
const stamp = (n: number) =>
  new Date(n).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function Logbook({
  history,
  views,
  names,
  storageError,
}: {
  history: Sighting[];
  views: View[];
  names: Record<string, [string, string]>;
  storageError: string;
}) {
  const [view, setView] = useState("all"),
    [query, setQuery] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  const filtered = history.filter(
    (s) =>
      (view === "all" || s.viewId === view) &&
      `${s.type} ${names[s.type]?.join(" ") || ""} ${s.flight} ${s.registration}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups = [...new Set(filtered.map((s) => s.type))]
    .map((type) => {
      const sightings = filtered
        .filter((s) => s.type === type)
        .sort((a, b) => b.firstSeen - a.firstSeen);
      return {
        type,
        sightings,
        first: Math.min(...sightings.map((s) => s.firstSeen)),
        last: Math.max(...sightings.map((s) => s.lastSeen)),
      };
    })
    .sort((a, b) => b.last - a.last);
  const viewName = (id: string) =>
    views.find((v) => v.id === id)?.name || "Archived view";
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatplaneisthat-logbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="logbook" id="logbook">
      <div className="logbook-heading">
        <div>
          <h2>Aircraft logbook</h2>
          <p>A field guide to the aircraft that have crossed your window.</p>
        </div>
        <button
          className="export-button"
          onClick={exportHistory}
          disabled={!filtered.length}
        >
          <ArrowDownToLine size={15} /> Export logbook
        </button>
      </div>
      <div className="collection-stats">
        <div>
          <strong>{new Set(history.map((s) => s.type)).size.toString()}</strong>
          <span>Aircraft types</span>
        </div>
        <div>
          <strong>{history.length.toString()}</strong>
          <span>Recorded passes</span>
        </div>
        <div>
          <strong>
            {new Set(history.map((s) => s.viewId)).size.toString()}
          </strong>
          <span>Views with sightings</span>
        </div>
        <p>
          <i /> Auto-recording live sightings
          <br />
          <small>Saved in this browser · All saved views monitored</small>
        </p>
      </div>
      {storageError && (
        <p role="alert" className="storage-error">
          {storageError}
        </p>
      )}
      <div className="logbook-controls">
        <label>
          <BookOpen size={15} />
          <select
            aria-label="Filter history by view"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="all">All views</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            {[...new Set(history.map((s) => s.viewId))]
              .filter((id) => !views.some((v) => v.id === id))
              .map((id) => (
                <option key={id} value={id}>
                  Archived view · {id.slice(-8)}
                </option>
              ))}
          </select>
        </label>
        <label className="history-search">
          <Search size={15} />
          <input
            placeholder="Search type, flight or registration…"
            aria-label="Search sightings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span>
          {groups.length} types / {filtered.length} passes
        </span>
      </div>
      {groups.length ? (
        <div className="collection-table">
          <div className="collection-row collection-table-head">
            <span>Aircraft / ICAO type</span>
            <span>First seen</span>
            <span>Last seen</span>
            <span>Passes</span>
            <span />
          </div>
          {groups.map((g) => (
            <div className="type-entry" key={g.type}>
              <button
                className="collection-row"
                onClick={() => setExpanded(expanded === g.type ? null : g.type)}
                aria-expanded={expanded === g.type}
              >
                <span className="type-title">
                  <AircraftImage
                    variant="thumbnail"
                    type={g.type}
                    model={names[g.type]?.join(" ") || g.type}
                    priority={false}
                  />
                  <span>
                    <strong>
                      {names[g.type]?.join(" ") ||
                        (g.type === "UNKNOWN" ? "Unidentified type" : g.type)}
                    </strong>
                    <small>
                      {g.type}{" "}
                      <em>
                        · {new Set(g.sightings.map((s) => s.hex)).size}{" "}
                        individual aircraft
                      </em>
                    </small>
                  </span>
                </span>
                <span>{stamp(g.first)}</span>
                <span>{stamp(g.last)}</span>
                <span className="pass-count">{g.sightings.length}</span>
                <ChevronDown
                  size={16}
                  style={{
                    transform:
                      expanded === g.type ? "rotate(180deg)" : undefined,
                  }}
                />
              </button>
              {expanded === g.type && (
                <div className="sighting-list">
                  {g.sightings.map((s) => (
                    <div className="sighting-row" key={s.id}>
                      <SightingPhoto
                        key={`${s.registration}:${s.type}`}
                        registration={
                          s.registration === s.hex.toUpperCase()
                            ? undefined
                            : s.registration
                        }
                        type={s.type}
                        model={names[s.type]?.join(" ") || s.type}
                      />
                      <div className="sighting-description">
                        <span>
                          <strong>{s.flight}</strong>
                          <small>
                            {s.registration} · {viewName(s.viewId)}
                          </small>
                        </span>
                        <span>
                          {stamp(s.firstSeen)}
                          <small>
                            Last signal {stamp(s.lastSeen)}
                            {s.altitude != null
                              ? ` · ${s.altitude.toLocaleString()} ft`
                              : ""}
                          </small>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="logbook-empty">
          <BookOpen size={28} />
          <h3>
            {query
              ? "No matching aircraft"
              : "Every collection begins with a first sighting."}
          </h3>
          <p>
            {query
              ? "Try another aircraft type, callsign or registration."
              : "When a live aircraft enters a view, its type and visit are recorded here automatically. Demo signals are never logged."}
          </p>
        </div>
      )}
      <div className="logbook-foot">
        <span>
          Live observations
          <br />
          <a
            className="logbook-photo-credits"
            href="/aircraft/CREDITS.json"
            target="_blank"
            rel="noreferrer"
          >
            Reference photo credits &amp; licenses ↗
          </a>
        </span>
        <p>
          Recording runs while this page is open. A return after 5 minutes
          without a signal counts as a new pass. Times are local to your
          browser.
        </p>
      </div>
    </section>
  );
}
