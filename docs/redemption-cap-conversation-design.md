# Redemption-cap campaign policy — design and rollout
Merchant commitment is the maximum number of successful redemptions, not claims/downloads. Consumers may claim while campaign is active, but claiming does not reserve fulfillment. First verified redemptions win. A campaign defaults to active until redemption capacity is exhausted; optional date expiry is a separate rule. Merchants may increase caps with confirmation or authorize a one-time exception for a specific eligible, unused credential; all changes must be authenticated and audited.

## Merchant conversation
No editing form in the generated three-offer portfolio. Read-only cards reflect structured terms. Merchant may specify a count per offer and duration in chat. Ambiguous counts must trigger a clarification, never silently assign a shared cap. Incomplete drafts may be saved; submission requires complete confirmed terms. The current implementation has basic deterministic parsing for explicit counts/durations; it is not yet a general structured chat state engine.

## Financial simulator
Model full campaign maximum honored redemptions, not monthly downloads. Estimate incremental contribution and cannibalization, then deduct subscription fees over a merchant-specified estimated number of months. $29 first month, $79 thereafter; subscription charged once across all offers. Redemptions beyond cap are excluded unless separately approved. Results are assumptions, not guaranteed outcomes.

## Implementation boundaries
This branch updates merchant UI and simulator only. Consumer accounts, wallet linkage, Solana issuance, QR signing, atomic redemption counters, merchant cap adjustments, one-time exception authorization, and ledger burn/consumption remain to be built and security-tested. Do not imply those features are operational. The published offer remains an off-chain entitlement until user claim, as described in the provisional specification. Do not merge until QA passes.

## Critical next backend work
Create normalized numeric redemption_limit, redeemed_count, expiry_policy and optional expiry timestamp, a unique user-offer claim constraint, authoritative atomic redemption and capacity checks, exception grant records bound to a specific claim, idempotency keys, audit log, and server-only authorization. Treat device heuristics as supplemental abuse controls, not a reliable unique identity. Test concurrency at cap 100 with two simultaneous claims/redemptions, expired campaigns, exceptions, repeat scans, and on-chain transaction finality. Coordinate patent scope and filing with counsel.
