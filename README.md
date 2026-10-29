# whatplaneisthat?

An always-on aircraft observation dashboard: explore an interactive globe, identify live aircraft passing your window, and keep a logbook of the types each view has seen. The main dashboard fits the viewport without page scrolling.

## Run

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The app listens on **0.0.0.0:9004**. The intended forwarded address is **http://harari.mitre.org:9004**. Vite explicitly accepts `harari.mitre.org` as a host. The forwarding from Harari to the machine running the app must be configured separately, just as for Arena on port 9003; binding the app alone does not establish that network tunnel.

For a production build and local server:

```bash
npm run build
npm start
```

Both development and production servers default to port 9004; run one at a time.

## Configure a view

1. Open **Views** using the settings icon at the bottom of the left rail (top right on phones).
2. Click the map or drag the pin to place your window.
3. Drag the orange handle to aim the viewing cone.
4. Set its width, range, and minimum altitude.
5. Give it a name and choose **Save as a view**.
6. Choose **Use this view** to display its live sky.

Drag the globe to rotate it, use its arrow-key controls, or select **Locate view** to center your window. Switch to **Local sky** for the geographic map, your observer location and full viewing cone, and clickable nearby aircraft. The map reuses the view selector’s OpenStreetMap tiles. Real great-circle flight routes appear on the globe when airport coordinates are available.

The newest arrival takes focus automatically. The right pane shows its route, aircraft type, altitude, speed, distance, and vertical rate; the bottom strip shows recent sightings. Choose **Open logbook** or the book icon for the complete searchable history, which opens over the live dashboard. The fullscreen icon at the top right suits a dedicated display; Escape exits fullscreen. On a phone, **Airspace** and **Aircraft** tabs switch between panes.

The design follows the [Taste skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) app-screen workflow: the Data terminal direction (seed 13346263), Public Sans served locally, neutral dark surfaces, and amber position/selection marks. The typeface license is in `public/fonts/OFL-PublicSans.txt`.

## Aircraft photos and DCA map

The aircraft panel first uses the registration-matched photograph supplied by ADSBDB. If no photograph is available or it fails to load, it falls back to a locally bundled, licensed model/family reference photo. Reference images are explicitly labeled and can show a different registration or livery. The fallback library covers 49 ICAO type codes; full source, photographer, license and resizing/cropping details are in `public/aircraft/CREDITS.json`, with credits shown under each reference photo. Unsupported aircraft show an honest photo-unavailable state.

**Local sky** displays the same OpenStreetMap tiles as the view selector, your location pin, the full configured viewing cone, nearby aircraft, and observed flight trails. Trails contain only positions received while the page is open, retain ten minutes of observations, and break across long signal gaps or implausible position jumps. They are not reconstructed historical tracks. Reloading clears the live trails while preserving the logbook.

The DCA overlay shows approximate Potomac north, Potomac south and Anacostia corridors from the [Metropolitan Washington Airports Authority's typical operations overview](https://www.flyreagan.com/about-airport/aircraft-noise-information/dca-reagan-national-aircraft-procedures). Choose **North flow**, **South flow**, or all corridors. These are regional context lines, not official FAA procedure geometry or an indication of the airport's current operating direction. Solid lines show observed tracks; dashed blue lines show the approximate corridors. **My view**, **DCA**, and zoom buttons adjust the map without changing your saved observer location.

## Aircraft logbook

The page polls the current cone and all saved views every 10 seconds while it is open. Only live aircraft inside each view's range, direction, and minimum altitude are logged. Demo aircraft shown during feed outages are excluded.

The logbook groups sightings by ICAO aircraft type, with first/last seen times and pass counts. Each type includes a photo preview. Expand a type for individual flights, registrations, timestamps, viewpoints, and larger aircraft photographs. Registration photos load as visits enter view, with labeled model/family references as a fallback; existing sighting records work without migration. Search aircraft types, flight callsigns, or registrations, filter by view, or export the filtered records as JSON. Unknown types are retained as unidentified aircraft.

Repeated signals from the same aircraft and callsign update one pass. A return after more than five minutes without a recorded signal creates another pass. Deleted views retain their history under **Archived view**.

**Views and history are stored in this browser's local storage.** They survive reloads but are not shared between browsers or devices. Clearing browser data removes them; export a copy to retain them. Recording stops when the page closes, and background-tab throttling can delay polling. Times use the browser's local timezone. A browser-storage failure displays a warning and keeps the current log in memory for export.

## Checks

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Data sources

- Live positions: [adsb.lol](https://www.adsb.lol/)
- Aircraft and routes: [ADSBDB](https://www.adsbdb.com/)
- Map tiles: [OpenStreetMap](https://www.openstreetmap.org/)
- Globe geometry: [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), public-domain geographic data served locally from `public/data/land.geojson`.

Public ADS-B coverage and aircraft metadata can be incomplete, particularly for blocked, military, or privacy-enabled aircraft.
