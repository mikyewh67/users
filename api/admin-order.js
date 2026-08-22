const {sb,adminOk}=require('../lib/server');
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const {adminSecret,orderId}=req.body||{};
    if(!adminOk(adminSecret))return res.status(401).json({ok:false,error:'Invalid admin secret'});
    const id=String(orderId||'').trim().toUpperCase();
    if(!id)return res.status(400).json({ok:false,error:'Enter an order ID'});

    // Keep the core admin page compatible before the optional Telegram
    // workflow migration adds payment_verified_at / secured_at columns.
    const rows=await sb(`orders?select=public_id,status,buyer_email,payment_method,payer_name,payment_ref,buyer_note,created_at,reserved_until,fulfilled_at,inventory(id,handle,platform,kind,source,cost,sale_price,status)&public_id=eq.${encodeURIComponent(id)}&limit=1`,{method:'GET'});
    if(!rows?.[0])return res.status(404).json({ok:false,error:'Order not found'});
    return res.status(200).json({ok:true,order:rows[0]});
  }catch(e){
    console.error('admin-order error',e);
    return res.status(500).json({ok:false,error:'Could not load order'});
  }
};
