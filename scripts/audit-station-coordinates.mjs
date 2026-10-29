import { mkdirSync, writeFileSync } from "node:fs";
import { stationKey, stationCoordinatesFor } from "../lib/station-geocoding.mjs";

const TGV = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const GEO = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/records";
async function request(url, retries=3) {
  let last;
  for (let i=0;i<retries;i++) {
    try {
      const res=await fetch(url, {signal:AbortSignal.timeout(20000),headers:{Accept:"application/json"}});
      if (!res.ok) throw Error("HTTP "+res.status+" "+url);
      return await res.json();
    } catch(e) {last=e;await new Promise(r=>setTimeout(r,600*(i+1)));}
  }
  throw last;
}
async function grouped(field) {
  const result=new Set();
  for(let offset=0;offset<2000;offset+=100) {
    const url=new URL(TGV);
    for(const [k,v] of Object.entries({select:field,group_by:field,limit:"100",offset:String(offset)}))url.searchParams.set(k,v);
    const data=await request(url);
    const rows=Array.isArray(data.results)?data.results:[];
    for(const row of rows)if(typeof row[field]==="string"&&row[field].trim())result.add(row[field].trim());
    if(rows.length<100)return result;
  }
  throw Error("Station group pagination reached 2000; cannot claim exhaustive catalog");
}
async function geodata() {
  const first=await request(GEO+"?limit=100&offset=0");
  const total=first.total_count;
  if(!Number.isInteger(total)||total<0||total>10000)throw Error("Unexpected geography count: "+total);
  const all=[...first.results];
  for(let offset=100;offset<total;offset+=100) {
    const data=await request(GEO+"?limit=100&offset="+offset);
    if(!Array.isArray(data.results)||data.results.length!==Math.min(100,total-offset))throw Error("Incomplete geography page "+offset);
    all.push(...data.results);
  }
  return {all,total};
}
const [origins,destinations,geo]=await Promise.all([grouped("origine"),grouped("destination"),geodata()]);
const catalog=[...new Set([...origins,...destinations])].sort((a,b)=>a.localeCompare(b,"fr"));
const coords={},conflicts=new Set();
for(const row of geo.all){
  const name=String(row.nom??"");
  const raw=row.position_geographique;
  const point=Array.isArray(raw)?{lat:Number(raw[0]),lon:Number(raw[1])}:raw;
  if(!name||!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))continue;
  const key=stationKey(name);
  if(coords[key]&&(Math.abs(coords[key].lat-point.lat)>0.002||Math.abs(coords[key].lon-point.lon)>0.002))conflicts.add(key);
  else if(!coords[key])coords[key]={lat:point.lat,lon:point.lon};
}
for(const key of conflicts)delete coords[key];
const groupings=catalog.filter(x=>stationKey(x).includes("INTRAMUROS"));
const physical=catalog.filter(x=>!stationKey(x).includes("INTRAMUROS"));
const resolved=[],missing=[];
for(const name of physical) (stationCoordinatesFor(name,coords)?resolved:missing).push(name);
const summary={generatedAt:new Date().toISOString(),catalogTotal:catalog.length,origins:origins.size,destinations:destinations.size,physical:physical.length,groupings:groupings.length,geographicRecords:geo.total,geographicNames:Object.keys(coords).length,ambiguousGeographicNames:[...conflicts].sort(),matched:resolved.length,unmatched:missing.length,coverage:physical.length?Number((100*resolved.length/physical.length).toFixed(2)):null,missingStations:missing,groupingNames:groupings};
mkdirSync("diagnostics",{recursive:true});
writeFileSync("diagnostics/station-coverage.json",JSON.stringify(summary,null,2)+"\n");
writeFileSync("diagnostics/station-coverage.md",[
 "# MaxTrip — Audit de couverture GPS", "",
 "Source : catalogue TGV MAX et référentiel SNCF Gares de voyageurs, récupérés en direct.", "",
 "| Indicateur | Valeur |","|---|---:|",
 ...[["Gares distinctes",summary.catalogTotal],["Gares physiques",summary.physical],["Regroupements intramuros",summary.groupings],["Gares physiques reconnues",summary.matched],["Gares physiques non reconnues",summary.unmatched],["Couverture GPS",summary.coverage+" %"],["Noms géographiques ambigus",summary.ambiguousGeographicNames.length]].map(([k,v])=>"| "+k+" | "+v+" |"),
 "","## Gares sans correspondance",...missing.map(x=>"- "+x),
 "","## Noms géographiques ambigus",...summary.ambiguousGeographicNames.map(x=>"- "+x),
 "","## Regroupements intramuros",...groupings.map(x=>"- "+x)
].join("\n")+"\n");
console.log(JSON.stringify({catalog:summary.catalogTotal,matched:summary.matched,missing:summary.unmatched,coverage:summary.coverage,ambiguous:conflicts.size}));
