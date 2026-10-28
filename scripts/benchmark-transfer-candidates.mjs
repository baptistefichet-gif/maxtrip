import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const base = "http://127.0.0.1:3145", date = "2026-10-29";
const scenarios = [
  { name: "Paris Explorer", origin: "PARIS (intramuros)", options: {}, order: [64,128] },
  { name: "Lyon Explorer", origin: "LYON (intramuros)", options: {}, order: [128,64] },
  { name: "Paris avec retour", origin: "PARIS (intramuros)", options: {returnRequired:"true",returnDate:"2026-10-30",returnStart:"18:00",returnEnd:"23:00"}, order:[64,128] }
];
const results=[];
mkdirSync("diagnostics",{recursive:true});
async function start(cap) {
  const p=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3145"],{env:{...process.env,MAXTRIP_BENCH_FIRST_HOP:String(cap),NEXT_TELEMETRY_DISABLED:"1"},stdio:["ignore","pipe","pipe"]});
  let log="";
  for (const stream of [p.stdout,p.stderr]) stream.on("data",chunk=>{log=(log+chunk).slice(-3000)});
  for(let i=0;i<60;i++){
    if(p.exitCode!==null) throw Error("Next exited: "+log);
    try{if((await fetch(base,{signal:AbortSignal.timeout(1500)})).ok)return p;}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  p.kill();throw Error("Next startup timeout: "+log);
}
async function stop(p){
  if(p.exitCode!==null)return;
  p.kill("SIGTERM");
  await Promise.race([new Promise(r=>p.once("exit",r)),new Promise(r=>setTimeout(r,3000))]);
  if(p.exitCode===null)p.kill("SIGKILL");
}
for(const scenario of scenarios){
  for(const cap of scenario.order){
    rmSync(".next/cache/fetch-cache",{recursive:true,force:true});
    const result={scenario:scenario.name,cap};
    let server;
    const t=Date.now();
    try{
      server=await start(cap);
      const url=new URL(base+"/api/itineraries");
      const params={date,origine:scenario.origin,start:"08:00",end:"24:00",maxChanges:"1",minWait:"20",maxWait:"90",routeType:"all",...scenario.options};
      for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
      const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(100000)});
      const data=await response.json();
      const routes=Array.isArray(data.routes)?data.routes:[];
      Object.assign(result,{status:response.status,routeCount:routes.length,connections:routes.filter(r=>r.changes>0).length,destinations:new Set(routes.map(r=>r.destination)).size,returns:routes.reduce((n,r)=>n+(r.returns?.length??0),0),recordsLoaded:data.recordsLoaded??null,sourceCount:data.sourceCount??null,truncated:data.truncated??null,reasons:data.truncationReasons??[],keys:routes.map(r=>r.key),error:data.error??null});
    }catch(e){result.error=String(e);}
    finally{result.elapsedMs=Date.now()-t;if(server)await stop(server);}
    results.push(result);console.log(JSON.stringify({...result,keys:undefined}));
  }
}
writeFileSync("diagnostics/transfer-benchmark.json",JSON.stringify({date,results},null,2));
const lines=["## Comparaison réelle : 64 vs 128 gares","", "Date des trajets : "+date+". Cache SNCF local vidé avant chaque requête. Un seul essai par scénario et configuration.","","| Scénario | Limite | HTTP | Durée | Trajets | Avec correspondance | Destinations | Retours | Données | Partiel |","|---|---:|---:|---:|---:|---:|---:|---:|---:|---|"];
for(const x of results)lines.push("| "+x.scenario+" | "+x.cap+" | "+(x.status??"échec")+" | "+x.elapsedMs+" ms | "+(x.routeCount??"?")+" | "+(x.connections??"?")+" | "+(x.destinations??"?")+" | "+(x.returns??"?")+" | "+(x.recordsLoaded??"?")+" | "+(x.truncated===undefined||x.truncated===null?"inconnu":x.truncated?"oui":"non")+" |");
lines.push("","### Différences");
for(const s of scenarios){
  const a=results.find(x=>x.scenario===s.name&&x.cap===64),b=results.find(x=>x.scenario===s.name&&x.cap===128);
  const set=new Set(a.keys??[]),extra=(b.keys??[]).filter(k=>!set.has(k));
  lines.push("- **"+s.name+"** : "+(a.routeCount??"?")+" → "+(b.routeCount??"?")+" trajets, "+a.elapsedMs+" → "+b.elapsedMs+" ms, "+extra.length+" nouveaux identifiants de trajets à 128.");
  if(a.error||b.error)lines.push("  - Erreurs : "+[a.error,b.error].filter(Boolean).join("; "));
  if(a.reasons?.length||b.reasons?.length)lines.push("  - Limites 64 : "+(a.reasons??[]).join(" / ")+" ; limites 128 : "+(b.reasons??[]).join(" / "));
}
lines.push("","### Réserves","- Mesures ponctuelles : variabilité de l'API SNCF et effet de l'ordre des requêtes.","- Les plafonds de 5 000 enregistrements et 400 itinéraires restent inchangés.","- 128 ne garantit pas des résultats exhaustifs.","- Aucune modification de la production par ce test.");
writeFileSync("diagnostics/transfer-benchmark.md",lines.join("\n")+"\n");
console.log(lines.join("\n"));
