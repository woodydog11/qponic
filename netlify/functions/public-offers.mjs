const headers={"content-type":"application/json","cache-control":"public,max-age=30"};
export const handler=async(event)=>{
 if(event.httpMethod!=="GET")return {statusCode:405,body:"Method not allowed"};
 const base=(process.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!base||!key)return {statusCode:503,body:JSON.stringify({error:"Listings unavailable"})};
 try{
  const r=await fetch(base+"/rest/v1/offers?select=id,merchant_id,title,description,type,terms,expiration,redemption_limit,redemption_method,status,review_version,approved_version&status=eq.published&order=updated_at.desc&limit=100",{headers:{apikey:key,Authorization:"Bearer "+key},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error("Unable to retrieve offers");
  const rows=await r.json();
  const offers=rows.filter(o=>o.approved_version!==null&&o.approved_version===o.review_version).map(({id,merchant_id,title,description,type,terms,expiration,redemption_limit,redemption_method})=>({id,merchant_id,title,description,type,terms,expiration,redemption_limit,redemption_method}));
  return {statusCode:200,headers,body:JSON.stringify({offers})};
 }catch{return {statusCode:502,body:JSON.stringify({error:"Listings temporarily unavailable"})};}
};