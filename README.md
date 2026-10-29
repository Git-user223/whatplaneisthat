# What Plane Is That?

A localhost dashboard that identifies aircraft entering a configurable slice of sky near DCA. It combines live ADS-B positions with aircraft and route metadata, then promotes the newest plane entering your saved view.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). If that port is occupied:

```bash
npm run dev -- --port 5174
```

## Configure a view

1. Open **Views**.
2. Click the map or drag the pin to place your window.
3. Drag the orange handle to aim the viewing cone.
4. Set its width, range, and minimum altitude.
5. Give it a name and choose **Save as a view**.
6. Choose **Use this view** to begin tracking.

Saved views stay in the browser's local storage. They can be loaded, updated, or deleted from the same panel.

## Data sources

- Live aircraft positions: [adsb.lol](https://www.adsb.lol/)
- Aircraft and route metadata: [ADSBDB](https://www.adsbdb.com/)
- Map tiles: [OpenStreetMap](https://www.openstreetmap.org/)

Public ADS-B coverage can be incomplete, particularly for blocked, military, or privacy-enabled aircraft.
