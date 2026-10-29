import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const base="http://127.0.0.1:3153", date="2026-10-30", returnDate="2026-10-31";
const stations=["PARIS (intramuros)","LYON (intramuros)","MARSEILLE ST CHARLES"];
const results=[]; mkdirSync("diagnostics",{recursive:true});
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3153"],{stdio:["ignore","pipe","pipe"]});
let logs=""; for(const stream of [server.stdout,server.stderr])stream.on("data",c=>logs=(logs+String(c)).slice(-5000));
try {
 let ready=false;
 for(let i=0;i<60;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(1200)})).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error("Next startup failed: "+logs);
 for(const origin of stations)for(const withReturn of [false,true]){
  const url=new URL(base+"/api/itineraries");
  const params={date,origine:origin,start:"08:00",end:"24:00",maxChanges:"1",minWait:"20",maxWait:"90",routeType:"all",...(withReturn?{returnRequired:"true",returnDate,returnStart:"08:00",returnEnd:"24:00"}:{})};
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  const t=Date.now(),item={origin,withReturn};
  try{
   const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(90000)});
   const data=await response.json(); const routes=Array.isArray(data.routes)?data.routes:[];
   Object.assign(item,{status:response.status,elapsedMs:Date.now()-t,routeCount:routes.length,connections:routes.filter(r=>r.changes>0).length,destinations:new Set(routes.map(r=>r.destination)).size,truncated:data.truncated??null,overSevenHours:routes.filter(r=>r.durationMinutes>420).length,overSevenHourReturns:routes.flatMap(r=>r.returns??[]).filter(r=>r.durationMinutes>420).length,invalidReturns:routes.filter(r=>withReturn&&!r.returns?.length).length,error:data.error??null});
  }catch(e){item.error=String(e);item.elapsedMs=Date.now()-t;}
  results.push(item);console.log(JSON.stringify(item));
 }
}finally{server.kill("SIGTERM");}
writeFileSync("diagnostics/relevance-live-six.json",JSON.stringify(results,null,2));
const lines=["# Six recherches SNCF reelles : Paris, Lyon, Marseille","","Date aller : "+date+" ; retour : "+returnDate+". Un essai par cas.","","| Origine | Retour | HTTP | Temps (ms) | Trajets | Correspondances | Destinations | >7h | Retours >7h | Partiel |","|---|---|---:|---:|---:|---:|---:|---:|---:|---|"];
for(const x of results)lines.push("| "+x.origin+" | "+(x.withReturn?"oui":"non")+" | "+(x.status??"erreur")+" | "+x.elapsedMs+" | "+(x.routeCount??"?")+" | "+(x.connections??"?")+" | "+(x.destinations??"?")+" | "+(x.overSevenHours??"?")+" | "+(x.overSevenHourReturns??"?")+" | "+(x.truncated===null?"inconnu":x.truncated?"oui":"non")+" |");
lines.push("","Un resultat partiel ne garantit pas la couverture de toutes les destinations.");
for(const x of results.filter(x=>x.error))lines.push("- "+x.origin+" retour="+x.withReturn+" : "+x.error);
writeFileSync("diagnostics/relevance-live-six.md",lines.join("\n")+"\n");
if(results.some(x=>x.status!==200||x.overSevenHours||x.overSevenHourReturns||x.invalidReturns))process.exitCode=1;
