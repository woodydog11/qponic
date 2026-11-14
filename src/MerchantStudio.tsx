import ProfitSimulator from "./ProfitSimulator";
import OfferApproval from "./OfferApproval";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Save, LogOut, Mic, MicOff } from "lucide-react";
import "./merchant.css";
type Message={role:"user"|"assistant";content:string};
type Strategy={goal:string;recommendation:"FREE"|"BOGO"|"50% OFF"|null;rationale:string;assumptions:string[];risks:string[];comparisons:{type:string;tradeoff:string}[]};
type Draft={title:string;description:string;type:string;terms:string;expiration:string;redemption_limit:string;merchant_name:string;redemption_method:string};
const url=import.meta.env.VITE_SUPABASE_URL || "https://bqhlrnwopfohkbwikgtm.supabase.co";
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
type SpeechResult={results:ArrayLike<ArrayLike<{transcript:string}>>;resultIndex:number};
type SpeechEngine={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:SpeechResult)=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
const SESSION_KEY="qponic_merchant_session_v1";
const IDLE_MS=10*60*1000;
type MerchantSession={access_token:string;refresh_token:string;last_activity:number};
function readSession():MerchantSession|null{try{const raw=sessionStorage.getItem(SESSION_KEY);if(!raw)return null;const v=JSON.parse(raw) as MerchantSession;if(!v.access_token||!v.refresh_token||!Number.isFinite(v.last_activity)||Date.now()-v.last_activity>=IDLE_MS){sessionStorage.removeItem(SESSION_KEY);return null;}return v;}catch{sessionStorage.removeItem(SESSION_KEY);return null;}}
function clearSession(){sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem("qponic_merchant_refresh");}
const headers=()=>({"Content-Type":"application/json",apikey:key});
function ChatMessage({message,onProgress}:{message:Message;onProgress:()=>void}){
 const [visible,setVisible]=useState(()=>message.role==="user"?message.content.length:0);
 useEffect(()=>{
  if(message.role!=="assistant"){setVisible(message.content.length);return;}
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setVisible(message.content.length);return;}
  let count=0;
  const timer=window.setInterval(()=>{count=Math.min(message.content.length,count+3);setVisible(count);onProgress();if(count>=message.content.length)window.clearInterval(timer);},22);
  return()=>window.clearInterval(timer);
 },[message.content,message.role,onProgress]);
 return <div className={message.role==="user"?"studio-message user":"studio-message assistant"}>{message.content.slice(0,visible)}{message.role==="assistant"&&visible<message.content.length&&<span className="studio-ticker-caret" aria-hidden="true">▍</span>}</div>;
}
export default function MerchantStudio({onBack}:{onBack:()=>void}){
 const [showOffers,setShowOffers]=useState(false);const [approved,setApproved]=useState<string[]>([]);const [editingOffer,setEditingOffer]=useState<string|null>(null);const [strategyMode,setStrategyMode]=useState(false);const [policySummary,setPolicySummary]=useState("Redemption capacity not yet specified · Active until capacity reached by default");const [portfolio,setPortfolio]=useState<(Draft & {rationale:string;risks:string})[]>([]);const [chosen,setChosen]=useState<string[]>(["FREE","BOGO","50% OFF"]);const [email,setEmail]=useState("");
 const [token,setToken]=useState("");
 const lastActivity=useRef(Date.now());
 const tokenRef=useRef("");
 const expireSession=()=>{clearSession();tokenRef.current="";setToken("");setNotice("Your merchant session expired after 10 minutes of inactivity. Please sign in again.");};
 const acceptSession=(access_token:string,refresh_token:string)=>{lastActivity.current=Date.now();tokenRef.current=access_token;sessionStorage.setItem(SESSION_KEY,JSON.stringify({access_token,refresh_token,last_activity:lastActivity.current}));setToken(access_token);setNotice("");};
 useEffect(()=>{tokenRef.current=token;},[token]);
 useEffect(()=>{if(!token)return;const activity=()=>{const current=readSession();if(!current){expireSession();return;}const now=Date.now();lastActivity.current=now;sessionStorage.setItem(SESSION_KEY,JSON.stringify({...current,last_activity:now}));};const events=["pointerdown","keydown","touchstart"] as const;events.forEach(event=>window.addEventListener(event,activity,{passive:true}));const timer=window.setInterval(()=>{if(Date.now()-lastActivity.current>=IDLE_MS)expireSession();},15000);return()=>{events.forEach(event=>window.removeEventListener(event,activity));window.clearInterval(timer);};},[token]);
 const speechRef=useRef<SpeechEngine|null>(null);
 const [listening,setListening]=useState(false);
 const [dictationSupported]=useState(()=>typeof window!=="undefined"&&!!(window as unknown as {SpeechRecognition?:unknown;webkitSpeechRecognition?:unknown}).SpeechRecognition||typeof window!=="undefined"&&!!(window as unknown as {webkitSpeechRecognition?:unknown}).webkitSpeechRecognition);
 function toggleDictation(){
  if(listening){speechRef.current?.stop();setListening(false);return;}
  const browser=window as unknown as {SpeechRecognition?:new()=>SpeechEngine;webkitSpeechRecognition?:new()=>SpeechEngine};
  const Engine=browser.SpeechRecognition||browser.webkitSpeechRecognition;
  if(!Engine){setError("Voice dictation is not supported by this browser. You can still type your message.");return;}
  try{
   const speech=new Engine();speechRef.current=speech;speech.lang="en-US";speech.continuous=false;speech.interimResults=false;
   speech.onresult=e=>{const transcript=Array.from(e.results).slice(e.resultIndex).map(x=>x[0]?.transcript||"").join(" ").trim();if(transcript)setEntry(v=>(v.trim()?v.trim()+" ":"")+transcript);};
   speech.onerror=e=>{setListening(false);speechRef.current=null;if(e.error!=="aborted"&&e.error!=="no-speech")setError(e.error==="not-allowed"?"Microphone permission was denied. Allow microphone access in your browser settings.":"Dictation failed: "+e.error);};
   speech.onend=()=>{setListening(false);speechRef.current=null;};
   speech.start();setListening(true);setError("");
  }catch{setListening(false);setError("Could not start dictation. Check microphone permissions.");}
 }
 useEffect(()=>()=>{speechRef.current?.abort();speechRef.current=null;},[]);
 const [messages,setMessages]=useState<Message[]>([{role:"assistant",content:"Welcome to Qponic Merchant Studio. Let's create the best Free, 1/2 Off, and BOGO offers ever!\n\nLet's chat about your business and build a campaign that brings more customers through your door."}]);
 const messageEndRef=useRef<HTMLDivElement|null>(null);
 const scrollChat=useCallback(()=>{const node=messageEndRef.current;if(node&&node.scrollHeight-node.scrollTop-node.clientHeight<140)node.scrollTop=node.scrollHeight;},[]);
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
  const refreshSession=async(refresh_token:string)=>{
   const response=await fetch(url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:headers(),body:JSON.stringify({refresh_token})});
   const data=await response.json();if(!response.ok||!data.access_token||!data.refresh_token)throw Error("Your session could not be restored. Please sign in again.");
   if(!cancelled)acceptSession(data.access_token,data.refresh_token);
  };
  if(access){
   clear();
   fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+access}})
    .then(async r=>{if(!r.ok)throw Error("Sign-in session expired. Please try again.");return r.json();})
    .then(()=>{if(!cancelled){if(refresh)acceptSession(access,refresh);else setError("Sign-in did not include a refresh token. Please sign in again.");}})
    .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Sign-in failed");});
  }else if(tokenHash&&(type==="magiclink"||type==="email")){
   clear();
   fetch(url+"/auth/v1/verify",{method:"POST",headers:headers(),body:JSON.stringify({token_hash:tokenHash,type})})
    .then(async r=>{const data=await r.json();if(!r.ok||!data.access_token)throw Error(data.msg||data.error_description||"Sign-in link expired");return data;})
    .then(data=>{if(!cancelled){if(data.refresh_token)acceptSession(data.access_token,data.refresh_token);else setError("Session token missing. Please sign in again.");}})
    .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Sign-in failed");});
  }else if(hash.get("error_description")){
   setError(hash.get("error_description")||"Authentication failed");clear();
  }else{
   const session=readSession();
   if(session){lastActivity.current=session.last_activity;refreshSession(session.refresh_token).catch(e=>{if(!cancelled){clearSession();setError(e instanceof Error?e.message:"Session restoration failed");}});}
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
   if(strategyMode&&portfolio.length){const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({mode:"review",offers:portfolio,messages:next.slice(-8)})});const data=await r.json();if(!r.ok)throw Error(data.error||"Strategy adviser unavailable");const changed=portfolio.filter((o,i)=>JSON.stringify(o)!==JSON.stringify(data.offers?.[i])).map(o=>o.type);if(changed.length)setApproved(v=>v.filter(t=>!changed.includes(t)));if(Array.isArray(data.offers))setPortfolio(data.offers);setMessages([...next,{role:"assistant",content:data.reply}]);return;}
   const spoken=entry.trim();
   const quantity=spoken.match(/(?:first|up to|limit(?:ed)? to|honor|allow|offer)\\s+(\\d{1,6})\\s+(?:redemptions?|coupons?|customers?)/i)||spoken.match(/(\\d{1,6})\\s+(?:redemptions?|coupons?)/i);
   const perOffer=/each|per offer|apiece|all three|all 3/i.test(spoken);
   const untilLimit=/until (?:they(?:'re| are) all|the limit|all .*redeemed|capacity)|no expiration|until sold out/i.test(spoken);
   const duration=spoken.match(/(?:for|over)\\s+(\\d{1,3})\\s+(days?|weeks?|months?)/i);
   if(portfolio.length&&(quantity||untilLimit||duration)){
     const limit=quantity?quantity[1]:null;
     setPortfolio(old=>old.map(o=>({...o,
       redemption_limit:limit&&(perOffer||old.length===1)?limit+" honored redemptions":o.redemption_limit,
       expiration:untilLimit?"Until redemption capacity reached":duration?"After "+duration[1]+" "+duration[2]+" (start date to confirm)":o.expiration
     })));
     setPolicySummary([limit?(perOffer?limit+" redemptions per offer":limit+" redemptions mentioned — allocation across offers to confirm"):"Redemption limit unchanged",untilLimit?"Until capacity reached":duration?duration[1]+" "+duration[2]:"Duration unchanged"].join(" · "));
     if(limit&&!perOffer&&portfolio.length>1){setMessages([...next,{role:"assistant",content:"I can set "+limit+" redemptions for each offer, or divide that total across the three. Which did you intend?"}]);setBusy(false);return;}
     setMessages([...next,{role:"assistant",content:"I've updated the draft redemption policy. You can continue making changes by chatting; the preview updates automatically. No coupons have been issued or published."}]);setBusy(false);return;
   }
   // The assistant creates the complete three-offer portfolio as part of the conversation.
   // Do not force the merchant to pick a coupon type or find a separate builder button.
   const merchantTurns=next.filter(m=>m.role==="user");
   const wantsOffers=/\\b(both|all three|all 3|three offers|create|generate|draft|make (?:the|my|some) offers|let.s do it)\\b/i.test(entry);
   const hasBusinessContext=merchantTurns.some(m=>/\\b(pizza|restaurant|shop|store|salon|cafe|coffee|gym|fitness|barber|retail|business|bakery|spa|service)\\b/i.test(m.content));
   const automaticPortfolio=hasBusinessContext&&(wantsOffers||merchantTurns.length>=2);
   const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({messages:next.slice(-12),...(automaticPortfolio?{mode:"portfolio"}:{})})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"Offer assistant unavailable");
   setMessages([...next,{role:"assistant",content:data.reply}]);setMerchantId(data.merchant_id||"");
   if(automaticPortfolio&&Array.isArray(data.offers)){setPortfolio(data.offers);setApproved([]);setStrategyMode(false);setChosen(["FREE","BOGO","50% OFF"]);setDraft(null);setStrategy(null);setNotice("All three offers are ready below. Confirm the terms, then choose which drafts to save.");}
   else {setDraft(data.ready?data.draft:null);setStrategy(data.strategy||null);}
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
 }
 async function generatePortfolio(){
  if(busy||messages.every(m=>m.role!=="user"))return;
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/.netlify/functions/merchant-offer",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({mode:"portfolio",messages:messages.slice(-12)})});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to generate offers");setPortfolio(data.offers);setMerchantId(data.merchant_id);setChosen(["FREE","BOGO","50% OFF"]);setNotice("Three promotional concepts generated. Review and confirm each offer's terms before submission.");}catch(e){setError(e instanceof Error?e.message:"Portfolio unavailable");}finally{setBusy(false);}
 }
 async function savePortfolio(){
  if(busy||!merchantId||!chosen.length||chosen.some(t=>!approved.includes(t)))return;
  const offers=portfolio.filter(o=>chosen.includes(o.type));
  setBusy(true);setError("");
  try{for(const o of offers){const payload={merchant_id:merchantId,title:o.title,description:o.description,type:o.type,terms:o.terms,expiration:o.expiration,redemption_limit:o.redemption_limit,redemption_method:o.redemption_method,status:"draft"};const r=await fetch(url+"/rest/v1/offers",{method:"POST",headers:{...headers(),Authorization:"Bearer "+token,Prefer:"return=minimal"},body:JSON.stringify(payload)});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.message||"Could not save "+o.type);}}setPortfolio([]);setShowOffers(true);setNotice("Merchant-approved offers saved as drafts. Finalize administrator review submission in Offers & Reviews.");}catch(e){setError(e instanceof Error?e.message:"Could not save offers");}finally{setBusy(false);}
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
 <><div className="studio-review-nav"><button onClick={()=>setShowOffers(false)}>AI Offer Builder</button><button onClick={()=>setShowOffers(true)}>Offers & Reviews</button></div>{showOffers?<OfferApproval token={token}/>:<div className="studio-layout"><section className="studio-chat"><div className="studio-chat-title"><div><strong>Offer Builder</strong><p>Describe your promotion in your own words.</p></div><button onClick={()=>{setToken("");clearSession();setDraft(null);setStrategy(null);setMerchantId("");}}><LogOut size={16}/> Sign out</button></div><div className="studio-messages" ref={messageEndRef} aria-live="polite">{messages.map((m,i)=><ChatMessage key={i} message={m} onProgress={scrollChat}/>)}{busy&&<p className="studio-thinking">Working on your offer…</p>}</div><form className="studio-composer" onSubmit={e=>{e.preventDefault();send()}}><input aria-label="Describe your offer" maxLength={1500} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Tell me about your business…"/><button type="button" className={listening?"studio-mic listening":"studio-mic"} onClick={toggleDictation} disabled={!dictationSupported||busy} title={dictationSupported?(listening?"Stop dictation":"Dictate a message"):"Dictation unavailable in this browser"} aria-label={listening?"Stop dictation":"Start voice dictation"} aria-pressed={listening}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><button type="submit" disabled={busy||!entry.trim()} aria-label="Send message"><Send size={18}/></button></form><button className="studio-save" onClick={generatePortfolio} disabled={busy||messages.every(m=>m.role!=="user")}>Regenerate all three offers</button></section><aside className="studio-preview"><span className="studio-kicker">LIVE PREVIEW</span><h2>{draft?.title||(strategy?.recommendation?"Recommended: "+strategy.recommendation:"Your offer will appear here.")}</h2>{strategy?.rationale&&<div className="studio-strategy"><strong>Marketing strategy</strong><p>{strategy.rationale}</p>{strategy.assumptions.length>0&&<p><b>Assumptions:</b> {strategy.assumptions.join("; ")}</p>}{strategy.risks.length>0&&<p><b>Watch for:</b> {strategy.risks.join("; ")}</p>}{strategy.comparisons.length>0&&<details><summary>Other options</summary>{strategy.comparisons.map((c,i)=><p key={i}><b>{c.type}:</b> {c.tradeoff}</p>)}</details>}</div>}{portfolio.length>0&&<div className="studio-portfolio"><h3>Your three-offer portfolio</h3><p>Choose any combination. Your subscription fee stays the same.</p><p className="studio-policy-summary">{policySummary}</p><p>To change the terms, just tell me in chat, for example: “100 redemptions for each offer, available until the limit is reached.”</p>{portfolio.map(o=><div className="studio-portfolio-card" key={o.type}><label className="studio-portfolio-choice"><input type="checkbox" checked={chosen.includes(o.type)} onChange={e=>setChosen(v=>e.target.checked?[...v,o.type]:v.filter(t=>t!==o.type))}/><b>{o.type}</b><strong>{o.title}</strong></label><div className="studio-merchant-actions"><button type="button" onClick={()=>setEditingOffer(v=>v===o.type?null:o.type)}>{editingOffer===o.type?"Close editor":"Edit offer"}</button><button type="button" aria-pressed={approved.includes(o.type)} onClick={()=>setApproved(v=>v.includes(o.type)?v.filter(t=>t!==o.type):[...v,o.type])}>{approved.includes(o.type)?"✓ Merchant approved":"Approve as merchant"}</button></div><p className="studio-portfolio-rationale">{o.rationale}</p>{editingOffer===o.type&&<div className="studio-portfolio-fields">{(["title","description","terms","expiration","redemption_limit","redemption_method","merchant_name"] as const).map(k=><label key={k}><span>{k.replaceAll("_"," ")}</span><textarea rows={k==="description"||k==="terms"?3:1} value={o[k]} onChange={e=>{setApproved(v=>v.filter(t=>t!==o.type));setPortfolio(v=>v.map(x=>x.type===o.type?{...x,[k]:e.target.value}:x));}}/></label>)}</div>}<div className="studio-portfolio-details"><p><b>Terms:</b> {o.terms}</p><p><b>Redemption capacity:</b> {o.redemption_limit}</p><p><b>Duration:</b> {o.expiration}</p><p><b>Redemption:</b> {o.redemption_method}</p></div><p className="studio-portfolio-risk"><b>Consider:</b> {o.risks}</p></div>)}<button className="studio-save" type="button" disabled={busy||!chosen.length||chosen.some(t=>!approved.includes(t))} onClick={()=>{setStrategyMode(true);setMessages(v=>[...v,{role:"assistant",content:"Your selected drafts are merchant-approved for strategy review—not submitted or published. Let’s examine customer acquisition, repeat visits, slow periods and contribution margins. What is your most important goal for these promotions?"}]);}}>Discuss approved offers with AI adviser</button>{strategyMode&&<p className="studio-policy-summary">Strategy discussion active. AI revisions require renewed merchant approval.</p>}<ProfitSimulator offers={portfolio} selected={chosen}/><button className="studio-save" disabled={busy||chosen.length===0||chosen.some(t=>!approved.includes(t))||!strategyMode} onClick={savePortfolio}>Submit for Deployment: {chosen.length} offer(s)</button><small>Creates drafts in the administrator review workflow; final submission and publication require separate approval. Nothing is published automatically.</small></div>}{draft?<><span className="studio-offer-type">{draft.type}</span><p>{draft.description}</p><dl>{(["merchant_name","terms","expiration","redemption_limit","redemption_method"] as const).map(k=><div key={k}><dt>{k.replaceAll("_"," ")}</dt><dd>{draft[k]}</dd></div>)}</dl><button className="studio-save" onClick={save} disabled={busy||saved}><Save size={16}/>{saved?"Draft saved":"Save draft"}</button><small>Saved as draft only. Not publicly visible.</small></>:<p>Chat with the assistant to generate a complete offer. Nothing is published automatically.</p>}</aside>{error&&<p className="studio-error" role="alert">{error}</p>}</div>}</>}</main>;
}
