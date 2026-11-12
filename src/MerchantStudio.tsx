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
 const [recoveryMode,setRecoveryMode]=useState(false);const [recoveryToken,setRecoveryToken]=useState("");const [newPassword,setNewPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [token,setToken]=useState("");const [messages,setMessages]=useState<Message[]>([{role:"assistant",content:"Welcome to Qponic Merchant Studio. Tell me about the offer you want to create. We support FREE, BOGO, and 50% OFF deals."}]);const [entry,setEntry]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [draft,setDraft]=useState<Draft|null>(null);const [strategy,setStrategy]=useState<Strategy|null>(null);const [merchantId,setMerchantId]=useState("");const [saved,setSaved]=useState(false);const [notice,setNotice]=useState("");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const fragment=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const access=fragment.get("access_token");
  const type=fragment.get("type");
  const tokenHash=params.get("token_hash");
  if(type==="recovery"&&access){setRecoveryToken(access);setRecoveryMode(true);window.history.replaceState({}, "",window.location.pathname+"?merchant=recovery");}
  else if(tokenHash&&params.get("type")==="recovery"){
   fetch(url+"/auth/v1/verify",{method:"POST",headers:headers(),body:JSON.stringify({token_hash:tokenHash,type:"recovery"})})
    .then(async r=>{const data=await r.json();if(!r.ok||!data.access_token)throw Error(data.msg||data.error_description||"Recovery link expired");setRecoveryToken(data.access_token);setRecoveryMode(true);window.history.replaceState({},"",window.location.pathname+"?merchant=recovery");})
    .catch(e=>setError(e instanceof Error?e.message:"Recovery link invalid"));
  }
 },[]);
 async function requestRecovery(){
  if(!email.trim()||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const redirect=window.location.origin+"/?merchant=recovery";
   const r=await fetch(url+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirect),{method:"POST",headers:headers(),body:JSON.stringify({email:email.trim()})});
   if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.msg||data.error_description||"Could not send recovery email");}
   setNotice("If this email has an account, a password reset link will arrive shortly. Check your inbox and spam folder.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to send reset link");}finally{setBusy(false);}
 }
 async function updatePassword(){
  if(!recoveryToken||busy)return;
  if(newPassword.length<8){setError("Use at least 8 characters.");return;}
  if(newPassword!==confirmPassword){setError("Passwords do not match.");return;}
  setBusy(true);setError("");
  try{
   const r=await fetch(url+"/auth/v1/user",{method:"PUT",headers:{...headers(),Authorization:"Bearer "+recoveryToken},body:JSON.stringify({password:newPassword})});
   if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.msg||data.error_description||"Unable to update password");}
   setRecoveryToken("");setRecoveryMode(false);setNewPassword("");setConfirmPassword("");setNotice("Password updated. Sign in using your new password.");
   window.history.replaceState({},"",window.location.pathname);
  }catch(e){setError(e instanceof Error?e.message:"Unable to update password");}finally{setBusy(false);}
 }
 async function auth(mode:"login"|"signup"){
  setError("");setBusy(true);try{
   if(!key)throw new Error("Add VITE_SUPABASE_PUBLISHABLE_KEY to Netlify first.");
   const path=mode==="login"?"/auth/v1/token?grant_type=password":"/auth/v1/signup?redirect_to="+encodeURIComponent(window.location.origin+"/");
   const r=await fetch(url+path,{method:"POST",headers:headers(),body:JSON.stringify({email,password})});
   const data=await r.json();if(!r.ok)throw new Error(data.msg||data.error_description||data.message||"Authentication failed");
   if(data.access_token){setToken(data.access_token);setNotice("");}else setNotice("Check your email to confirm your account, then sign in.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to sign in");}finally{setBusy(false);}
 }
 async function send(){
  if(!entry.trim()||busy)return;const next=[...messages,{role:"user" as const,content:entry.trim()}];setMessages(next);setEntry("");setError("");setBusy(true);setSaved(false);
  try{
   const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({messages:next.slice(-12)})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"Offer assistant unavailable");
   setMessages([...next,{role:"assistant",content:data.reply}]);setDraft(data.ready?data.draft:null);setStrategy(data.strategy||null);setMerchantId(data.merchant_id||"");
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
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
 {!token?<section className="studio-auth"><span className="studio-kicker">FOR BUSINESSES</span><h1>{recoveryMode?"Reset your password.":"Better offers start with a conversation."}</h1><p>{recoveryMode?"Choose a new password to return to Merchant Studio.":"Sign in to build your first coupon with Qponic AI."}</p>{recoveryMode?<form onSubmit={e=>{e.preventDefault();updatePassword()}}><label>New password<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button disabled={busy||!recoveryToken} type="submit">Update password</button></form>:<form onSubmit={e=>{e.preventDefault();auth("login")}}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com"/></label><label>Password<input type="password" minLength={6} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/></label><button disabled={busy||!email||!password} type="submit">Sign in</button><button disabled={busy||!email||!password} type="button" className="secondary" onClick={()=>auth("signup")}>Create account</button><button type="button" className="studio-forgot" disabled={busy||!email.trim()} onClick={requestRecovery}>Forgot password? Email me a reset link</button></form>}{notice&&<p className="studio-notice">{notice}</p>}{error&&<p className="studio-error" role="alert">{error}</p>}<p className="studio-footnote">Merchant access is invitation-only during beta. Signing up does not automatically authorize a business.</p></section>:
 <div className="studio-layout"><section className="studio-chat"><div className="studio-chat-title"><div><strong>Offer Builder</strong><p>Describe your promotion in your own words.</p></div><button onClick={()=>{setToken("");setDraft(null);setStrategy(null);setMerchantId("");}}><LogOut size={16}/> Sign out</button></div><div className="studio-messages" aria-live="polite">{messages.map((m,i)=><div key={i} className={m.role==="user"?"studio-message user":"studio-message assistant"}>{m.content}</div>)}{busy&&<p className="studio-thinking">Working on your offer…</p>}</div><form className="studio-composer" onSubmit={e=>{e.preventDefault();send()}}><input aria-label="Describe your offer" maxLength={1500} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Tell me about your deal…"/><button type="submit" disabled={busy||!entry.trim()} aria-label="Send message"><Send size={18}/></button></form></section><aside className="studio-preview"><span className="studio-kicker">LIVE PREVIEW</span><h2>{draft?.title||(strategy?.recommendation?"Recommended: "+strategy.recommendation:"Your offer will appear here.")}</h2>{strategy&&<div className="studio-strategy"><strong>Marketing strategy</strong><p>{strategy.rationale}</p>{strategy.assumptions.length>0&&<p><b>Assumptions:</b> {strategy.assumptions.join("; ")}</p>}{strategy.risks.length>0&&<p><b>Watch for:</b> {strategy.risks.join("; ")}</p>}{strategy.comparisons.length>0&&<details><summary>Other options</summary>{strategy.comparisons.map((c,i)=><p key={i}><b>{c.type}:</b> {c.tradeoff}</p>)}</details>}</div>}{draft?<><span className="studio-offer-type">{draft.type}</span><p>{draft.description}</p><dl>{(["merchant_name","terms","expiration","redemption_limit","redemption_method"] as const).map(k=><div key={k}><dt>{k.replaceAll("_"," ")}</dt><dd>{draft[k]}</dd></div>)}</dl><button className="studio-save" onClick={save} disabled={busy||saved}><Save size={16}/>{saved?"Draft saved":"Save draft"}</button><small>Saved as draft only. Not publicly visible.</small></>:<p>Chat with the assistant to generate a complete offer. Nothing is published automatically.</p>}</aside>{error&&<p className="studio-error" role="alert">{error}</p>}</div>}</main>;
}
