# Changelog

## v1.7.0

Date: 2026-08-15
Status: Ready for final commit and tag

### Added

- Responsive Mobile Viewer with overlay Library sidebar and mobile Track Info presentation
- Session-only GPS current position, accuracy circle, Follow control, and manual-drag Follow release
- Driving Mode integrating GPS Follow with Screen Wake Lock and visibility-based reacquisition
- Read-only Google Drive Library Reader with OAuth, Folder Picker, recursive metadata scan, and lazy GPX loading
- GitHub Pages HTTPS deployment workflow with runtime Google configuration generated from repository secrets

### Changed

- Drive geometry cache lookup now occurs before GPX media download; cold cache misses use at most four concurrent Drive GPX operations
- Library open actions distinguish the primary device / Files route from the supplemental direct Google Drive connection
- Mobile controls, Sidebar flow, Folder rows, safe-area spacing, and Leaflet control overlap handling were improved
- Temporary Mobile Drive diagnostic panel and hooks were removed after field diagnosis

### Security and Privacy

- Google credentials are runtime configuration only; actual values and access tokens are not committed or logged
- OAuth scope remains `drive.readonly`, and access tokens, GPS positions, and Driving Mode state remain session-only
- GPX editing, Backup, `trailbook.json`, and local Library data-protection boundaries are unchanged

### Known Limitations

- Initial display of a large Google Drive Library remains network-bound when geometry cache entries do not yet exist
- Offline map tiles, Mobile editing, GPS track recording, and heading-up navigation are not implemented

## v1.6.0

Date: 2026-08-15
Status: Ready for final commit and tag

### Added

- Track Point date correction with one UTC offset, Undo / Redo, and draft support
- Date-based filename rename with collision suffixes, Backup association index, and single-Track name synchronization
- Whole-Track translation that changes only Track Point latitude / longitude
- OpenStreetMap / GSI standard base-map selection stored as a device-local preference
- Analyzed, explicit batch simplification for a selected Folder subtree or the whole Library

### Changed

- Date Tree now uses year / month / Track without day nodes while preserving resolved-date ordering and Unknown Date behavior
- Map Track selection expands the required Date Tree year / month and synchronizes the Track node
- Batch simplification skips zero-reduction GPX files without writing, Backup creation, timestamp changes, or refresh

### Data Protection

- Release 1.5 Original Backup + In-place Edited GPX remains the save boundary
- Date, filename, Track-name, and translation changes are written only by an explicit save action
- Original Backup files are never renamed, overwritten, or deleted
- Batch writes are sequential, continue after file-level failures, and cancel only at a safe file boundary

### Known Limitations

- Point move / add / delete, interval deletion, Track split / merge, autosave, and Mobile editing are not implemented
- GPS current-position tracking, wake lock, Google Maps, white-map scanning, and historical trace are not implemented

## v1.5.0

Date: 2026-08-14
Status: Ready for final commit and tag

### Added

- Immutable single-GPX editing source, retained-point working mask, and command history with Undo / Redo
- Segment-local iterative Ramer–Douglas–Peucker simplification with point, distance, reduction, and deviation metrics
- Before / After / Both line and point previews with Apply, Done, Cancel, and session-memory draft resume
- Explicit `保存` flow that preserves original bytes in `TrailBook_Backup/<source filename>` before updating the original GPX path
- Read-back verification for both the original Backup and edited GPX

### Changed

- Successful editing keeps the original filename and relative path and refreshes only the same-path cache, Discovery entry, and visible Layer
- `TrailBook_Backup` is a reserved Folder excluded from Library scan, Tree, Date Tree, Search, Discovery Index, Geometry Cache, and GPX counts

### Data Protection

- GPX writes occur only after an explicit user save action and successful original-byte Backup verification
- Existing Backups are never automatically overwritten or deleted, and no automatic restore is performed
- Permission denial or Backup failure leaves the source GPX unchanged; source-write or edited-verification failure preserves the Backup for recovery
- `trailbook.json` is not modified by GPX editing

### Known Limitations

- Point move / add / delete, interval deletion, Track split / merge, batch simplification, whole-Track movement, date correction, and filename date organization are not implemented
- Autosave, Mobile editing, automatic Backup restore, and automatic recovery are not implemented

## v1.4.0

Date: 2026-08-08
Status: Ready for final commit and tag

### Added

- One path-keyed Library Discovery Index shared by Date Tree, Track Info, and Search / Filter
- Lazy year / month / day Date Tree with Unknown Date and group bulk visibility
- Selected Track information for name, Folder, date source, distance, points, time, duration, and elevation range
- Track name / Folder path search with inclusive From / To date filters
- Desktop Sidebar width and Track list / Track Info split resizing with Library-local restoration
- GPX byte decoding for UTF-8, UTF-16 BOM, Shift_JIS, and Windows-31J declarations

### Changed

- Normal Track opacity is 0.55 for alpha blending while selected Tracks remain fully opaque with the existing outline
- Broken internal GPX names containing replacement or control characters fall back to the relative-path filename
- Geometry Cache schema validation regenerates only stale or incompatible GPX entries and shares compact Discovery summaries with drawing geometry
- Folder and Date views share SelectionState and DisplayState without changing Map visibility during filtering

### Performance

- Approximately 806 GPX cold Discovery Index median: 21 seconds without blocking the UI
- Approximately 806 GPX warm Discovery Index median: 3 seconds, meeting the approximately 5-second target
- Existing approximately 807 Track warm restore median remains 3 seconds as the accepted baseline; Release 1.4 acceptance found no observable regression, but did not repeat the numerical timing run

### Data Protection

- Discovery data and filters do not write to GPX or `trailbook.json`
- Encoding recovery never rewrites the source GPX
- Geometry and Discovery caches remain origin-local, derived, disposable data

### Known Limitations

- Date grouping and inclusive date filtering use the browser's local calendar date and can change with the local timezone
- Mobile UI remains unsupported, and Waypoint ON remains expensive for large Libraries
- Automated DOM static test pages require a browser runtime; Search / Filter was accepted through human Browser Acceptance and static module validation

## v1.3.0

Date: 2026-08-08
Status: Ready for final commit and tag

### Added

- Library-scoped restoration of Map center / zoom, Sidebar open state, visible Tracks, and selected Track
- Previous Library restoration using an origin-local IndexedDB DirectoryHandle record
- Explicit permission fallback through `前回のLibraryを開く` while retaining the normal Library picker
- Regenerable IndexedDB parsed geometry cache for fast warm restoration
- Current-Library view-state Reset without changing shared settings or GPX files

### Changed

- Reused `DisplayState`, `SelectionState`, and `GPXDisplayQueue` as the runtime sources of truth during restoration
- Restored selection through the normal Tree / Search / highlight / ARIA projection without Map movement or forced focus
- Coalesced Map, Sidebar, visibility, and selection snapshots through the existing 750 ms save queue

### Performance

- Reduced approximately 807 visible Track warm restore from a 25-second median to a 3-second median
- Met the approximately 5-second warm restore target without duplicate parse or render

### Data Protection

- GPX files remain read-only and `trailbook.json` is not modified by view restoration
- DirectoryHandle data is stored only in origin-local IndexedDB, not localStorage or shared JSON
- Geometry cache entries contain regenerable Track / Waypoint coordinates, not GPX XML, Leaflet Layers, or Queue state
- Cache miss, invalid data, schema mismatch, quota failure, and storage failure fall back to the existing parse queue

### Known Limitations

- Previous Library and geometry cache data are origin-local and are unavailable after an origin change or site-data deletion
- Root-name Library identity can collide for different Libraries with the same root Folder name
- Sidebar width and Search / Tree navigation state are not restored
- Mobile UI remains unsupported, and Waypoint ON remains expensive for large Libraries

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
