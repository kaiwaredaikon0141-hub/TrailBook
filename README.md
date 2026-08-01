# TrailBook

TrailBook is an offline-first GPX library for managing folders and GPX files
without changing the user's source data.

## Official Documentation

The official project documentation is maintained in the [docs](docs/) directory.
Start with [START_HERE.md](docs/START_HERE.md), then read the project and
architecture documents before making changes.

## Current Release

Release 0.7.0: Folder Bulk Display

The current implementation can open a directory, recursively find subfolders
and `.gpx` files, parse an explicitly requested GPX file into Track,
TrackSegment, TrackPoint, Waypoint, and Metadata models, navigate large
libraries through a lazy TreeView, display multiple GPX files independently,
and toggle all descendant GPX files from a folder checkbox.

## Technical Constraints

- HTML5, CSS3, and JavaScript ES Modules
- Browser File System Access API
- No framework, TypeScript, Node.js, or external library