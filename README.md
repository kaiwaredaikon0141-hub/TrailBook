# TrailBook

TrailBook is an offline-first GPX library for managing folders and GPX files
without changing the user's source data.

## Official Documentation

The official project documentation is maintained in the [docs](docs/) directory.
Start with [START_HERE.md](docs/START_HERE.md), then read the project and
architecture documents before making changes.

## Current Release

Release 0.8.0: Waypoint Display Option

The current implementation can open a directory, recursively find subfolders
and `.gpx` files, parse an explicitly requested GPX file into Track,
TrackSegment, TrackPoint, Waypoint, and Metadata models, navigate large
libraries through a lazy TreeView, display multiple GPX files independently,
toggle descendant GPX files from a folder checkbox, and control Waypoint
visibility without re-parsing GPX files.

## Technical Constraints

- HTML5, CSS3, and JavaScript ES Modules
- Browser File System Access API
- No framework, TypeScript, Node.js, or external library