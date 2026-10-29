import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const port=3158,base="http://127.0.0.1:"+port;
const routes=[
 {key:"lyon-direct",origin:"PARIS (intramuros)",destination:"LYON PART DIEU",departure:"09:00",arrival:"11:00",departureMinutes:540,arrivalMinutes:660,durationMinutes:120,changes:0,returns:[],legs:[{origine:"PARIS (intramuros)",destination:"LYON PART DIEU",heure_depart:"09:00",heure_arrivee:"11:00",train_no:"1234",od_happy_card:"OUI"}]},
 {key:"lyon-evening",origin:"PARIS (intramuros)",destination:"LYON PART DIEU",departure:"16:00",arrival:"18:00",departureMinutes:960,arrivalMinutes:1080,durationMinutes:120,changes:0,returns:[],legs:[{origine:"PARIS (intramuros)",destination:"LYON PART DIEU",heure_depart:"16:00",heure_arrivee:"18:00",train_no:"5678",od_happy_card:"OUI"}]}
];
mkdirSync("diagnostics/map-screenshots",{recursive:true});
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{stdio:"ignore"});
const failures=[];
try{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw Error("Next.js server failed to start");
 for(const [name,browserType] of [["chromium",chromium],["webkit",webkit]]){
  const browser=await browserType.launch({headless:true});
  try{
   for(const width of [320,375,390,768,1024,1280,1920]){
    const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
    page.setDefaultTimeout(8000);
    try{
     await page.route("**/api/stations",route=>route.fulfill({json:{origins:["PARIS (intramuros)"],destinations:["LYON PART DIEU"]}}));
     await page.route("**/api/station-coordinates",route=>route.fulfill({json:{coordinates:{"LYON PART DIEU":{lat:45.7606,lon:4.8619}}}}));
     await page.route("**/api/itineraries?*",route=>route.fulfill({json:{routes,sourceCount:2,truncated:false,fetched_at:new Date().toISOString()}}));
     await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
     await page.locator("#origin-station").fill("PARIS");
     await page.getByRole("option",{name:"PARIS (intramuros)"}).click();
     await page.getByRole("button",{name:"Explorer les destinations"}).click();
     await page.getByRole("button",{name:"Agrandir la carte"}).click();
     const dialog=page.getByRole("dialog",{name:"Carte agrandie des destinations"});
     await dialog.waitFor({state:"visible"});
     await dialog.screenshot({path:"diagnostics/map-screenshots/"+name+"-"+width+"-destinations.png"});
     const sidebar=dialog.getByRole("complementary",{name:"Destinations disponibles"});
     await sidebar.getByRole("button",{name:/Lyon/}).click();
     const trips=dialog.getByRole("complementary",{name:"Trajets vers Lyon"});
     await trips.getByRole("button",{name:/09:00.*11:00/}).click();
     await trips.getByText("Détail de l'itinéraire").waitFor();
     await trips.getByText("1234").waitFor();
     await dialog.screenshot({path:"diagnostics/map-screenshots/"+name+"-"+width+"-selected.png"});
     const zoom=dialog.locator(".leaflet-control-zoom");
     const z=await zoom.boundingBox(),p=await trips.boundingBox();
     if(!z||!p)throw Error("Missing zoom controls or sidebar");
     if(z.x<p.x+p.width&&z.x+z.width>p.x&&z.y<p.y+p.height&&z.y+z.height>p.y)throw Error("Zoom controls overlap sidebar");
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
     if(overflow)throw Error("Horizontal overflow");
     await trips.getByRole("button",{name:/09:00.*11:00/}).click();
     if(await trips.getByText("Détail de l'itinéraire").count())throw Error("Trip did not deselect");
     await dialog.getByRole("button",{name:"Réduire la carte"}).click();
     if(await dialog.isVisible())throw Error("Dialog did not close");
     console.log("PASS",name,width);
    }catch(e){failures.push({browser:name,width,error:String(e)});console.error("FAIL",name,width,String(e));}
    finally{await page.close();}
   }
  }finally{await browser.close();}
 }
}finally{server.kill("SIGTERM");}
writeFileSync("diagnostics/map-browser-results.json",JSON.stringify({failures},null,2));
if(failures.length)process.exitCode=1;
