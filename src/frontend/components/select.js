let openMenu=null,serial=0;
function closeMenu(restoreFocus=false){if(!openMenu)return;const {trigger,popover}=openMenu;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');popover.remove();openMenu=null;if(restoreFocus&&trigger.isConnected)trigger.focus({preventScroll:true});}
document.addEventListener('pointerdown',e=>{if(openMenu&&!openMenu.trigger.contains(e.target)&&!openMenu.popover.contains(e.target))closeMenu();});
window.addEventListener('resize',()=>closeMenu());
document.addEventListener('scroll',e=>{if(openMenu&&!openMenu.popover.contains(e.target))closeMenu();},true);
export function enhanceSelects(root){
 closeMenu();
 root.querySelectorAll('select').forEach(select=>{
  if(select.dataset.enhanced)return;
  select.dataset.enhanced='true';
  const label=Array.from(select.labels||[]).map(l=>{const copy=l.cloneNode(true);copy.querySelectorAll('select').forEach(el=>el.remove());return copy.textContent.trim();}).join(' ')||select.getAttribute('aria-label')||'Select an option';
  const wrapper=document.createElement('span');wrapper.className='select-control';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';trigger.id=select.id?select.id+'-trigger':'select-trigger-'+(++serial);trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',label);trigger.disabled=select.disabled;
  const selected=select.options[select.selectedIndex];const caption=document.createElement('span');caption.className='select-value';caption.textContent=selected?.textContent||'Select';trigger.append(caption);trigger.insertAdjacentHTML('beforeend','<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>');
  select.before(wrapper);wrapper.append(select,trigger);select.hidden=true;select.tabIndex=-1;
  let active=select.selectedIndex,typed='',typeTimer;
  function open(){
   closeMenu();const popover=document.createElement('div');popover.className='select-popover';popover.id=trigger.id+'-options';popover.setAttribute('role','listbox');popover.setAttribute('aria-label',label);trigger.setAttribute('aria-controls',popover.id);
   Array.from(select.options).forEach((option,i)=>{const row=document.createElement('div');row.className='select-option';row.id=popover.id+'-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===select.selectedIndex));row.dataset.index=i;if(option.disabled)row.setAttribute('aria-disabled','true');const text=document.createElement('span');text.textContent=option.textContent;row.append(text);if(i===select.selectedIndex)row.insertAdjacentHTML('beforeend','<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>');row.addEventListener('pointerdown',e=>e.preventDefault());row.addEventListener('click',()=>commit(i));row.addEventListener('pointermove',()=>highlight(i,false));popover.append(row);});
   document.body.append(popover);openMenu={trigger,popover};trigger.setAttribute('aria-expanded','true');active=select.selectedIndex;const bounds=trigger.getBoundingClientRect(),width=Math.min(window.innerWidth-24,Math.max(bounds.width,200));popover.style.width=width+'px';popover.style.left=Math.max(12,Math.min(bounds.left,window.innerWidth-width-12))+'px';const height=Math.min(popover.scrollHeight,288);popover.style.top=(bounds.bottom+height+8>window.innerHeight?Math.max(12,bounds.top-height-6):bounds.bottom+6)+'px';highlight(active);
  }
  function highlight(index,scroll=true){if(!openMenu||openMenu.trigger!==trigger)return;active=Math.max(0,Math.min(select.options.length-1,index));const rows=openMenu.popover.children;Array.from(rows).forEach((row,i)=>row.classList.toggle('active',i===active));trigger.setAttribute('aria-activedescendant',rows[active].id);if(scroll)rows[active].scrollIntoView({block:'nearest'});}
  function commit(i){if(select.options[i]?.disabled)return;select.value=select.options[i].value;closeMenu(true);select.dispatchEvent(new Event('change',{bubbles:true}));}
  trigger.addEventListener('click',e=>{e.preventDefault();if(openMenu?.trigger===trigger)closeMenu();else open();});
  trigger.addEventListener('keydown',e=>{
   const isOpen=openMenu?.trigger===trigger;
   if(e.key==='Escape'){if(isOpen){e.preventDefault();closeMenu(true);}return;}
   if(e.key==='Tab'){closeMenu();return;}
   if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)){
    e.preventDefault();if(!isOpen){open();return;}
    if(e.key==='Enter'||e.key===' '){commit(active);return;}
    let next=e.key==='Home'?0:e.key==='End'?select.options.length-1:active+(e.key==='ArrowDown'?1:-1);next=Math.max(0,Math.min(select.options.length-1,next));highlight(next);return;
   }
   if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){e.preventDefault();typed+=e.key.toLowerCase();clearTimeout(typeTimer);typeTimer=setTimeout(()=>{typed='';},700);if(!isOpen)open();const i=Array.from(select.options).findIndex(o=>o.textContent.toLowerCase().startsWith(typed));if(i>=0)highlight(i);}
  });
 });
}
