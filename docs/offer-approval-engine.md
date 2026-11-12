# Qponic Offer Approval Engine — v1 specification

## Independent offers
A merchant may draft FREE, BOGO, and 50% OFF promotions and submit any one, two, or three. Each offer is reviewed independently. The merchant's subscription price does not change with the number selected.

## Lifecycle
draft -> pending_review -> published
pending_review -> changes_requested -> pending_review (new merchant-approved revision)
pending_review -> declined (terminal)
A merchant approves the exact revision they submit. An administrator may approve without changes, request changes with mandatory notes and optionally a complete proposed revision, or decline with a reason. The merchant can apply the admin's proposed revision, adjust it, and explicitly resubmit. Resubmission always returns to pending_review; it never auto-publishes.

## Security
Only merchant members may submit their merchant's drafts. Only allowlisted Qponic administrators may approve, decline, or request changes. All state transitions execute atomically in the database under a server-authenticated actor. Audit events and offer revisions are append-only through the privileged RPC. Consumer-facing listings must filter status='published' and approved_version=review_version.

## Notifications
In-app notification rows are created for administrators when offers are submitted, and for merchants when reviews occur. Email delivery is not yet implemented; do not claim emails are sent.

## Current boundaries
This feature branch contains merchant and admin review UI, event history, versioning, proposed changes, and in-app notification records. The AI currently creates a single draft; generating three complete offer candidates from one conversation and bulk selection remains a separate required integration step. Publishing to the consumer marketplace, notifications UI, merchant billing entitlement enforcement, and end-to-end integration tests are still outstanding. Do not merge or release until these are validated.
