# Changelog

## v1.2.0

Date: 2026-08-02
Status: Ready for final commit and tag

### Added

- Shared Library Settings using Library-root `trailbook.json`
- Read-only shared settings loader with fail-closed schema validation
- Library-scoped Folder color sharing
- Explicit Save with readwrite permission requested only from user actions
- Explicit migration from legacy localStorage Folder colors
- Manual Reload for externally synchronized settings
- Reload / Overwrite / Cancel conflict recovery
- Explicit recovery from invalid JSON
- Google Drive synchronized Folder operation without a cloud API

### Changed

- Folder colors can use validated Library-scoped shared JSON as their source of truth
- Clarified that TrailBook does not modify GPX or Library settings without an explicit user save action
- Retained localStorage for device-local Map mode and legacy Folder color fallback
- Prevented entry-by-entry mixing of valid shared JSON with legacy Folder colors

### Data Protection

- GPX files remain read-only and are never written, moved, deleted, or saved
- Only `trailbook.json` can be written, and only after explicit Save, Migration, or Overwrite actions
- Added fingerprint conflict detection and post-write verification
- Invalid or unsupported shared JSON fails closed and is not automatically repaired
- No automatic save, polling, background sync, automatic merge, cloud API, account, server, or database was added

### Known Limitations

- Automatic merge, polling, and background synchronization are not implemented
- TrailBook cannot inspect Google Drive synchronization status
- External changes may require Manual Reload or Library reselection
- The write race between fingerprint verification and writer close cannot be fully eliminated; post-write verification detects mismatches
- Import / Export, Mobile Viewer UX, Folder rename / move, and GPX editing are not implemented
- File System Access permission persistence is not assumed

### Performance

- Passed qualitative acceptance with the existing 806 GPX Library and Shared Library Settings operations
- No UI-freezing operation or clear Viewer regression was observed
- Numerical benchmarking and a 20% comparison were not performed

## v1.1.0

Date: 2026-08-01
Status: Ready for final commit and tag

### Added

- Map Track click selection
- SelectionState as the single GPX selection source of truth
- Selected Track highlight and outline
- Folder color controls
- Folder color inheritance from the nearest explicit ancestor
- Regenerable UI settings persistence
- Monochrome Map Mode

### Changed

- Track line width now follows the zoom level
- Centralized Track style calculation in TrackStyleService
- Synchronized TreeView, Search, and Map selection
- Enabled visible Track color updates without GPX reload or layer recreation
- Enabled OSM tile presentation filtering without changing the tile provider

### Known Limitations

- Overlapping Tracks select the front-most Track
- Root Folders with the same name may share UI settings
- Renaming a root Folder creates a new Library identity
- Mobile UI is unsupported
- Displaying many Waypoints remains performance-intensive

### Performance

- Passed qualitative acceptance with the same 806 GPX Library
- No clear performance regression or UI-freezing operation was observed
- Numerical benchmarking and the 20% comparison were not repeated

## v1.0.0

Released: 2026-08-01

### Added

- Folder Library with recursive GPX discovery
- GPX 1.0 / 1.1 parsing
- Leaflet map display
- Lazy-DOM TreeView
- Multiple GPX display
- Folder and root bulk display controls
- Optional Waypoint display, disabled by default
- Metadata-only Search for GPX file names, Folder names, and relative paths
- Startup and compatibility guidance
- TrailBook favicon
- Third-party notices

### Changed

- Extracted TreeView metadata and path construction responsibilities into TreeMetadataBuilder
- Clarified the read-only startup and Folder selection flow
- Improved StatusBar accessibility
- Removed routine Console output from successful production paths while retaining diagnostic errors
- Clarified documentation and supported environments
- Linked the on-map OpenStreetMap attribution to the OpenStreetMap copyright page

### Documented

- Windows Chrome and Edge support
- Mobile unsupported status
- Offline operation scope
- External OpenStreetMap tile communication
- GPX data protection and read-only behavior
- TrailBook license policy and separate third-party terms
- Known Waypoint performance limitation

### Known Limitations

- Mobile UI is unsupported in Release 1.0
- iPhone Chrome can open a Folder and display its Tree, but GPX checkbox, Track display, and touch UI are unavailable
- Android Chrome and iPad Chrome are unconfirmed
- Enabling Waypoints while many GPX files are displayed can make interaction slow
- OpenStreetMap background tiles require an online connection
- GPX editing is not implemented
- Automatic synchronization is not implemented

### Performance

- Retained the Unit 2 v0.9.0 performance baseline
- Passed Unit 7 qualitative acceptance in Chrome and Edge with no observable regression during manual operation
- Deferred the numerical Unit 2-equivalent performance remeasurement and 20% comparison

## v0.9.0

Released: 2026-08-01

### Added

- Metadata-only Search for GPX file names, Folder names, and relative paths
- Search result navigation into lazily generated TreeView branches
- GPX display checkboxes synchronized with existing display state
- Keyboard-accessible Search results with a 150ms debounce and 100-result limit

## v0.8.0

Released: 2026-08-01

### Added

- Session-scoped Waypoint visibility option in the Map toolbar
- Independent Track and Waypoint layer groups per GPX
- Cached Waypoint toggling without GPX re-parsing or map refocus

## v0.7.0

Released: 2026-08-01

### Added

- Folder checkboxes for bulk descendant GPX display toggles
- Checked, indeterminate, and disabled aggregate folder states
- Folder Model traversal for collapsed and lazily generated descendants
- Bulk display operations using the existing bounded GPX display queue

## v0.6.0

Released: 2026-08-01

### Added

- Independent GPX display checkboxes with separate primary selection
- Session-scoped GPX result cache and bounded display queue
- Path-keyed Leaflet layers, stable GPX colors, and multi-GPX bounds fitting
- Individual GPX removal, loading/error handling, and display summaries

## v0.5.0

Released: 2026-08-01

### Added

- Lazy folder expansion for large GPX libraries
- Keyboard navigation and ARIA TreeView behavior
- TreeView state restoration across same-library reloads
- Folder and GPX name truncation with native tooltips

## v0.4.0

Released: 2026-08-01

### Added

- Leaflet 1.9.4 bundled locally
- Single-GPX Track and Waypoint map display
- TrackSegment-specific polylines and automatic bounds fitting
- GPX selection states, loading/error handling, and clear display control
- Keyboard activation for GPX nodes

## v0.3.0

### Added

- GPXLoader for reading GPX file text
- GPXParser for GPX 1.0 and 1.1
- Metadata, Track, TrackSegment, TrackPoint, and Waypoint models
- GPX parse events and file-level parse errors
- Browser-only GPX parser fixtures and manual tests

## v0.0.3

### Added

- App class
- Config
- EventBus

### Changed

- main.js
- index.html
