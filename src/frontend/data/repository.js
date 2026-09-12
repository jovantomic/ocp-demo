const names=['assets','days','prices','sensors','transactions','vessels','events','locations','routes','manifest'];
let cached;
const group=(rows,key)=>{const map=new Map();for(const row of rows){if(!map.has(row[key]))map.set(row[key],[]);map.get(row[key]).push(row);}return map;};
export async function loadRepository(){
 if(cached)return cached;
 cached=(async()=>{
  const entries=await Promise.all(names.map(async name=>{const r=await fetch(`./data/${name}.json`);if(!r.ok)throw Error(`Cannot load ${name}: HTTP ${r.status}`);return[name,await r.json()];}));
  const raw=Object.fromEntries(entries);
  for(const name of names.filter(n=>n!=='manifest'))if(!Array.isArray(raw[name]))throw Error(`${name} must be an array`);
  if(!raw.assets.length||!raw.days.length||!raw.prices.length)throw Error('Assets, days and prices must contain records.');
  for(const [name,count] of Object.entries(raw.manifest.counts))if(raw[name]?.length!==count)throw Error(`Manifest count mismatch: ${name}`);
  const prices=group(raw.prices,'asset_id'),sensors=group(raw.sensors,'location_id'),vessels=group(raw.vessels,'date');
  for(const a of raw.assets){const rows=prices.get(a.id);if(rows?.length!==raw.days.length||rows.some((r,i)=>r.date!==raw.days[i].date||!Number.isFinite(r.close)||r.close<=0))throw Error(`Incomplete or invalid price history for ${a.id}`);}
  const geoResponse=await fetch('./maps/land.geojson');if(!geoResponse.ok)throw Error('Geography could not be loaded');const geography=await geoResponse.json();
  let newsError=null;try{const response=await fetch('./news/articles.json');if(!response.ok)throw Error('News references could not be loaded');const articles=await response.json();if(!Array.isArray(articles)||articles.some(a=>!a.id||!a.date||!a.source||!a.title||!a.summary||!/^https:\/\//.test(a.url)||a.synthetic!==false))throw Error('Invalid news reference data');raw.news=articles;}catch(error){raw.news=[];newsError=error.message;}
  return{raw,geography,names:[...names,'news'],newsError,getNews:cutoff=>raw.news.filter(a=>a.date<=cutoff),getAssets:()=>raw.assets,getManifest:()=>raw.manifest,getMarketHistory:(id,cutoff)=> (prices.get(id)||[]).filter(r=>r.date<=cutoff),getObservations:(id,cutoff)=>(sensors.get(id)||[]).filter(r=>r.date<=cutoff),getEvents:cutoff=>raw.events.filter(r=>r.date<=cutoff),getVessels:cutoff=>vessels.get(cutoff)||[],getRecords:(name,cutoff)=>{const r=raw[name];return Array.isArray(r)?r.filter(x=>!x.date||x.date<=cutoff):[r];}};
 })().catch(error=>{cached=null;throw error;});return cached;
}
