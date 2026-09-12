export const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
export const pct=v=>`${v>=0?'+':''}${num(v)}%`;
export const tone=v=>v>0?'positive':v<0?'negative':'muted';
export const dateLabel=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const icon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" aria-hidden="true">${path}</svg>`;
export const icons={
 intelligence:icon('<path d="M3 19V5m0 14h18M6 15l4-5 4 3 6-8"/>'),
 lab:icon('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M9 3v6m7 0v6M8 15v6" stroke-width="3"/>'),
 portfolio:icon('<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>'),
 data:icon('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>')
};
export function button(label,action,extra=''){return `<button data-action="${action}" ${extra}>${label}</button>`;}
export function metric(label,value,sub='',cls=''){return `<div class="metric"><span>${label}</span><strong class="${cls}">${value}</strong><small>${sub}</small></div>`;}
export function spark(rows){const values=rows.map(r=>r.close),lo=Math.min(...values),range=Math.max(...values)-lo||1;return `<svg class="spark" viewBox="0 0 80 26" aria-hidden="true"><path d="${values.map((v,i)=>`${i?'L':'M'}${i/(values.length-1||1)*80},${24-(v-lo)/range*22}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;}
export function download(name,data,type='application/json'){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function table(rows,fields){if(!rows.length)return '<div class="empty">No records available at this replay cutoff.</div>';return `<div class="table-scroll"><table><thead><tr>${fields.map(f=>`<th>${esc(f)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${fields.map(f=>`<td>${esc(typeof r[f]==='object'?JSON.stringify(r[f]):r[f])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
