const {sb}=require('../lib/server');

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    await sb('rpc/release_expired_reservations',{method:'POST',body:'{}'}).catch(()=>null);
    const rows=[];
    const pageSize=1000;
    let offset=0;
    while(offset<20000){
      const chunk=await sb(`inventory?select=id,handle,platform,kind,sale_price&status=eq.available&order=sale_price.asc&limit=${pageSize}&offset=${offset}`,{method:'GET'});
      if(!Array.isArray(chunk))break;
      rows.push(...chunk);
      if(chunk.length<pageSize)break;
      offset+=pageSize;
    }
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,items:rows});
  }catch(e){
    return res.status(500).json({ok:false,error:'Inventory is temporarily unavailable.'});
  }
};
