# Third-Party Notices

This document records third-party components and services used by TrailBook. Their licenses and terms are separate from the TrailBook source code notice in [LICENSE](LICENSE).

## Leaflet

- Component: Leaflet
- Version: 1.9.4
- License: BSD 2-Clause License
- Distribution: Bundled locally under `src/vendor/leaflet/`
- License text: [src/vendor/leaflet/LICENSE](src/vendor/leaflet/LICENSE)

The bundled Leaflet license file must be retained with the vendor files.

## PMTiles JavaScript

- Component: PMTiles JavaScript
- Version: 4.5.0
- License: BSD 3-Clause License
- Distribution: Bundled locally under `src/vendor/pmtiles/`
- License text: [src/vendor/pmtiles/LICENSE](src/vendor/pmtiles/LICENSE)

The bundled PMTiles license file must be retained with the vendor files.

## protomaps-leaflet

- Component: protomaps-leaflet
- Version: 5.1.0
- License: BSD 3-Clause License
- Distribution: Bundled locally under `src/vendor/protomaps-leaflet/`
- License text: [src/vendor/protomaps-leaflet/LICENSE](src/vendor/protomaps-leaflet/LICENSE)

The bundled renderer uses its built-in map flavor and browser/system fonts.
It does not fetch a remote style, sprite, or font. Exact font appearance may
therefore vary by device. The bundled license file must be retained with the
vendor files.

## OpenStreetMap

- Purpose: Online background map tile source
- Tile endpoint: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- On-screen attribution text: `© OpenStreetMap contributors`
- Copyright and attribution information: [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright)

OpenStreetMap background tiles require an online connection. TrailBook does not
bulk-download, prefetch, or store OpenStreetMap tiles for offline use, and does
not implement a Google Drive synchronization service.

Displaying and navigating the map sends requests for the corresponding map tiles. These requests may reveal the approximate area being viewed to the tile service. TrailBook does not upload GPX files or GPX content as part of those requests.
