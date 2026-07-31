# TrailBook

TrailBook is an offline-first GPX library for managing folders and GPX files
without changing the user's source data.

## Official Documentation

The official project documentation is maintained in the [docs](docs/) directory.
Start with [START_HERE.md](docs/START_HERE.md), then read the project and
architecture documents before making changes.

## Current Release

Release 0.2: Folder Library

The current implementation can open a directory, recursively find subfolders
and `.gpx` files, and display the resulting folder tree. GPX content parsing is
planned for Release 0.3.

## Technical Constraints

- HTML5, CSS3, and JavaScript ES Modules
- Browser File System Access API
- No framework, TypeScript, Node.js, or external library