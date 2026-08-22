const {adminOk,telegramApi,env}=require('../lib/server');

function requestOrigin(req){
  const forwardedHost=String(req.headers['x-forwarded-host']||'').split(',')[0].trim();
  const host=forwardedHost||String(req.headers.host||'').trim();
  const forwardedProto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();
  const proto=forwardedProto||'https';
  if(host)return `${proto}://${host}`.replace(/\/$/,'');
  return (env('SITE_URL',false)||'https://mikyemedia.com').replace(/\/$/,'');
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const {adminSecret}=req.body||{};
    if(!adminOk(adminSecret))return res.status(401).json({ok:false,error:'Invalid admin secret'});

    const secret=env('TELEGRAM_WEBHOOK_SECRET',false);
    if(!secret)return res.status(400).json({ok:false,error:'Add TELEGRAM_WEBHOOK_SECRET in Vercel first.'});

    // Use the host that actually served this request. This avoids registering an
    // apex/www URL that Vercel redirects with 308, which Telegram webhooks reject.
    const site=requestOrigin(req);
    const url=`${site}/api/telegram-webhook`;

    await telegramApi('setWebhook',{
      url,
      secret_token:secret,
      allowed_updates:['message','callback_query'],
      drop_pending_updates:false
    });

    await telegramApi('setMyCommands',{commands:[
      {command:'orders',description:'Show all open orders'},
      {command:'pending',description:'Waiting for payment verification'},
      {command:'paid',description:'Paid orders needing securing'},
      {command:'secured',description:'Orders ready to fulfill'},
      {command:'today',description:'Today’s sales and gross profit'},
      {command:'order',description:'Open one order by ID'},
      {command:'help',description:'Show bot commands'}
    ]});

    const info=await telegramApi('getWebhookInfo',{});
    return res.status(200).json({
      ok:true,
      webhook:url,
      pending_update_count:info.pending_update_count||0,
      last_error_message:info.last_error_message||null
    });
  }catch(e){
    return res.status(500).json({ok:false,error:e.message||'Telegram setup failed'});
  }
};
