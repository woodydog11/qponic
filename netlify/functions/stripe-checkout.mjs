const respond=(statusCode,body)=>({statusCode,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify(body)});
const stripePost=async(path,params)=>{const r=await fetch("https://api.stripe.com/v1/"+path,{method:"POST",headers:{Authorization:"Bearer "+process.env.STRIPE_SECRET_KEY,"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params)});const data=await r.json();if(!r.ok)throw Error(data.error?.message||"Stripe request failed");return data;};
export const handler=async(event)=>{
 if(event.httpMethod!=="POST")return respond(405,{error:"Method not allowed"});
 const {STRIPE_SECRET_KEY,STRIPE_MONTHLY_PRICE_ID,STRIPE_INTRO_COUPON_ID,VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,URL}=process.env;
 if(!STRIPE_SECRET_KEY||!STRIPE_MONTHLY_PRICE_ID||!STRIPE_INTRO_COUPON_ID||!VITE_SUPABASE_URL||!VITE_SUPABASE_PUBLISHABLE_KEY||!URL)return respond(503,{error:"Stripe billing setup incomplete"});
 const bearer=event.headers.authorization||event.headers.Authorization||"";
 if(!/^Bearer\s+\S+$/.test(bearer))return respond(401,{error:"Sign in required"});
 const auth=await fetch(VITE_SUPABASE_URL+"/auth/v1/user",{headers:{apikey:VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:bearer},signal:AbortSignal.timeout(8000)}).catch(()=>null);
 if(!auth?.ok)return respond(401,{error:"Invalid session"});
 const user=await auth.json();if(!user.id||!user.email)return respond(401,{error:"Invalid user"});
 const memberships=await fetch(VITE_SUPABASE_URL+"/rest/v1/merchant_memberships?select=merchant_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1",{headers:{apikey:VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:bearer},signal:AbortSignal.timeout(8000)}).catch(()=>null);
 if(!memberships?.ok)return respond(403,{error:"Merchant membership required"});
 const rows=await memberships.json();if(!rows.length)return respond(403,{error:"Merchant membership required"});
 try{
  const params={"mode":"subscription","line_items[0][price]":STRIPE_MONTHLY_PRICE_ID,"line_items[0][quantity]":"1","discounts[0][coupon]":STRIPE_INTRO_COUPON_ID,"customer_email":user.email,"client_reference_id":user.id,"metadata[merchant_id]":rows[0].merchant_id,"subscription_data[metadata][merchant_id]":rows[0].merchant_id,"subscription_data[metadata][user_id]":user.id,"success_url":URL.replace(/\/$/,"")+"/?checkout=success&session_id={CHECKOUT_SESSION_ID}","cancel_url":URL.replace(/\/$/,"")+"/?checkout=canceled"};
  const session=await stripePost("checkout/sessions",params);return respond(200,{url:session.url});
 }catch(e){return respond(502,{error:"Checkout unavailable. Verify Stripe price and introductory coupon configuration."});}
};
