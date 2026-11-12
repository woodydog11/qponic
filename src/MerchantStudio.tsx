import OfferApproval from "./OfferApproval";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Sparkles, Save, LogOut } from "lucide-react";
import "./merchant.css";
type Message={role:"user"|"assistant";content:string};
type Strategy={goal:string;recommendation:"FREE"|"BOGO"|"50% OFF"|null;rationale:string;assumptions:string[];risks:string[];comparisons:{type:string;tradeoff:string}[]};
type Draft={title:string;description:string;type:string;terms:string;expiration:string;redemption_limit:string;merchant_name:string;redemption_method:string};
const url=import.meta.env.VITE_SUPABASE_URL || "https://bqhlrnwopfohkbwikgtm.supabase.co";
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const headers=()=>({"Content-Type":"application/json",apikey:key});
export default function MerchantStudio({onBack}:{onBack:()=>void}){
 const [showOffers,setShowOffers]=useState(false);const [portfolio,setPortfolio]=useState<(Draft & {rationale:string;risks:string})[]>([]);const [chosen,setChosen]=useState<string[]>(["FREE","BOGO","50% OFF"]);const [email,setEmail]=useState("");
 const [token,setToken]=useState("");
 const [messages,setMessages]=useState<Message[]>([{role:"assistant",content:"Welcome to Qponic Merchant Studio. Tell me about your business and what you'd like to improve."}]);
 const [entry,setEntry]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [draft,setDraft]=useState<Draft|null>(null);const [strategy,setStrategy]=useState<Strategy|null>(null);
 const [merchantId,setMerchantId]=useState("");const [saved,setSaved]=useState(false);const [notice,setNotice]=useState("");
 useEffect(()=>{
  let cancelled=false;
  const query=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const access=hash.get("access_token");
  const refresh=hash.get("refresh_token");
  const tokenHash=query.get("token_hash");
  const type=query.get("type");
  const clear=()=>window.history.replaceState({},"",window.location.pathname+"?merchant=studio");
  if(access){
   clear();
   fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+access}})
    .then(async r=>{if(!r.ok)throw Error("Sign-in session expired. Please try again.");return r.json();})
    .then(()=>{if(!cancelled){setToken(access);setNotice("");if(refresh)sessionStorage.setItem("qponic_merchant_refresh",refresh);}})
    .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Sign-in failed");});
  }else if(tokenHash&&(type==="magiclink"||type==="email")){
   clear();
   fetch(url+"/auth/v1/verify",{method:"POST",headers:headers(),body:JSON.stringify({token_hash:tokenHash,type})})
    .then(async r=>{const data=await r.json();if(!r.ok||!data.access_token)throw Error(data.msg||data.error_description||"Sign-in link expired");return data;})
    .then(data=>{if(!cancelled){setToken(data.access_token);if(data.refresh_token)sessionStorage.setItem("qponic_merchant_refresh",data.refresh_token);}})
    .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Sign-in failed");});
  }else if(hash.get("error_description")){
   setError(hash.get("error_description")||"Authentication failed");clear();
  }
  return ()=>{cancelled=true};
 },[]);
 function signInGoogle(){
  if(!key){setError("Supabase configuration missing");return;}
  const redirect=window.location.origin+"/?merchant=studio";
  window.location.assign(url+"/auth/v1/authorize?provider=google&redirect_to="+encodeURIComponent(redirect));
 }
 async function sendMagicLink(){
  if(!email.trim()||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const redirect=window.location.origin+"/?merchant=studio";
   const r=await fetch(url+"/auth/v1/otp?redirect_to="+encodeURIComponent(redirect),{method:"POST",headers:headers(),body:JSON.stringify({email:email.trim(),create_user:true})});
   if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.msg||data.error_description||data.message||"Unable to send link");}
   setNotice("Check your email for a sign-in link. It may take a few minutes.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to send sign-in link");}finally{setBusy(false);}
 }
 async function send(){
  if(!entry.trim()||busy)return;const next=[...messages,{role:"user" as const,content:entry.trim()}];setMessages(next);setEntry("");setError("");setBusy(true);setSaved(false);
  try{
   // The assistant creates the complete three-offer portfolio as part of the conversation.
   // Do not force the merchant to pick a coupon type or find a separate builder button.
   const merchantTurns=next.filter(m=>m.role==="user");
   const wantsOffers=/\\b(both|all three|all 3|three offers|create|generate|draft|make (?:the|my|some) offers|let.s do it)\\b/i.test(entry);
   const hasBusinessContext=merchantTurns.some(m=>/\\b(pizza|restaurant|shop|store|salon|cafe|coffee|gym|fitness|barber|retail|business|bakery|spa|service)\\b/i.test(m.content));
   const automaticPortfolio=hasBusinessContext&&(wantsOffers||merchantTurns.length>=2);
   const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({messages:next.slice(-12),...(automaticPortfolio?{mode:"portfolio"}:{})})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"Offer assistant unavailable");
   setMessages([...next,{role:"assistant",content:data.reply}]);setMerchantId(data.merchant_id||"");
   if(automaticPortfolio&&Array.isArray(data.offers)){setPortfolio(data.offers);setChosen(["FREE","BOGO","50% OFF"]);setDraft(null);setStrategy(null);setNotice("All three offers are ready below. Confirm the terms, then choose which drafts to save.");}
   else {setDraft(data.ready?data.draft:null);setStrategy(data.strategy||null);}
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
 }
 async function generatePortfolio(){
  if(busy||messages.every(m=>m.role!=="user"))return;
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({mode:"portfolio",messages:messages.slice(-12)})});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to generate offers");setPortfolio(data.offers);setMerchantId(data.merchant_id);setChosen(["FREE","BOGO","50% OFF"]);setNotice("Three promotional concepts generated. Review and confirm each offer's terms before submission.");}catch(e){setError(e instanceof Error?e.message:"Portfolio unavailable");}finally{setBusy(false);}
 }
 async function savePortfolio(){
  if(busy||!merchantId||!chosen.length)return;
  const offers=portfolio.filter(o=>chosen.includes(o.type));
  if(offers.some(o=>["terms","expiration","redemption_limit","redemption_method","merchant_name"].some(k=>String(o[k as keyof Draft]).includes("Merchant to confirm")))){setError("Please replace all 'Merchant to confirm' details before saving selected offers.");return;}
  setBusy(true);setError("");
  try{for(const o of offers){const payload={merchant_id:merchantId,title:o.title,description:o.description,type:o.type,terms:o.terms,expiration:o.expiration,redemption_limit:o.redemption_limit,redemption_method:o.redemption_method,status:"draft"};const r=await fetch(url+"/rest/v1/offers",{method:"POST",headers:{...headers(),Authorization:"Bearer "+token,Prefer:"return=minimal"},body:JSON.stringify(payload)});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.message||"Could not save "+o.type);}}setPortfolio([]);setShowOffers(true);setNotice("Selected offers saved as drafts. Open each offer and submit it for administrator review.");}catch(e){setError(e instanceof Error?e.message:"Could not save offers");}finally{setBusy(false);}
 }
 async function save(){
  if(!draft||!merchantId||busy)return;setBusy(true);setError("");
  try{
   const payload={merchant_id:merchantId,title:draft.title,description:draft.description,type:draft.type,terms:draft.terms,expiration:draft.expiration,redemption_limit:draft.redemption_limit,redemption_method:draft.redemption_method,status:"draft"};
   const r=await fetch(url+"/rest/v1/offers",{method:"POST",headers:{...headers(),Authorization:"Bearer "+token,Prefer:"return=minimal"},body:JSON.stringify(payload)});
   if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.message||"Could not save draft");}
   setSaved(true);
  }catch(e){setError(e instanceof Error?e.message:"Could not save");}finally{setBusy(false);}
 }
 return <main className="studio"><div className="studio-head"><button onClick={onBack}><ArrowLeft size={17}/> Back to deals</button><span><Sparkles size={16}/> Merchant Studio <small>BETA</small></span></div>
 {!token?<section className="studio-auth"><span className="studio-kicker">FOR BUSINESSES</span><h1>Welcome to Qponic.</h1><p>Sign in to manage your business and create smarter promotions.</p><div className="studio-passwordless"><button type="button" className="studio-google" onClick={signInGoogle}>Continue with Google</button><div className="studio-or">or</div><form onSubmit={e=>{e.preventDefault();sendMagicLink()}}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com"/></label><button disabled={busy||!email.trim()} type="submit">Email me a sign-in link</button></form></div>{notice&&<p className="studio-notice">{notice}</p>}{error&&<p className="studio-error" role="alert">{error}</p>}<p className="studio-footnote">No password required. Merchant access remains subject to business authorization during beta.</p></section>:
 <><div className="studio-review-nav"><button onClick={()=>setShowOffers(false)}>AI Offer Builder</button><button onClick={()=>setShowOffers(true)}>Offers & Reviews</button></div>{showOffers?<OfferApproval token={token}/>:<div className="studio-layout"><section className="studio-chat"><div className="studio-chat-title"><div><strong>Offer Builder</strong><p>Describe your promotion in your own words.</p></div><button onClick={()=>{setToken("");sessionStorage.removeItem("qponic_merchant_refresh");setDraft(null);setStrategy(null);setMerchantId("");}}><LogOut size={16}/> Sign out</button></div><div className="studio-messages" aria-live="polite">{messages.map((m,i)=><div key={i} className={m.role==="user"?"studio-message user":"studio-message assistant"}>{m.content}</div>)}{busy&&<p className="studio-thinking">Working on your offer…</p>}</div><form className="studio-composer" onSubmit={e=>{e.preventDefault();send()}}><input aria-label="Describe your offer" maxLength={1500} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Tell me about your business…"/><button type="submit" disabled={busy||!entry.trim()} aria-label="Send message"><Send size={18}/></button></form><button className="studio-save" onClick={generatePortfolio} disabled={busy||messages.every(m=>m.role!=="user")}>Regenerate all three offers</button></section><aside className="studio-preview"><span className="studio-kicker">LIVE PREVIEW</span><h2>{draft?.title||(strategy?.recommendation?"Recommended: "+strategy.recommendation:"Your offer will appear here.")}</h2>{strategy?.rationale&&<div className="studio-strategy"><strong>Marketing strategy</strong><p>{strategy.rationale}</p>{strategy.assumptions.length>0&&<p><b>Assumptions:</b> {strategy.assumptions.join("; ")}</p>}{strategy.risks.length>0&&<p><b>Watch for:</b> {strategy.risks.join("; ")}</p>}{strategy.comparisons.length>0&&<details><summary>Other options</summary>{strategy.comparisons.map((c,i)=><p key={i}><b>{c.type}:</b> {c.tradeoff}</p>)}</details>}</div>}{portfolio.length>0&&<div className="studio-portfolio"><h3>Your three-offer portfolio</h3><p>Choose any combination. Your subscription fee stays the same.</p>{portfolio.map((o,i)=><div className="studio-portfolio-card" key={o.type}><label><input type="checkbox" checked={chosen.includes(o.type)} onChange={e=>setChosen(v=>e.target.checked?[...v,o.type]:v.filter(t=>t!==o.type))}/><b>{o.type}</b> · {o.title}</label><p>{o.rationale}</p>{(["title","description","terms","expiration","redemption_limit","redemption_method","merchant_name"] as const).map(k=><label key={k}>{k.replaceAll("_"," ")}<input value={o[k]} onChange={e=>setPortfolio(v=>v.map((x,j)=>j===i?{...x,[k]:e.target.value}:x))}/></label>)}<small>Risk: {o.risks}</small></div>)}<button className="studio-save" disabled={busy||chosen.length===0} onClick={savePortfolio}>Save {chosen.length} selected offer(s) as drafts</button><small>Each saved draft must be separately submitted for administrator approval.</small></div>}{draft?<><span className="studio-offer-type">{draft.type}</span><p>{draft.description}</p><dl>{(["merchant_name","terms","expiration","redemption_limit","redemption_method"] as const).map(k=><div key={k}><dt>{k.replaceAll("_"," ")}</dt><dd>{draft[k]}</dd></div>)}</dl><button className="studio-save" onClick={save} disabled={busy||saved}><Save size={16}/>{saved?"Draft saved":"Save draft"}</button><small>Saved as draft only. Not publicly visible.</small></>:<p>Chat with the assistant to generate a complete offer. Nothing is published automatically.</p>}</aside>{error&&<p className="studio-error" role="alert">{error}</p>}</div>}</>}</main>;
}
