import {useMemo,useState} from "react";
import "./profit-simulator.css";
export type OfferKind="FREE"|"BOGO"|"50% OFF";
export type OfferInput={type:string;title:string};
type Model={price:number;cost:number;addonCost:number;redemptions:number;displacement:number};
const initial:Record<OfferKind,Model>={
 "FREE":{price:20,cost:7,addonCost:2,redemptions:25,displacement:20},
 "BOGO":{price:20,cost:7,addonCost:0,redemptions:25,displacement:20},
 "50% OFF":{price:20,cost:7,addonCost:0,redemptions:25,displacement:20}
};
const kinds:OfferKind[]=["FREE","BOGO","50% OFF"];
const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;
export function computePromotion(type:OfferKind,m:Model){
 const full=m.price-m.cost;
 // FREE: a low-cost gift attached to a full-price purchase.
 // BOGO: two full-size units for one regular unit price.
 // HALF OFF: one discounted unit.
 const promo=type==="FREE"?m.price-m.cost-m.addonCost:type==="BOGO"?m.price-2*m.cost:m.price/2-m.cost;
 const d=m.displacement/100;
 const perRedemption=(1-d)*promo+d*(promo-full);
 const contribution=m.redemptions*perRedemption;
 return {full,promo,perRedemption,contribution,incremental:Math.round(m.redemptions*(1-d)),displaced:Math.round(m.redemptions*d)};
}
export default function ProfitSimulator({offers,selected}:{offers:OfferInput[];selected:string[]}){
 const [models,setModels]=useState(initial);
 const [intro,setIntro]=useState(false);
 const [low,setLow]=useState(0.5);
 const [high,setHigh]=useState(1.5);
 const active=kinds.filter(k=>selected.includes(k)&&offers.some(o=>o.type===k));
 const fee=intro?29:79;
 const results=useMemo(()=>active.map(k=>({type:k,...computePromotion(k,models[k])})),[models,selected,offers]);
 const contribution=results.reduce((sum,r)=>sum+r.contribution,0);
 const net=contribution-fee;
 const update=(kind:OfferKind,key:keyof Model,v:string)=>setModels(old=>({...old,[kind]:{...old[kind],[key]:clamp(Number(v),0,key==="displacement"?100:100000)}}));
 const scenario=(factor:number)=>results.reduce((sum,r)=>sum+r.perRedemption*models[r.type].redemptions*factor,0)-fee;
 const breakEven=contribution>0&&results.length>0?Math.ceil(fee/contribution*results.reduce((sum,r)=>sum+models[r.type].redemptions,0)):null;
 return <section className="profit-simulator" aria-label="Qponic Profit Simulator">
 <div className="profit-head"><span>ESTIMATED ECONOMICS</span><h3>Qponic Profit Simulator</h3><p>Estimate how the selected promotions could perform together. All values below are editable assumptions—not sales forecasts.</p></div>
 <div className="profit-fee"><span>Subscription period</span><div><button aria-pressed={!intro} onClick={()=>setIntro(false)}>Ongoing · $79/mo</button><button aria-pressed={intro} onClick={()=>setIntro(true)}>First month · $29</button></div></div>
 {kinds.map(k=>{const m=models[k];const r=computePromotion(k,m);const included=active.includes(k);return <div className={"profit-offer"+(included?"":" muted")} key={k}><div className="profit-offer-head"><strong>{k}</strong><span>{included?"Included in total":"Not selected"}</span></div><p className="profit-offer-title">{offers.find(o=>o.type===k)?.title||"Offer not generated"}</p><div className="profit-inputs">
 <label>Regular item price ($)<input aria-label={k+" regular item price"} type="number" min="0" step="0.5" value={m.price} onChange={e=>update(k,"price",e.target.value)}/></label>
 <label>Variable cost per item ($)<input aria-label={k+" variable cost"} type="number" min="0" step="0.5" value={m.cost} onChange={e=>update(k,"cost",e.target.value)}/></label>
 {k==="FREE"&&<label>Cost of free add-on ($)<input aria-label="FREE add-on cost" type="number" min="0" step="0.5" value={m.addonCost} onChange={e=>update(k,"addonCost",e.target.value)}/></label>}
 <label>Monthly redemptions<input aria-label={k+" monthly redemptions"} type="number" min="0" step="1" value={m.redemptions} onChange={e=>update(k,"redemptions",e.target.value)}/></label>
 <label>Displaced full-price orders (%)<input aria-label={k+" displacement percent"} type="number" min="0" max="100" step="5" value={m.displacement} onChange={e=>update(k,"displacement",e.target.value)}/></label>
 </div><div className="profit-line"><span>Contribution per redeemed offer</span><b>{money(r.promo)}</b></div><div className="profit-line"><span>Net incremental contribution before platform fee</span><b>{money(r.contribution)}</b></div>
 {r.promo<0&&<p className="profit-warning">This offer has negative contribution even before accounting for displaced sales.</p>}</div>})}
 <div className="profit-total"><span>Estimated monthly net benefit after platform fee</span><strong className={net>=0?"positive":"negative"}>{money(net)}</strong><small>{active.length} selected offer{active.length===1?"":"s"} · one shared {money(fee)} monthly fee</small></div>
 <div className="profit-scenarios"><h4>Redemption volume scenarios</h4><div><span>Conservative (50%)</span><b>{money(scenario(low))}</b></div><div><span>Base (100%)</span><b>{money(net)}</b></div><div><span>Higher volume (150%)</span><b>{money(scenario(high))}</b></div></div>
 <p className="profit-break-even">Estimated break-even: <strong>{breakEven===null?"Not achievable under these assumptions":breakEven+" total monthly redemptions"}</strong> at the modeled offer mix.</p>
 <p className="profit-disclaimer">Illustrative only. FREE assumes a free low-cost add-on with a full-price item; BOGO assumes two items for the price of one. Displaced sales represent purchases that would otherwise occur at full price. These estimates exclude extra labor, marketing, taxes, changes in basket size, repeat purchases, and interactions between simultaneous offers. Do not add redemptions across offers if the same order uses more than one offer. Qponic does not guarantee additional sales or profit.</p>
 </section>;
}
