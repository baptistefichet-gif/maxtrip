# MaxTrip — Project Context

> **Purpose:** durable handoff context for humans and AI assistants. **The code on `main` is the implementation source of truth.** Before a substantial task, inspect current code and this file. If they disagree, trust the code and update this file only when durable project facts changed. Never store secrets, tokens, passwords, API keys, or environment-variable values here.

## Product goal

MaxTrip is a free, independent web app built on SNCF TGV MAX Open Data. It helps users find **useful journeys marked as TGV MAX available**, not merely every technically possible combination. It supports direct trains, connections and compatible returns, while reminding users that Open Data availability is indicative and must be confirmed on SNCF Connect.

Product positioning: **“Pars où tu veux. Trouve tes trajets TGV MAX.”**

## Current user-facing application

Two search modes are implemented:

- **Explorer:** departure station + date + time window; groups discovered journeys by destination and shows itinerary counts. Opening a destination keeps the search in memory and uses an accessible full-screen-style detail dialog on mobile.
- **Trajet classique:** departure + destination + date/time window, direct and/or connecting journeys, optional required return.

Search controls include:
- “À partir de” and optional “Jusqu’à”; empty maximum means end of day (`24:00`). Invalid/inverted windows are rejected.
- “Je veux un retour TGV MAX”, with return date and time window.
- Optional connections with max changes and min/max waiting time.
- Paginated UI results (12 per page). **UI pagination is not SNCF API pagination.**

The app also includes:
- an OpenStreetMap/Leaflet map;
- destination selection and itinerary display on the expanded map;
- green direct-route lines and orange connecting-route lines;
- transfer markers for a selected journey;
- large mobile destination hit targets;
- a mobile map results sheet using **Vaul** with 25/50/90% snap points; desktop keeps a floating side panel;
- top navigation: **Recherche | Comment ça marche**;
- a `/comment-ca-marche` guide explaining search, returns, connections, data limits and reservation verification.

## Stack and external services

- Next.js 14 App Router, React 18, TypeScript.
- Tailwind CSS.
- React Leaflet + Leaflet, public OpenStreetMap tiles (no map API key).
- Vaul for the mobile map drawer/sheet.
- SNCF Open Data Explore API v2.1, dataset `tgvmax`.
- GitHub + GitHub Actions for source control/CI.
- Vercel for deployment. Keep deployments economical: the project has encountered Vercel build-rate limits.
- Node.js 20 in CI; dependency installation uses reproducible `npm ci`.

No SNCF booking is performed. MaxTrip is independent and not affiliated with SNCF.

## Architecture and important files

- `app/page.tsx` — main client UI/state: both search modes, filters, return controls, result presentation/dialogs, pagination, map integration, Vaul mobile sheet.
- `app/api/itineraries/route.ts` — main journey engine. Pages SNCF data, builds direct/connecting routes, applies transfer constraints, constructs required returns, reports truncation.
- `app/api/trains/route.ts` — lower-level paginated SNCF record proxy (max 100 records/request).
- `app/api/stations/route.ts` — station catalogue for selectors.
- `app/api/station-coordinates/route.ts` — station coordinate source used by the map.
- `lib/route-relevance.mjs` — shared relevance filtering, destination-diverse route selection, hidden-alternative counting, 7-hour duration rule.
- `lib/station-geocoding.mjs` — conservative station-name normalization/coordinate resolution; never invent coordinates.
- `components/StationMap.tsx` — Leaflet rendering, route colors, transfer/destination markers and map fitting.
- `components/SiteHeader.tsx` — shared navigation/header.
- `app/comment-ca-marche/page.tsx` — user guide.
- `test/*.test.mjs` — deterministic unit tests for relevance and station geocoding.
- `scripts/smoke-sncf-api.mjs` — live SNCF data smoke checks.
- `scripts/smoke-itinerary-endpoint.mjs` — end-to-end live itinerary/return/relevance checks against a locally built app.
- `.github/workflows/ci.yml` — main CI.
- `.github/workflows/map-browser.yml`, `station-geocoding-audit.yml` — useful specialized workflows, currently branch-scoped/manual rather than general `main` gates.
- `docs/STATION_GPS_FALLBACKS.md` — evidence and rules for manual physical-station coordinate fallbacks.
- `README_MAXTRIP.md` — legacy overview; currently stale in places. Do not use it as authoritative project status.

## Core business rules

### Availability and time
- Only SNCF rows marked `od_happy_card = OUI` are usable journey legs.
- Empty end time means end of day; end must be strictly after start.
- Built journeys are capped at **7 hours (420 min), inclusive**.

### Connections
- User can allow connections and configure max changes (API clamps 0–3), min wait and max wait.
- Same physical station needs no transfer buffer.
- Different stations in **Paris require at least 60 minutes**.
- Other cross-station transfers are allowed only for explicitly known same-city pairs. Unknown cross-station transfers are rejected rather than guessed.
- Current explicit base rules include Lille Europe/Flandres, Lyon Part-Dieu/Perrache, Montpellier Saint-Roch/Sud de France and Aix Centre/TGV; the engine applies a conservative multiplier to those base values.

### Relevance
Goal: hide redundant connections by default without losing access to alternatives.
- A connection can be suppressed only by a direct to the same exact destination station that arrives no later and satisfies the current departure-comparison rule.
- Current default tolerance in `applyConnectionRelevance` is **15 minutes**. The implementation also treats a later-departing direct that arrives no later as dominating.
- With a required return, an indirect route must not be suppressed by a direct that has no compatible return.
- “Afficher aussi les autres correspondances” restores suppressed alternatives.
- Do not silently change this rule: it is product behavior covered by unit/smoke tests.

### Returns
- When return is required, every returned outbound journey must have at least one compatible reverse journey for the requested return date/time.
- Return construction uses the same connection constraints.
- Same-day returns must depart after the outbound arrival.

### Data completeness and safety limits
SNCF loading is genuinely paginated, but intentionally bounded for serverless safety:
- SNCF page size: 100.
- Global loaded-record ceiling: 5,000.
- Connection query ceiling: 800 records/query.
- Candidate transfer stations are bounded (64 first hop, 32 later hops).
- Built routes: 400 max; candidate routes: 2,400 max.
- Network requests have timeout/retry logic and bounded concurrency.
- The API returns `truncated` plus human-readable `truncationReasons` whenever known safety limits or failed pages can make results partial.
- **Never present a truncated search as exhaustive.**

## Map/geocoding invariants

- Do not draw a route segment if either endpoint lacks coordinates; false straight lines are worse than an incomplete drawing.
- Station matching is conservative: exact normalized names, unambiguous token/alias matches, then documented verified fallbacks.
- Never map city groupings such as `PARIS (intramuros)` or `LYON (intramuros)` to an arbitrary physical station.
- Manual GPS fallbacks require evidence; see `docs/STATION_GPS_FALLBACKS.md`.
- Last documented geocoding audit baseline: **255/310 (82.26%)**; rerun the audit before claiming improvement.

## Completed / integrated on main

- Explorer and classic search flows.
- Direct journeys and bounded multi-leg connection construction.
- Required compatible return construction.
- Time-window validation and optional end-of-day maximum.
- Shared relevance filtering with access to hidden alternatives.
- Destination-diverse route selection and 7-hour journey cap.
- Result pagination and destination detail UX.
- OpenStreetMap interactive map, selected-route rendering and conservative missing-coordinate handling.
- Expanded map itinerary panel; Vaul mobile drawer integrated via merged PR #22.
- “Comment ça marche” page and shared navigation.
- Reproducible lockfile + `npm ci` in CI.
- Unit coverage for relevance edge cases and conservative station geocoding.

## In progress / known limitations

- **Performance/completeness of connection discovery is the main technical risk.** Safety caps can omit valid possibilities; the UI/API must preserve truncation warnings.
- The latest `main` CI run for commit `22cd083` passed install, unit tests, live SNCF smoke and production build, but the full live itinerary smoke was cancelled when the job reached roughly the 15-minute timeout. Treat CI as not fully green until this is fixed/optimized.
- Vercel has separately reported a **build-rate-limit** failure. This is an external deployment quota issue, not evidence of a Next.js compile failure.
- Geocoding is intentionally incomplete rather than speculative; some catalogue stations have no reliable coordinate.
- Specialized map browser/geocoding workflows are not currently universal `main` gates.
- Several older PRs remain open even though newer work has superseded parts of them. Inspect `main` before using an old PR as planned work.
- Real-device Safari/iPhone and Android touch behavior still deserves explicit regression testing, especially map gestures, Vaul scrolling/snapping and Leaflet interaction.
- `README_MAXTRIP.md` understates current capabilities and should eventually be refreshed or replaced.

## Tests and validation that matter

Before considering a substantial feature complete:
1. `npm ci`
2. `npm test`
3. `npm run build`
4. Live SNCF smoke where appropriate: `node scripts/smoke-sncf-api.mjs`
5. For journey-engine changes: `node scripts/smoke-itinerary-endpoint.mjs` (currently performance-sensitive)
6. For map/geocoding changes, run the relevant browser/geocoding checks and inspect artifacts.
7. For mobile interaction changes, validate on a real smartphone/browser when possible.

Important regression cases include:
- redundant indirect hidden while a useful/faster indirect remains;
- required-return relevance never prefers a direct without a compatible return;
- hidden alternatives remain recoverable;
- 7-hour boundary;
- destination coverage/diversity;
- unknown/ambiguous station coordinates return null;
- no false map line through a missing coordinate;
- invalid time ranges return HTTP 400.

## Do not break

- Exact selected origin/destination semantics in classic mode.
- MAX availability on **every leg**.
- Required-return compatibility.
- Conservative transfer rules, especially 60 min for different Paris stations.
- Truncation reporting and distinction between UI pagination vs SNCF data pagination.
- Access to suppressed connection alternatives.
- Search state when opening/closing destination details.
- Accessible dialog behavior (Escape, focus handling, background scroll lock).
- Map rule: no invented coordinates / no false segment across missing GPS.
- Mobile map scrolling/drag arbitration between Vaul and Leaflet.
- SNCF Open Data disclaimer and requirement to verify on SNCF Connect.

## Next priorities

1. Make the itinerary engine/live smoke reliably complete within CI/serverless time budgets without hiding data-limit warnings.
2. Validate connection relevance on a broader set of real SNCF cases, including required-return cases.
3. Improve SNCF coverage/pagination strategy while keeping explicit safety limits and diagnostics.
4. Continue station-coordinate coverage work using verifiable railway-station identities only.
5. Regression-test map + Vaul UX on iPhone/Safari and Android; refine touch targets/gesture conflicts.
6. Refresh stale documentation (`README_MAXTRIP.md`) once behavior is stable.
7. Keep Vercel deployments deliberate because of build quotas.

## Maintenance rule for future work

After an important change, ask: **did a durable fact above change?** If yes, update this file in the same PR/commit. Do not add transient debugging notes or a chronological diary. Before a large task, read current code + this file; after a large feature, verify code + tests + this file agree before declaring it finished.
