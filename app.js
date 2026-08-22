const state={items:[],platform:'all',kind:'all',sort:'price-asc',query:'',selected:null,paymentMethod:null,config:null,visible:48};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const platformLabel=p=>p==='Twitter'?'X / Twitter':p;
const platformClass=p=>({Instagram:'ig',TikTok:'tt',Twitter:'tw',Snapchat:'sc'})[p]||'';

async function load(){
  try{
    const [inv,cfg]=await Promise.all([fetch('/api/inventory',{cache:'no-store'}).then(r=>r.json()),fetch('/api/config',{cache:'no-store'}).then(r=>r.json())]);
    if(!inv.ok)throw new Error(inv.error||'Could not load inventory');
    state.items=inv.items||[];state.config=cfg;$('#statTotal').textContent=state.items.length.toLocaleString();renderFeatured();render();
  }catch(e){$('#inventoryGrid').innerHTML=`<div class="loading-state">${esc(e.message)}</div>`;$('#statTotal').textContent='—'}
}
function filtered(){
  let a=[...state.items];
  if(state.platform!=='all')a=a.filter(x=>x.platform===state.platform);
  if(state.kind!=='all')a=a.filter(x=>state.kind==='Word'?(x.kind==='Word'||x.kind==='5+') : x.kind===state.kind);
  const q=state.query.trim().toLowerCase().replace(/^@/,'');
  if(q)a=a.filter(x=>x.handle.toLowerCase().replace(/^@/,'').includes(q));
  if(state.sort==='price-asc')a.sort((x,y)=>Number(x.sale_price)-Number(y.sale_price));
  if(state.sort==='price-desc')a.sort((x,y)=>Number(y.sale_price)-Number(x.sale_price));
  if(state.sort==='handle')a.sort((x,y)=>x.handle.localeCompare(y.handle));
  return a;
}
function render(){
  const a=filtered();$('#resultCount').textContent=a.length.toLocaleString();
  const shown=a.slice(0,state.visible);
  $('#inventoryGrid').innerHTML=shown.length?shown.map(card).join(''):'<div class="loading-state">No handles match those filters.</div>';
  $$('[data-buy]').forEach(b=>b.onclick=()=>openCheckout(Number(b.dataset.buy)));
  const more=$('#loadMore');more.hidden=a.length<=state.visible;more.textContent=`Load more (${Math.min(48,a.length-state.visible).toLocaleString()})`;
}
function card(x,featured=false){
  const rare=['2L','3L'].includes(x.kind)||Number(x.sale_price)>=1000;
  return `<article class="${featured?'featured-card':'handle-card'}"><div class="card-top"><div><span class="platform-badge ${platformClass(x.platform)}">${esc(platformLabel(x.platform))}</span> <span class="type-badge">${esc(x.kind==='Word'?'WORD':x.kind)}</span></div>${rare?'<span class="rare-badge">RARE</span>':''}</div><div class="handle">${esc(x.handle)}</div><div class="price">${money(x.sale_price)}</div><div class="card-bottom"><span class="type-badge">AVAILABLE</span><button class="buy-btn" data-buy="${x.id}">Buy now</button></div></article>`
}
function renderFeatured(){
  let pool=state.items.filter(x=>['2L','3L','Word'].includes(x.kind)||Number(x.sale_price)>=900);
  pool.sort((a,b)=>{const ak=a.kind==='2L'?5:a.kind==='3L'?4:a.kind==='Word'?3:1;const bk=b.kind==='2L'?5:b.kind==='3L'?4:b.kind==='Word'?3:1;return bk-ak||Number(a.sale_price)-Number(b.sale_price)});
  const picks=[];const used=new Set();for(const x of pool){if(!used.has(x.platform)){picks.push(x);used.add(x.platform)}if(picks.length===3)break}for(const x of pool){if(picks.length===3)break;if(!picks.includes(x))picks.push(x)}
  $('#featuredGrid').innerHTML=picks.length?picks.map(x=>card(x,true)).join(''):'<div class="loading-state">Featured inventory will appear here.</div>';
  $$('[data-buy]').forEach(b=>b.onclick=()=>openCheckout(Number(b.dataset.buy)));
}
function resetAndRender(){state.visible=48;render()}
$$('#platformFilters button').forEach(b=>b.onclick=()=>{$$('#platformFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.platform=b.dataset.platform;resetAndRender()});
$$('#kindFilters button').forEach(b=>b.onclick=()=>{$$('#kindFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.kind=b.dataset.kind;resetAndRender()});
$('#sortSelect').onchange=e=>{state.sort=e.target.value;resetAndRender()};
$('#marketSearch').oninput=e=>{state.query=e.target.value;resetAndRender()};
$('#clearSearch').onclick=()=>{$('#marketSearch').value='';state.query='';resetAndRender()};
$('#loadMore').onclick=()=>{state.visible+=48;render()};
function runHeroSearch(){const q=$('#heroSearch').value.trim();$('#marketSearch').value=q;state.query=q;state.visible=48;render();document.querySelector('#market').scrollIntoView({behavior:'smooth',block:'start'})}
$('#heroSearchBtn').onclick=runHeroSearch;$('#heroSearch').addEventListener('keydown',e=>{if(e.key==='Enter')runHeroSearch()});

function openCheckout(id){state.selected=state.items.find(x=>Number(x.id)===Number(id));state.paymentMethod=null;if(!state.selected)return;$('#checkoutHandle').textContent=state.selected.handle;$('#checkoutMeta').textContent=`${platformLabel(state.selected.platform)} · ${state.selected.kind}`;$('#checkoutPrice').textContent=money(state.selected.sale_price);$('#checkoutStatus').className='status';$('#checkoutStatus').textContent='';$('#checkoutForm').reset();$('#submitOrder').style.display='block';renderPayments();$('#checkoutModal').showModal()}
function renderPayments(){const c=state.config?.payments||{};const defs=[['cashapp','Cash App'],['zelle','Zelle'],['paypal','PayPal'],['crypto','Crypto']];$('#paymentMethods').innerHTML=defs.map(([k,n])=>`<button type="button" class="payment-method" data-pay="${k}" ${c[k]?.enabled?'':'disabled'}>${n}</button>`).join('');$('#paymentInstructions').textContent='Choose a payment method.';$$('[data-pay]').forEach(b=>b.onclick=()=>{state.paymentMethod=b.dataset.pay;$$('[data-pay]').forEach(x=>x.classList.remove('active'));b.classList.add('active');showInstructions()})}
function showInstructions(){const p=state.config?.payments?.[state.paymentMethod],amt=money(state.selected.sale_price);if(!p)return;let t='';if(state.paymentMethod==='cashapp')t=`Send exactly ${amt} to ${p.to}. Add ${state.selected.handle} in the note if possible.`;if(state.paymentMethod==='zelle')t=`Send exactly ${amt} by Zelle to ${p.to}. Recipient: ${p.name||'listed recipient'}.`;if(state.paymentMethod==='paypal')t=`Send exactly ${amt} to ${p.to}. Keep your PayPal transaction ID.`;if(state.paymentMethod==='crypto')t=`Send the USD-equivalent of ${amt} using ${p.network}: ${p.address}. Confirm the network before sending and paste the transaction hash below.`;$('#paymentInstructions').textContent=t}
$('#checkoutForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.paymentMethod){setStatus('Choose a payment method first.',false);return}const btn=$('#submitOrder');btn.disabled=true;btn.textContent='Submitting…';setStatus('Creating your order…',true);try{const payload={inventoryId:state.selected.id,email:$('#buyerEmail').value.trim(),paymentMethod:state.paymentMethod,payerName:$('#payerName').value.trim(),paymentRef:$('#paymentRef').value.trim(),note:$('#buyerNote').value.trim()};const r=await fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Order could not be created');$('#checkoutStatus').className='status ok';$('#checkoutStatus').innerHTML=`<div><div>Order submitted. Save this order ID:</div><div class="order-id">${esc(j.orderId)}</div><p>Payment still requires manual verification.</p></div>`;btn.style.display='none';await refreshInventory()}catch(err){setStatus(err.message,false)}finally{btn.disabled=false;btn.textContent='Submit order for verification'}});
function setStatus(msg,ok){const el=$('#checkoutStatus');el.className='status '+(ok?'ok':'err');el.textContent=msg}
async function refreshInventory(){try{const inv=await fetch('/api/inventory',{cache:'no-store'}).then(r=>r.json());if(inv.ok){state.items=inv.items;$('#statTotal').textContent=state.items.length.toLocaleString();renderFeatured();render()}}catch{}}
$('#openOrders').onclick=()=>{$('#trackResult').textContent='';$('#trackModal').showModal()};
$('#trackBtn').onclick=async()=>{const id=$('#trackOrderId').value.trim(),el=$('#trackResult');if(!id)return;el.textContent='Checking…';el.className='status';try{const r=await fetch('/api/status?orderId='+encodeURIComponent(id),{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Order not found');el.className='status ok';el.innerHTML=`<span class="pill">${esc(j.status)}</span> &nbsp; ${esc(j.handle)}<br>${j.message?esc(j.message):''}`}catch(e){el.className='status err';el.textContent=e.message}};
load();
