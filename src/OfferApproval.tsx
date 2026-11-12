import {useEffect,useState} from "react";
import "./approval.css";
type Offer={id:string;merchant_id:string;title:string;description:string;type:string;terms:string;expiration:string;redemption_limit:string;redemption_method:string;status:string;review_version:number;approved_version:number|null};
type Event={id:string;action:string;notes:string|null;created_at:string;proposed_revision_id:string|null};
type Revision={id:string;revision_number:number;role:string;title:string;description:string;type:string;terms:string;expiration:string;redemption_limit:string;redemption_method:string};
const fields=["title","description","type","terms","expiration","redemption_limit","redemption_method"] as const;
export default function OfferApproval({token}:{token:string}){
 const [offers,setOffers]=useState<Offer[]>([]),[admin,setAdmin]=useState(false),[selected,setSelected]=useState<Offer|null>(null);
 const [events,setEvents]=useState<Event[]>([]),[revisions,setRevisions]=useState<Revision[]>([]);
 const [notes,setNotes]=useState(""),[proposal,setProposal]=useState<Record<string,string>>({}),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const request=async(path:string,options:RequestInit={})=>{const r=await fetch("/.netlify/functions/offer-approval"+path,{...options,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...options.headers}});const data=await r.json();if(!r.ok)throw Error(data.error||"Request failed");return data;};
 const refresh=async()=>{const data=await request("?view=offers");setOffers(data.offers);setAdmin(data.isAdmin);};
 useEffect(()=>{refresh().catch(e=>setError(String(e)));},[token]);
 const choose=async(o:Offer)=>{setSelected(o);setProposal(Object.fromEntries(fields.map(k=>[k,o[k]])));setEditing(false);setNotes("");setError("");setNotice("");try{const data=await request("?view=history&offer_id="+o.id);setEvents(data.events);setRevisions(data.revisions);}catch(e){setError(String(e));}};
 const act=async(action:string)=>{
  if(!selected||busy)return;setBusy(true);setError("");setNotice("");
  try{
   const changed=fields.some(k=>proposal[k]!==selected[k]);
   if(action==="request_changes"&&!notes.trim())throw Error("Please include notes explaining the requested changes.");
   if(action==="decline"&&!notes.trim())throw Error("Please include a reason for declining.");
   const payload={action,offer_id:selected.id,notes,proposal:(action==="request_changes"||action==="submit")&&changed?proposal:null};
   await request("",{method:"POST",body:JSON.stringify(payload)});
   setNotice(action==="approve"?"Offer approved and published.":action==="submit"?"Offer submitted for review.":action==="decline"?"Offer declined.":"Changes requested and merchant notified in dashboard.");
   await refresh();setSelected(null);setEvents([]);setRevisions([]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to update offer");}finally{setBusy(false);}
 };
 const latestProposal=events.slice().reverse().find(e=>e.action==="changes_requested"&&e.proposed_revision_id);
 const adminRevision=revisions.find(r=>r.id===latestProposal?.proposed_revision_id);
 return <section className="approval"><div className="approval-heading"><div><span>OFFER MANAGEMENT</span><h2>{admin?"Administrator Review Queue":"Your Offers"}</h2><p>{admin?"Review submitted promotions, propose edits, and control publication.":"Submit your FREE, BOGO and 50% OFF offers independently."}</p></div><button onClick={()=>refresh().catch(e=>setError(String(e)))}>Refresh</button></div>
 {notice&&<p className="approval-notice">{notice}</p>}{error&&<p className="approval-error" role="alert">{error}</p>}
 <div className="approval-layout"><div className="approval-list">{offers.length===0?<p>No offers to review yet. Create and save offers in the AI builder first.</p>:offers.map(o=><button className={selected?.id===o.id?"approval-item active":"approval-item"} key={o.id} onClick={()=>choose(o)}><span className="approval-type">{o.type}</span><strong>{o.title}</strong><small>{o.status.replaceAll("_"," ")} · Version {o.review_version}</small></button>)}</div>
 <div className="approval-detail">{!selected?<p>Select an offer to review its terms, status and history.</p>:<><div className="approval-detail-head"><h3>{selected.title}</h3><span>{selected.status.replaceAll("_"," ")}</span></div><div className="approval-form">{fields.map(k=><label key={k}>{k.replaceAll("_"," ")}{editing?<input value={proposal[k]||""} onChange={e=>setProposal(v=>({...v,[k]:e.target.value}))}/>:<p>{proposal[k]||"—"}</p>}</label>)}</div>
 {adminRevision&&!admin&&selected.status==="changes_requested"&&<button className="approval-alt" onClick={()=>{setProposal(Object.fromEntries(fields.map(k=>[k,adminRevision[k]])));setEditing(true);}}>Apply administrator's proposed changes</button>}
 <div className="approval-history"><h4>Review history</h4>{events.length===0?<p>No review events yet.</p>:events.map(e=><div key={e.id}><strong>{e.action.replaceAll("_"," ")}</strong><small>{new Date(e.created_at).toLocaleString()}</small>{e.notes&&<p>{e.notes}</p>}</div>)}</div>
 <div className="approval-actions">{admin&&selected.status==="pending_review"?<><button onClick={()=>act("approve")} disabled={busy}>Approve & publish</button><button className="approval-alt" onClick={()=>setEditing(!editing)}>{editing?"Stop editing":"Suggest edits"}</button><textarea placeholder="Notes for merchant (required when requesting changes)" value={notes} onChange={e=>setNotes(e.target.value)}/><button className="approval-alt" disabled={busy||!notes.trim()} onClick={()=>act("request_changes")}>Return with changes</button><button className="approval-danger" disabled={busy||!notes.trim()} onClick={()=>act("decline")}>Decline offer</button></>:!admin&&(selected.status==="draft"||selected.status==="changes_requested")?<><button className="approval-alt" onClick={()=>setEditing(!editing)}>{editing?"Preview offer":"Edit offer"}</button><button disabled={busy} onClick={()=>act("submit")}>{selected.status==="draft"?"Approve & submit for review":"Approve revisions & resubmit"}</button></>:<p>This offer is awaiting action or already finalized.</p>}</div></>}</div></div></section>;
}
