# Changelog

## 1.2.0 — 2026-07-09

### Fixed
- Rupture overlay no longer repeats every 60 seconds while at limit
- Overlay now triggers once at 90% threshold and once at 100% threshold
- Panel is no longer forcibly brought to front on every poll tick

### Changed
- Percentage display capped at 100.0% to avoid showing unrealistic values
- Old `rupturaYaMostrada` localStorage flag replaced by numeric `rdt_umbral_mostrado` (0, 0.9, 1.0) to support two-tier trigger

## 1.0.0 — 2025-07-07

### Added
- Status bar showing session (5 h) and weekly (7 d) usage percentages
- WebView panel with Vegeta image and animated progress bars
- Rupture sequence when usage reaches ≥ 90 %
- Auto-refresh every 60 seconds
- Commands: `Radar: Show Panel`, `Radar: Refresh`, `Radar: Close Panel`
- OAuth token refresh support for expired tokens
- 60-second cache for API responses
