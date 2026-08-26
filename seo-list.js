const $=s=>document.querySelector(s);
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));
const platformLabel=p=>p==='Twitter'?'X / Twitter':p;
const page=document.body.dataset;
let items=[];
function eligible(x){
  if(page.platform&&x.platform!==page.platform)return false;
  if(page.kind&&x.kind!==page.kind)return false;
  if(page.maxPrice&&Number(x.sale_price)>Number(page.maxPrice))return false;
  return true;
}
function render(){
  const q=($('#seoSearch')?.value||'').trim().toLowerCase().replace(/^@/,'');
  const filtered=items.filter(eligible).filter(x=>!q||x.handle.toLowerCase().replace(/^@/,'').includes(q));
  $('#seoCount').textContent=filtered.length.toLocaleString();
  $('#seoGrid').innerHTML=filtered.length?filtered.slice(0,96).map(x=>`<article class="seo-card"><div><span class="platform-badge">${esc(platformLabel(x.platform))}</span> <span class="type-badge">${esc(x.kind==='Word'?'WORD':x.kind)}</span></div><div class="seo-handle">${esc(x.handle)}</div><div class="seo-price">${money(x.sale_price)}</div><div class="seo-card-footer"><span class="type-badge">AVAILABLE</span><a href="/?q=${encodeURIComponent(x.handle)}#market">View listing</a></div></article>`).join(''):'<div class="loading-state">No available usernames match this page right now.</div>';
  const list=filtered.slice(0,20).map((x,i)=>({"@type":"ListItem",position:i+1,name:x.handle,url:`https://mikyemedia.com/?q=${encodeURIComponent(x.handle)}#market`}));
  const ld=document.getElementById('itemListJson');if(ld)ld.textContent=JSON.stringify({"@context":"https://schema.org","@type":"ItemList",name:document.querySelector('h1')?.textContent||'Available usernames',numberOfItems:filtered.length,itemListElement:list});
}
async function load(){
  try{const r=await fetch('/api/inventory',{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Could not load inventory');items=j.items||[];render()}catch(e){$('#seoGrid').innerHTML=`<div class="loading-state">${esc(e.message)}</div>`;$('#seoCount').textContent='—'}
}
$('#seoSearch')?.addEventListener('input',render);
load();
