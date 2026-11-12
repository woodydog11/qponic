const headers={"content-type":"application/json","cache-control":"no-store"};
const respond=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
const env=()=>({base:(process.env.VITE_SUPABASE_URL||"").replace(/\/$/,""),pub:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,secret:process.env.SUPABASE_SECRET_KEY});
const rest=async(path,secret,base,opts={})=>{
 const r=await fetch(base+"/rest/v1/"+path,{...opts,headers:{"apikey":secret,"Authorization":"Bearer "+secret,"content-type":"application/json",...opts.headers},signal:AbortSignal.timeout(10000)});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=null}
 if(!r.ok)throw Error("Database operation failed");
 return data;
};
export const handler=async(event)=>{
 if(!["GET","POST"].includes(event.httpMethod))return respond(405,{error:"Method not allowed"});
 const {base,pub,secret}=env();
 if(!base||!pub||!secret)return respond(503,{error:"Approval engine configuration incomplete"});
 const bearer=event.headers.authorization||event.headers.Authorization||"";
 if(!/^Bearer\s+\S+$/.test(bearer))return respond(401,{error:"Sign-in required"});
 let user;
 try{
  const r=await fetch(base+"/auth/v1/user",{headers:{apikey:pub,Authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!r.ok)return respond(401,{error:"Invalid session"});user=await r.json();
  if(!user?.id)return respond(401,{error:"Invalid session"});
 }catch{return respond(502,{error:"Authentication unavailable"});}
 try{
  const [adminRows,memberships]=await Promise.all([
   rest("qponic_admins?select=user_id&user_id=eq."+encodeURIComponent(user.id),secret,base),
   rest("merchant_memberships?select=merchant_id&user_id=eq."+encodeURIComponent(user.id),secret,base)
  ]);
  const isAdmin=adminRows.length>0;
  const merchantIds=memberships.map(x=>x.merchant_id);
  if(event.httpMethod==="GET"){
   const params=new URLSearchParams(event.queryStringParameters||{});
   const view=params.get("view")||"offers";
   if(view==="identity")return respond(200,{isAdmin,merchantIds});
   if(view==="offers"){
    if(!isAdmin&&!merchantIds.length)return respond(200,{offers:[],isAdmin});
    const filter=isAdmin?"status=in.(pending_review,changes_requested,declined,published)":"merchant_id=in.("+merchantIds.join(",")+")";
    const offers=await rest("offers?select=id,merchant_id,title,description,type,terms,expiration,redemption_limit,redemption_method,status,review_version,approved_version,updated_at&"+filter+"&order=updated_at.desc&limit=200",secret,base);
    return respond(200,{offers,isAdmin});
   }
   if(view==="history"){
    const offerId=params.get("offer_id");
    if(!/^[0-9a-f-]{36}$/i.test(offerId||""))return respond(400,{error:"Invalid offer ID"});
    const o=await rest("offers?select=id,merchant_id&id=eq."+offerId,secret,base);
    if(!o.length||(!isAdmin&&!merchantIds.includes(o[0].merchant_id)))return respond(403,{error:"Not authorized"});
    const [events,revisions]=await Promise.all([
     rest("offer_review_events?select=id,action,notes,created_at,proposed_revision_id&offer_id=eq."+offerId+"&order=created_at.asc",secret,base),
     rest("offer_revisions?select=id,revision_number,role,title,description,type,terms,expiration,redemption_limit,redemption_method,created_at&offer_id=eq."+offerId+"&order=revision_number.asc",secret,base)
    ]);
    return respond(200,{events,revisions});
   }
   if(view==="notifications"){
    const notifications=await rest("offer_notifications?select=id,offer_id,created_at,read_at,event_id&recipient_id=eq."+user.id+"&order=created_at.desc&limit=100",secret,base);
    return respond(200,{notifications});
   }
   return respond(400,{error:"Unknown view"});
  }
  let body;try{if((event.body||"").length>16000)return respond(413,{error:"Request too large"});body=JSON.parse(event.body||"{}");}catch{return respond(400,{error:"Invalid JSON"})}
  if(!["submit","approve","request_changes","decline"].includes(body.action))return respond(400,{error:"Invalid action"});
  if(!/^[0-9a-f-]{36}$/i.test(body.offer_id||""))return respond(400,{error:"Invalid offer ID"});
  if((body.action==="approve"||body.action==="request_changes"||body.action==="decline")&&!isAdmin)return respond(403,{error:"Administrator access required"});
  if(typeof body.notes!=="undefined"&&(typeof body.notes!=="string"||body.notes.length>2000))return respond(400,{error:"Invalid notes"});
  const proposal=body.proposal;
  if(proposal!==undefined&&proposal!==null){
   if(typeof proposal!=="object"||Array.isArray(proposal)||["title","description","type","terms","expiration","redemption_limit","redemption_method"].some(k=>typeof proposal[k]!=="string"||!proposal[k].trim()||proposal[k].length>1500))return respond(400,{error:"Invalid proposed offer"});
  }
  const result=await rest("rpc/qponic_offer_transition",secret,base,{method:"POST",body:JSON.stringify({p_actor:user.id,p_offer:body.offer_id,p_action:body.action,p_notes:body.notes||null,p_proposal:proposal||null})});
  return respond(200,result);
 }catch(e){return respond(400,{error:e instanceof Error?e.message:"Review request failed"});}
};
