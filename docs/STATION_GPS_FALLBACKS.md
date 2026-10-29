# MaxTrip — Manual GPS fallback evidence

These coordinates are physical railway station points, not city centroids.
The values were supplied in the October 2026 station-geocoding research
report and are used only if the primary SNCF reference and unambiguous
aliases do not resolve the station.

| Catalogue aliases | Latitude | Longitude | Station identifier | Evidence |
| --- | ---: | ---: | --- | --- |
| TGV HAUTE PICARDIE; HAUTE PICARDIE TGV | 49.85917 | 2.83167 | UIC 87313882 | https://en.wikipedia.org/wiki/TGV_Haute-Picardie_station |
| AIX EN PROVENCE TGV | 43.45500 | 5.31722 | UIC 87319012 (research report; independently recheck identifier) | https://en.wikipedia.org/wiki/Aix-en-Provence_TGV_station |
| MARSEILLE ST CHARLES; MARSEILLE SAINT CHARLES | 43.30306 | 5.38111 | UIC 87751008 | https://en.wikipedia.org/wiki/Marseille-Saint-Charles_station |

## Coverage interpretation

**Do not add 3 to the coverage count.** The three examples were not
shown to belong to the 55 unresolved stations in the measured audit.
Haute-Picardie was already present as a fallback. The 255/310 (82.26%)
measurement is the last verified baseline. The CI audit must be rerun
to establish any actual change in coverage.

`PARIS (intramuros)` and `LYON (intramuros)` are city groupings,
not physical stations, and must not receive station GPS overrides.

Remaining missing stations include international locations and unusual
SNCF catalogue labels. Resolve each against a unique railway identifier
before adding further manual coordinates.
