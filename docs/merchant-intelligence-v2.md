# Qponic Merchant Intelligence Engine v2 — Specification
Status: isolated feature branch; do not deploy to production until evaluated.

## Product promise
A strategic retail marketing partner with the conversational friendliness of a helpful assistant. Optimize expected **incremental contribution**, not customer discount percentage. No guaranteed ROI.

## Three coordinated engines
1. **Conversation** — discover merchant category, business objective, offer economics, capacity, new/existing customer mix, and constraints. Ask one meaningful question per turn, remember earlier answers, and handle merchants reviewing existing offers.
2. **Strategy** — evaluate FREE, BOGO and 50% OFF using explicitly supplied or labeled hypothetical prices, variable costs, eligible quantity, capacity, redemption expectations, cannibalization, and future customer value. Distinguish measured data from assumptions. Do not make up benchmarks. If economics are unknown, recommend conditionally and ask the most valuable missing question.
3. **Creation** — generate persuasive but accurate copy, terms, eligibility, validity, redemption limit and method. The merchant must explicitly approve the final draft. Saving creates a draft; submitting for review is a separate action; only an authorized administrator can publish.

## Category reasoning
Restaurants/cafes: off-peak capacity, attachment, ingredient and labor cost, check size.
Beauty/wellness: appointment availability, staff compensation, first-visit vs repeat, treatment costs.
Fitness/classes: unused seats, retention and membership conversion, instructor costs.
Entertainment: unused tickets, venue capacity, concessions and blackout dates.
Retail: inventory age, unit landed cost, return rates, cross-sell and cannibalization.
Hospitality/travel: perishable inventory, variable occupancy cost, blackout dates and seasonality.
Auto/home services: technician hours, materials, scope boundaries and lead quality.
Pets/education/other services: repeat cycle, staffing and eligibility.
Restricted industries: refuse prohibited or misleading promotions; request compliant alternative.

## Economics
Immediate incremental contribution = incremental promotion revenue - incremental fulfillment costs - campaign-specific costs - displaced full-price contribution.
Expected campaign contribution = immediate incremental contribution + conservatively estimated *incremental* future contribution.
Compare options on equivalent assumptions. A FREE unit is not automatically profitable; BOGO doubles unit fulfillment; 50% OFF may cannibalize full-price sales. Offer-level calculations are illustrative unless merchant supplies actual inputs. The AI cannot guarantee ROI.

## Conversation & output contract
JSON only: {reply,ready,draft,strategy}. One question maximum in reply. strategy contains goal, recommendation, rationale, assumptions, risks, and comparisons. draft has title, description, type, terms, expiration, redemption_limit, merchant_name, redemption_method. Never invent missing draft terms. ready requires all mandatory draft fields and merchant explicit intent to proceed with the proposed promotion; never implies approval or publication.

## Original merchant logic retained
Three offer types; merchant controls timing, quantity, restrictions and cancellation; redemption limits apply to validated redemptions rather than saves; no checkout/payments on Qponic; staff can validate unique QR codes in a future release. A review/approval queue and QR issuance are future backend features and must not be represented as working.

## Launch gates
Validate JSON/schema, security/ownership, economic scenarios, prompt injection resilience, business categories, and usability. Test at least restaurant, salon, retail, fitness, home services, and entertainment scenarios. Verify deployed function with an authenticated merchant before merging. Keep the existing develop deployment unchanged.
