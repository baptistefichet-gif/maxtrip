const base = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax";
const requiredFields = ["date", "origine", "destination", "heure_depart", "heure_arrivee", "od_happy_card"];

async function getJson(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(label + " returned HTTP " + response.status + ": " + body.slice(0, 300));
      }
      return JSON.parse(body);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

function escapeOdsqlString(value) {
  // ODSQL escapes an apostrophe inside a string by doubling it.
  return String(value).replace(/'/g, "''");
}

function assert(condition, message) {
  if (!condition) throw new Error("SMOKE TEST FAILED: " + message);
}

async function main() {
  const sampleUrl = new URL(base + "/records");
  sampleUrl.searchParams.set("limit", "1");
  const sampleData = await getJson(sampleUrl.toString(), "Sample records request");
  assert(Array.isArray(sampleData.results) && sampleData.results.length > 0, "SNCF records endpoint returned no sample record.");

  const sample = sampleData.results[0];
  const missingFields = requiredFields.filter(field => sample[field] === undefined);
  assert(missingFields.length === 0, "Expected field(s) missing: " + missingFields.join(", "));

  const date = String(sample.date).slice(0, 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "Unexpected date format: " + sample.date);

  const query = "origine = '" + escapeOdsqlString(sample.origine) + "' AND destination = '" +
    escapeOdsqlString(sample.destination) + "' AND date = date'" + date + "'";
  const exactUrl = new URL(base + "/records");
  exactUrl.searchParams.set("where", query);
  exactUrl.searchParams.set("limit", "1");
  const exactData = await getJson(exactUrl.toString(), "Exact station/date ODSQL request");
  assert(Array.isArray(exactData.results) && exactData.results.length > 0,
    "Exact origine + destination + date filter returned 0 records. ODSQL query was: " + query);

  const groupedUrl = new URL(base + "/records");
  groupedUrl.searchParams.set("select", "origine");
  groupedUrl.searchParams.set("group_by", "origine");
  groupedUrl.searchParams.set("limit", "100");
  const groupedData = await getJson(groupedUrl.toString(), "Grouped origins request");
  assert(Array.isArray(groupedData.results) && groupedData.results.length > 0,
    "group_by=origine did not return any stations.");
  assert(groupedData.results.some(row => typeof row.origine === "string" && row.origine.trim()),
    "Grouped origin results do not contain the origine field.");

  console.log("PASS: SNCF records endpoint returns sample data.");
  console.log("PASS: Required fields exist: " + requiredFields.join(", "));
  console.log("PASS: Exact ODSQL query returns the sample record.");
  console.log("PASS: Grouped origin values are available for dropdowns.");
  console.log("Sample: " + sample.origine + " -> " + sample.destination + " on " + date + "; exact-match rows: " + exactData.results.length + ".");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
