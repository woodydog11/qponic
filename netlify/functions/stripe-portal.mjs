const json=(statusCode,body)=>({statusCode,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
export const handler=async(event)=>{
 if(event.httpMethod!=="POST")return json(405,{error:"Method not allowed"});
 const {STRIPE_SECRET_KEY,VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY,URL}=process.env;
 if(!STRIPE_SECRET_KEY||!VITE_SUPABASE_URL||!VITE_SUPABASE_PUBLISHABLE_KEY||!SUPABASE_SECRET_KEY||!URL)return json(503,{error:"Billing portal not configured"});
 const bearer=event.headers.authorization||event.headers.Authorization||"";
 if(!/^Bearer\s+\S+$/.test(bearer))return json(401,{error:"Sign in required"});
 const r=await fetch(VITE_SUPABASE_URL+"/auth/v1/user",{headers:{apikey:VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:bearer}}).catch(()=>null);
 if(!r?.ok)return json(401,{error:"Invalid session"});
 const user=await r.json();if(!user.id)return json(401,{error:"Invalid session"});
 const b=await fetch(VITE_SUPABASE_URL+"/rest/v1/merchant_billing?select=stripe_customer_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1",{headers:{apikey:SUPABASE_SECRET_KEY,Authorization:"Bearer "+SUPABASE_SECRET_KEY}}).catch(()=>null);
 if(!b?.ok)return json(503,{error:"Billing data unavailable"});
 const rows=await b.json();if(!rows.length||!rows[0].stripe_customer_id)return json(404,{error:"No subscription found"});
 const form=new URLSearchParams({customer:rows[0].stripe_customer_id,return_url:URL.replace(/\/$/,"")+"/"});
 const response=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{Authorization:"Bearer "+STRIPE_SECRET_KEY,"content-type":"application/x-www-form-urlencoded"},body:form});
 if(!response.ok)return json(502,{error:"Billing portal unavailable"});
 const session=await response.json();return json(200,{url:session.url});
};
