import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRepository} from '../src/frontend/data/repository.js';
import {forecastRows,eventRows} from '../src/frontend/views/predictions.js';
const previousFetch=globalThis.fetch;
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL('../'+(url.startsWith('./data/')?'data/synthetic/'+url.slice(7):url.startsWith('./news/')?'data/external/articles.json':'public/maps/land.geojson'),import.meta.url)))});
const repo=await loadRepository();
globalThis.fetch=previousFetch;
const state={index:78,enabled:{supply:true,activity:true,ocean:true},scenario:'baseline',category:'all',direction:'all',movement:0,forecastSearch:'',sort:'movement',eventType:'all'};
const date=repo.raw.days[state.index].date;
test('interest filters compose and sorting follows calculated projections',()=>{
 const all=forecastRows(repo,state,date);assert.equal(all.length,8);assert.ok(all.every((r,i)=>!i||Math.abs(all[i-1].result.expected)>=Math.abs(r.result.expected)));
 const equities=forecastRows(repo,{...state,category:'Equities',direction:'SELL'},date);assert.equal(equities.length,1);assert.equal(equities[0].asset.id,'AQUA');
 const fish=forecastRows(repo,{...state,category:'Goldfish',movement:3},date);assert.equal(fish.length,3);
 assert.equal(forecastRows(repo,{...state,forecastSearch:'rAnCHu'},date)[0].asset.id,'RANCHU');
 assert.deepEqual(forecastRows(repo,{...state,category:'FX',movement:3},date),[]);
 assert.ok(all.every(r=>r.result.series.every(p=>p.date<=date)));
});
test('event feed derives completed sales from transactions and never exposes future records',()=>{
 const events=eventRows(repo,state,date);assert.ok(events.every(e=>e.date<=date));
 const sale=events.find(e=>e.asset==='RANCHU');const tx=repo.raw.transactions.filter(t=>t.asset_id==='RANCHU'&&t.date===date);const quantity=tx.reduce((s,t)=>s+t.quantity,0);assert.ok(sale.title.startsWith(String(quantity)+' Ranchu'));assert.match(sale.origin,/Synthetic/);
 const news=eventRows(repo,{...state,eventType:'News'},date);assert.equal(news.length,3);assert.ok(news.every(e=>e.synthetic===false&&e.external&&e.date<=date));assert.ok(!news.some(e=>e.id==='news-ap-20260617'));assert.equal(eventRows(repo,{...state,eventType:'News'},'2026-06-17').length,4);
 const ocean=eventRows(repo,{...state,eventType:'Ocean'},date);assert.equal(ocean.length,2);assert.ok(ocean.every(e=>e.type==='Ocean'&&repo.raw.locations.some(l=>l.id===e.location&&l.kind==='ocean')));
 const earlier=eventRows(repo,{...state,index:0},repo.raw.days[0].date);assert.ok(earlier.every(e=>e.date===repo.raw.days[0].date));
});
