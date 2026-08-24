const {sb}=require('../lib/server');
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const inventoryId=Number(req.body?.inventoryId);
    const code=String(req.body?.code||'').trim().toUpperCase();
    if(!inventoryId||!code)return res.status(400).json({ok:false,error:'Enter a promo code.'});
    const out=await sb('rpc/claim_launch_promo',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_inventory_id:inventoryId,p_code:code})});
    const q=Array.isArray(out)?out[0]:out;
    if(!q)throw new Error('Could not apply promo');
    return res.status(200).json({ok:true,promoToken:q.promo_token,code:q.code,listPrice:Number(q.list_price),discountAmount:Number(q.discount_amount),finalAmount:Number(q.final_amount),expiresAt:q.expires_at,remaining:Number(q.remaining)});
  }catch(e){
    const msg=String(e.message||'');
    if(msg.includes('PROMO_INVALID'))return res.status(400).json({ok:false,error:'Invalid promo code.'});
    if(msg.includes('PROMO_SOLD_OUT'))return res.status(409).json({ok:false,error:'LAUNCH15 has reached its 10-customer limit.'});
    if(msg.includes('ITEM_NOT_AVAILABLE'))return res.status(409).json({ok:false,error:'That handle is no longer available.'});
    if(msg.toLowerCase().includes('claim_launch_promo'))return res.status(503).json({ok:false,error:'Launch promo is not active yet.'});
    return res.status(500).json({ok:false,error:'Could not apply promo code.'});
  }
};
