export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function signal(asset,days,prices,index,enabled={supply:true,activity:true,ocean:true},scenario='baseline'){
 const d=days[index],series=prices.filter(p=>p.asset_id===asset.id&&p.date<=d.date),last=series.at(-1),prev=series.at(-2)||last;
 const modifiers={baseline:[0,0,0],constraint:[.45,.18,0],recovery:[-.5,-.18,0],weather:[0,.25,.8]}[scenario]||[0,0,0];
 const factors=[{id:'supply',label:'Breeder inventory',value:d.supply_pressure+modifiers[0],coefficient:.012},{id:'activity',label:'Transport disruption',value:d.activity_disruption+modifiers[1],coefficient:.004},{id:'ocean',label:'Ocean context',value:d.ocean_anomaly+modifiers[2],coefficient:.001}].map(f=>({...f,contribution:enabled[f.id]?f.value*f.coefficient*asset.exposure:0,enabled:!!enabled[f.id]}));
 const daily=factors.reduce((s,f)=>s+f.contribution,0),expected=100*((1+daily)**7-1),band=asset.vol*Math.sqrt(7)*100;
 return{asset_id:asset.id,date:d.date,price:last.close,change:(last.close/prev.close-1)*100,expected,lower:expected-band,upper:expected+band,stance:expected>1?'BUY':expected< -1?'SELL':'HOLD',factors,series,synthetic:true};
}
export function backtest(asset,days,prices,index,enabled={supply:true,activity:true,ocean:true},costBps=15){
 const rows=prices.filter(p=>p.asset_id===asset.id),curve=[];let equity=100000,benchmark=100000,position=0,trades=0,costs=0,peak=100000,maxDrawdown=0;const ledger=[];
 for(let i=1;i<=index;i++){
  const s=signal(asset,days,prices,i-1,enabled),next=s.stance==='BUY'?1:0; // Long/cash: SELL liquidates; never shorts physical fish.
  const turn=Math.abs(next-position),cost=equity*turn*costBps/10000,ret=rows[i].close/rows[i-1].close-1;
  if(turn){ledger.push({date:days[i-1].date,action:next?'BUY':'SELL',price:rows[i-1].close,cost,reason:'Previous close signal; synthetic fill'});trades++;}
  const net=equity-cost;equity=net*(1+next*ret);costs+=cost;position=next;benchmark*=1+ret;peak=Math.max(peak,equity);maxDrawdown=Math.min(maxDrawdown,(equity/peak-1)*100);
  curve.push({date:days[i].date,equity,benchmark});
 }
 return{curve,equity,benchmark,costs,trades,maxDrawdown,ledger,returnPct:(equity/100000-1)*100,synthetic:true};
}
export function chartPoints(values,width,height,min=null,max=null){const lo=min??Math.min(...values),hi=max??Math.max(...values),range=hi-lo||1;return values.map((v,i)=>[i/(values.length-1||1)*width,height-(v-lo)/range*height]);}
