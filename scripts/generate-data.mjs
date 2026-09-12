import fs from 'node:fs';
const root=new URL('../data/synthetic/',import.meta.url);let seed=20260912;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const round=(v,n=4)=>Number(v.toFixed(n));
const assets=[
{id:'RANCHU',name:'Ranchu · Grade A',category:'Goldfish',unit:'USD / fish',base:185,exposure:1.0,vol:.013,venue:'Osaka ornamental auction · fictional',tag:'JP / SELECT BREED',description:'Standardised adult Ranchu, grade A. Simulated completed sales, not asking prices.'},
{id:'ORANDA',name:'Oranda · Red cap',category:'Goldfish',unit:'USD / fish',base:92,exposure:.75,vol:.011,venue:'Bangkok ornamental exchange · fictional',tag:'TH / RED CAP',description:'Standardised adult red-cap Oranda. All lots, counterparties and prices are synthetic.'},
{id:'RYUKIN',name:'Ryukin · Calico',category:'Goldfish',unit:'USD / fish',base:125,exposure:.6,vol:.016,venue:'Singapore aquatic auction · fictional',tag:'SG / CALICO',description:'Fixed-grade calico Ryukin. Pricing relationships are engineered for interface testing.'},
{id:'PLGC',name:'Pelagic Logistics',category:'Equities',unit:'USD / share',base:64,exposure:.35,vol:.012,venue:'SIMEX · fictional equity',tag:'FICTIONAL COMPANY',description:'Invented logistics company and ticker. No real company exposure or investment recommendation.'},
{id:'AQUA',name:'Aquora Holdings',category:'Equities',unit:'USD / share',base:38,exposure:-.55,vol:.017,venue:'SIMEX · fictional equity',tag:'FICTIONAL COMPANY',description:'Invented ornamental-fish distributor. Supply-cost sensitivity is a simulation assumption.'},
{id:'NAMI',name:'Nami Coldchain',category:'Equities',unit:'USD / share',base:112,exposure:.22,vol:.010,venue:'SIMEX · fictional equity',tag:'FICTIONAL COMPANY',description:'Invented cold-chain operator. Demo-only instrument, with no real issuer.'},
{id:'USDINR',name:'US Dollar / Indian Rupee',category:'FX',unit:'INR / USD',base:84.2,exposure:.04,vol:.0015,venue:'Simulated FX reference',tag:'SYNTHETIC FX',description:'Real currency names, entirely synthetic quotes. Maritime sensitivity is a toy hypothesis.'},
{id:'EURUSD',name:'Euro / US Dollar',category:'FX',unit:'USD / EUR',base:1.085,exposure:-.03,vol:.002,venue:'Simulated FX reference',tag:'SYNTHETIC FX',description:'Synthetic FX series for cross-market exploration. Not a market feed.'}
];
const locations=[
{id:'S01',name:'Kochi approach',lon:76.1,lat:9.8,kind:'ocean',region:'Arabian Sea'},
{id:'S02',name:'Mumbai offshore',lon:72.6,lat:18.5,kind:'ocean',region:'Arabian Sea'},
{id:'S03',name:'Chennai approach',lon:80.6,lat:13.0,kind:'ocean',region:'Bay of Bengal'},
{id:'S04',name:'Colombo corridor',lon:79.6,lat:6.6,kind:'ocean',region:'Indian Ocean'},
{id:'S05',name:'Malacca passage',lon:100.2,lat:3.2,kind:'ocean',region:'Strait of Malacca'},
{id:'S06',name:'Singapore approach',lon:104.1,lat:1.2,kind:'ocean',region:'Singapore Strait'},
{id:'S07',name:'Bangkok supply cluster',lon:100.6,lat:13.7,kind:'supply',region:'Thailand'},
{id:'S08',name:'Osaka auction hub',lon:135.5,lat:34.7,kind:'supply',region:'Japan'},
{id:'S09',name:'Guangzhou breeder cluster',lon:113.3,lat:23.1,kind:'supply',region:'China'},
{id:'S10',name:'Chennai distribution',lon:80.3,lat:13.1,kind:'supply',region:'India'},
{id:'S11',name:'Singapore inventory',lon:103.8,lat:1.35,kind:'supply',region:'Singapore'},
{id:'S12',name:'Taipei ornamental hub',lon:121.5,lat:25.0,kind:'supply',region:'Taiwan'}];
const routes=[{id:'R1',name:'Bangkok → Singapore',from:[100.6,13.7],via:[104,7],to:[103.8,1.35]},{id:'R2',name:'Singapore → Chennai',from:[103.8,1.35],via:[88,2],to:[80.3,13.1]},{id:'R3',name:'Singapore → Osaka',from:[103.8,1.35],via:[127,12],to:[135.5,34.7]},{id:'R4',name:'Guangzhou → Singapore',from:[113.3,23.1],via:[110,12],to:[103.8,1.35]}];
const days=[],prices=[],sensors=[],transactions=[],vessels=[],events=[];let p=assets.map(a=>a.base),pressure=0;
for(let i=0;i<180;i++){
 const date=new Date(Date.UTC(2026,2,17+i)).toISOString().slice(0,10);
 const shock=(i>=70&&i<85?.72:0)+(i>=135&&i<158?.88:0)-(i>=105&&i<120?.65:0);
 pressure=.84*pressure+.16*(shock+.22*Math.sin(i/8))+(rand()-.5)*.13;
 const supply=round(pressure), ocean=round(.45*Math.sin(i/11)+.15*(rand()-.5)),activity=round(.55*pressure+.2*Math.sin(i/6));
 days.push({date,index:i,supply_pressure:supply,ocean_anomaly:ocean,activity_disruption:activity,synthetic:true});
 assets.forEach((a,j)=>{
  const prev=days[Math.max(0,i-1)],r=a.exposure*(prev.supply_pressure*.012+prev.activity_disruption*.004+prev.ocean_anomaly*.001)+(rand()-.5)*a.vol;
  const old=p[j];p[j]=round(old*(1+r),6);prices.push({date,asset_id:a.id,open:round(old),close:round(p[j]),high:round(Math.max(old,p[j])*(1+rand()*.005)),low:round(Math.min(old,p[j])*(1-rand()*.005)),volume:Math.round((a.category==='Goldfish'?100:100000)*(1+rand()*3)),available_at:date+'T18:00:00Z',synthetic:true});
  if(j<3)for(let t=0;t<4;t++)transactions.push({id:`TX-${i}-${j}-${t}`,date,asset_id:a.id,lot_id:`LOT-${i*12+j*4+t}`,grade:j===1?'red-cap-A':'A',size_cm:round(12+rand()*3,1),quantity:5+Math.floor(rand()*25),price_usd:round(p[j]*(.98+rand()*.04),2),status:'completed',venue:a.venue,synthetic:true});
 });
 locations.forEach((l,j)=>sensors.push({date,location_id:l.id,temperature_c:round(27.5+ocean*2+j*.14+(rand()-.5),2),salinity_psu:round(33.9+ocean*.6+(rand()-.5)*.3,2),current_ms:round(.3+rand()*.5,2),chlorophyll_mgm3:round(.4+rand()*1.2,2),inventory_index:round(100-pressure*25+(rand()-.5)*10,1),reporting_delay_hours:Math.round(2+rand()*12),quality:i%31===0&&j===4?'delayed':'nominal',synthetic:true}));
 for(let j=0;j<12;j++)vessels.push({date,id:`SIM-V${String(j+1).padStart(2,'0')}`,name:['Kestrel','Mistral','Aster','Solace'][j%4]+' '+(j+1),route_id:routes[j%4].id,progress:round((i*.037+j*.081)%1),speed_kn:round(11+rand()*5,1),delay_hours:round(Math.max(0,pressure*24+rand()*8),1),synthetic:true});
 if(i%9===0||[70,85,105,135,158].includes(i)) events.push({id:`EV-${i}`,date,severity:pressure>.5?'elevated':'watch',title:pressure>.5?'Breeder inventory tightens':pressure<-.15?'Supply recovery observed':'Regional flow divergence',detail:`Synthetic ${pressure>.5?'supply constraint':'market observation'} across the ornamental supply chain. Scenario evidence, not a real-world incident.`,location_id:locations[6+i%6].id,synthetic:true});
}
const manifest={name:'OCP synthetic research dataset',version:'1.0.0',seed:20260912,synthetic:true,generated_from:'Deterministic toy process; no live providers',start:days[0].date,end:days.at(-1).date,days:days.length,disclosure:'All prices, observations, events, vessels and results are synthetic. Predictive relationships are engineered. No trained model, real alpha, live trade or company endorsement.',counts:{assets:assets.length,days:days.length,prices:prices.length,sensors:sensors.length,transactions:transactions.length,vessels:vessels.length,events:events.length}};
for(const [name,data]of Object.entries({manifest,assets,locations,routes,days,prices,sensors,transactions,vessels,events}))fs.writeFileSync(new URL(name+'.json',root),JSON.stringify(data,null,2));
console.log(manifest.counts);
