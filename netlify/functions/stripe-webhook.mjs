import {createHmac,timingSafeEqual} from "node:crypto";
const json=(statusCode,body)=>({statusCode,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify(body)});
export function verifyStripeSignature(raw,header,secret,now=Math.floor(Date.now()/1000)){
 if(!secret||!header)return false;
 const pieces=header.split(",").map(s=>s.trim());const stamp=pieces.find(x=>x.startsWith("t="))?.slice(2);
 const sigs=pieces.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 const t=Number(stamp);if(!Number.isSafeInteger(t)||Math.abs(now-t)>300||!sigs.length)return false;
 const expected=createHmac("sha256",secret).update(stamp+"."+raw).digest("hex");
 return sigs.some(sig=>/^[a-f0-9]{64}$/.test(sig)&&timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(expected,"hex")));
}
const stripeGet=async(path,key)=>{
 const r=await fetch("https://api.stripe.com/v1/"+path,{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Stripe lookup failed");return r.json();
};
export const handler=async(event)=>{
 if(event.httpMethod!=="POST")return json(405,{error:"Method not allowed"});
 const {STRIPE_WEBHOOK_SECRET,STRIPE_SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY,VITE_SUPABASE_URL}=process.env;
 if(!STRIPE_WEBHOOK_SECRET||!STRIPE_SECRET_KEY||!SUPABASE_SERVICE_ROLE_KEY||!VITE_SUPABASE_URL)return json(503,{error:"Webhook not configured"});
 const raw=event.isBase64Encoded?Buffer.from(event.body||"","base64").toString("utf8"):event.body||"";
 if(raw.length>300000)return json(413,{error:"Payload too large"});
 if(!verifyStripeSignature(raw,event.headers["stripe-signature"]||event.headers["Stripe-Signature"],STRIPE_WEBHOOK_SECRET))return json(400,{error:"Invalid Stripe signature"});
 let payload;try{payload=JSON.parse(raw);}catch{return json(400,{error:"Invalid JSON"});}
 const allowed=new Set(["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"]);
 if(!allowed.has(payload.type))return json(200,{received:true,ignored:true});
 try{
  let sub;let customer;let merchantId;let userId;
  const obj=payload.data?.object;
  if(payload.type==="checkout.session.completed"){
   if(obj?.mode!=="subscription"||!obj.subscription)return json(200,{received:true,ignored:true});
   sub=await stripeGet("subscriptions/"+encodeURIComponent(obj.subscription),STRIPE_SECRET_KEY);
   merchantId=obj.metadata?.merchant_id||sub.metadata?.merchant_id;
   userId=obj.client_reference_id||sub.metadata?.user_id;
   customer=obj.customer;
  }else{
   sub=obj;merchantId=sub?.metadata?.merchant_id;userId=sub?.metadata?.user_id;customer=sub?.customer;
  }
  if(!sub?.id||!merchantId||!userId||!customer)return json(422,{error:"Missing subscription ownership mapping"});
  const period=sub.items?.data?.[0]?.current_period_end||sub.current_period_end;
  const params={p_event_id:payload.id,p_event_created:payload.created,p_merchant_id:merchantId,p_user_id:userId,p_customer_id:typeof customer==="string"?customer:customer.id,p_subscription_id:sub.id,p_status:sub.status||"incomplete",p_period_end:period?new Date(period*1000).toISOString():null,p_cancel_at_period_end:!!sub.cancel_at_period_end};
  const r=await fetch(VITE_SUPABASE_URL+"/rest/v1/rpc/apply_stripe_billing_event",{method:"POST",headers:{"content-type":"application/json",apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify(params),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error("Billing sync failed");
  return json(200,{received:true});
 }catch{return json(500,{error:"Webhook processing failed; Stripe may retry"});}
};
