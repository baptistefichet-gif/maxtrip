# Daily SNCF snapshot design

This is the V1 data-refresh design being validated before the itinerary engine switches to it.

## Goal

Refresh the TGV MAX Open Data automatically every morning at zero recurring cost, without committing the large dataset to `main` and without causing a daily Vercel deployment.

## Flow

1. Scheduled GitHub Action runs at 06:30 UTC (07:30 CET / 08:30 CEST).
2. It calls the Explore API v2.1 dataset export endpoint, requesting only rows marked `OUI` and only fields MaxTrip needs.
3. The builder rejects suspicious/incomplete data before publication.
4. The validated snapshot is grouped by travel date and gzip-compressed.
5. A fixed GitHub Release named/tagged `maxtrip-data` stores:
   - `maxtrip-current.json.gz`
   - `maxtrip-current.metadata.json`
   - `maxtrip-previous.json.gz` when a prior current snapshot exists.
6. Release assets are replaced in place. No daily commit to `main` is made, so data refresh is decoupled from application deployments.

## Safety rules

- Never replace current data until the new export passes validation.
- Keep one previous valid snapshot for rollback.
- Reject unexpectedly tiny exports, excessive malformed rows, or implausible date coverage.
- Snapshot contains only rows explicitly marked TGV MAX available (`OUI`).
- The application must expose snapshot freshness and must never claim real-time availability.
- SNCF Connect remains the final availability/reservation check.

## Rollout

Do **not** remove the existing live API path yet. First prove the scheduled snapshot succeeds and measure its size/content. Then adapt `/api/itineraries` behind a fallback so current behavior remains available until snapshot-based searches pass the same regression/smoke tests.
