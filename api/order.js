const {sb,telegram,sendEmail,html,methodLabel,env}=require('../lib/server');
const validMethods=new Set(['cashapp','zelle','paypal','crypto']);
function orderKeyboard(id){const base=(env('SITE_URL',false)||'https://mikyemedia.com').replace(/\/$/,'');return {inline_keyboard:[[{text:'💰 Mark paid',callback_data:`paid:${id}`},{text:'🔄 Refresh',callback_data:`refresh:${id}`}],[{text:'📦 Mark secured',callback_data:`secured:${id}`},{text:'❌ Release',callback_data:`releaseask:${id}`}],[{text:'✉️ Open fulfillment',url:`${base}/admin.html?order=${encodeURIComponent(id)}`}]]}}
async function createOrder(b){
  const params={p_inventory_id:b.inventoryId,p_buyer_email:b.email,p_payment_method:b.paymentMethod,p_payer_name:b.payerName,p_payment_ref:b.paymentRef,p_buyer_note:b.note,p_promo_token:b.promoToken||null};
  try{return await sb('rpc/create_order_v2',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(params)})}
  catch(e){
    const msg=String(e.message||'').toLowerCase();
    if(b.promoToken)throw e;
    if(!msg.includes('create_order_v2'))throw e;
    return sb('rpc/create_order',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_inventory_id:b.inventoryId,p_buyer_email:b.email,p_payment_method:b.paymentMethod,p_payer_name:b.payerName,p_payment_ref:b.paymentRef,p_buyer_note:b.note})});
  }
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const b=req.body||{};
    const data={inventoryId:Number(b.inventoryId),email:String(b.email||'').trim().toLowerCase(),paymentMethod:String(b.paymentMethod||''),payerName:String(b.payerName||'').trim(),paymentRef:String(b.paymentRef||'').trim(),note:String(b.note||'').trim(),promoToken:b.promoToken?String(b.promoToken).trim():null};
    if(!data.inventoryId||!/^\S+@\S+\.\S+$/.test(data.email)||!validMethods.has(data.paymentMethod)||data.payerName.length<2||data.paymentRef.length<2)return res.status(400).json({ok:false,error:'Please complete all required checkout fields.'});
    if(data.note.length>500||data.payerName.length>100||data.paymentRef.length>160)return res.status(400).json({ok:false,error:'One or more fields are too long.'});
    const out=await createOrder(data);const o=Array.isArray(out)?out[0]:out;if(!o)throw new Error('Could not create order');
    const listPrice=Number(o.list_price??o.sale_price);const discount=Number(o.discount_amount||0);const finalAmount=Number(o.sale_amount??o.sale_price);const profit=finalAmount-Number(o.cost);const promoLine=discount>0?`\n<b>Launch discount:</b> -$${discount.toFixed(2)} (${html(o.discount_code||'LAUNCH15')})\n<b>Customer pays:</b> $${finalAmount.toFixed(2)}`:'';
    const alert=`🛒 <b>NEW HANDLE ORDER</b>\n\n<b>Order:</b> ${html(o.public_id)}\n<b>Handle:</b> ${html(o.handle)} (${html(o.platform)} ${html(o.kind)})\n<b>Supplier:</b> ${html(o.source)}\n<b>Your cost:</b> $${Number(o.cost).toFixed(2)}\n<b>List price:</b> $${listPrice.toFixed(2)}${promoLine}\n<b>Gross profit:</b> $${profit.toFixed(2)}\n\n<b>Payment:</b> ${html(methodLabel(data.paymentMethod))}\n<b>Sender:</b> ${html(data.payerName)}\n<b>Reference:</b> ${html(data.paymentRef)}\n<b>Buyer:</b> ${html(data.email)}${data.note?`\n<b>Note:</b> ${html(data.note)}`:''}\n\n⏳ <b>Stage:</b> Awaiting payment verification\n⚠️ Check the payment independently before pressing Mark paid.`;
    await telegram(alert,{reply_markup:orderKeyboard(o.public_id)}).catch(()=>false);
    const discountEmail=discount>0?`<br><b>Launch discount:</b> -$${discount.toFixed(2)} (${html(o.discount_code||'LAUNCH15')})`:'';
    await sendEmail({to:data.email,subject:`Order ${o.public_id} received — ${o.handle}`,htmlBody:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111"><h2>Order received</h2><p>Your order for <b>${html(o.handle)}</b> has been submitted.</p><p><b>Order ID:</b> ${html(o.public_id)}${discountEmail}<br><b>Amount to verify:</b> $${finalAmount.toFixed(2)}<br><b>Status:</b> Awaiting payment verification</p><p>This email does not mean payment has been approved. The payment will be checked manually before fulfillment.</p><p style="color:#666;font-size:12px">Mikye Media · mikyemedia.com</p></div>`,textBody:`Mikye Media\n\nOrder received\n\nHandle: ${o.handle}\nOrder ID: ${o.public_id}${discount>0?`\nLaunch discount: -$${discount.toFixed(2)} (${o.discount_code||'LAUNCH15'})`:''}\nAmount to verify: $${finalAmount.toFixed(2)}\nStatus: Awaiting payment verification\n\nThis email does not mean payment has been approved. Payment will be checked manually before fulfillment.\n\nmikyemedia.com`}).catch(()=>null);
    return res.status(200).json({ok:true,orderId:o.public_id,reservedUntil:o.reserved_until,finalAmount,discountAmount:discount,discountCode:o.discount_code||null});
  }catch(e){
    const msg=String(e.message||'');
    if(msg.includes('ITEM_NOT_AVAILABLE'))return res.status(409).json({ok:false,error:'That handle is no longer available.'});
    if(msg.includes('PROMO_EXPIRED'))return res.status(409).json({ok:false,error:'Your LAUNCH15 hold expired. Apply the code again before submitting.'});
    if(msg.includes('PROMO_PRICE_CHANGED'))return res.status(409).json({ok:false,error:'The listing price changed. Reapply LAUNCH15 before submitting.'});
    if(msg.toLowerCase().includes('create_order_v2'))return res.status(503).json({ok:false,error:'Launch promo is not active yet. Please try again shortly.'});
    return res.status(500).json({ok:false,error:'Could not create the order. Please try again.'});
  }
};
