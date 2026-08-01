# Third-Party Notices

This document records third-party components and services used by TrailBook. Their licenses and terms are separate from the TrailBook source code notice in [LICENSE](LICENSE).

## Leaflet

- Component: Leaflet
- Version: 1.9.4
- License: BSD 2-Clause License
- Distribution: Bundled locally under `src/vendor/leaflet/`
- License text: [src/vendor/leaflet/LICENSE](src/vendor/leaflet/LICENSE)

The bundled Leaflet license file must be retained with the vendor files.

## OpenStreetMap

- Purpose: Online background map tile source
- Tile endpoint: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- On-screen attribution text: `© OpenStreetMap contributors`
- Copyright and attribution information: [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright)

OpenStreetMap background tiles require an online connection. TrailBook does not implement bulk tile download, prefetch, offline tile storage, or a Google Drive synchronization service.

Displaying and navigating the map sends requests for the corresponding map tiles. These requests may reveal the approximate area being viewed to the tile service. TrailBook does not upload GPX files or GPX content as part of those requests.
