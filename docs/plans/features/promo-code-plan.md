# Promo Code Plan

## Summary

Add promo code support as a new feature.

Promo codes do not exist in the codebase today.

This document reflects the narrowed agreement for v1:

- support only `buy_x_get_y_free`
- do not implement percentage, fixed, free-shipping, or admin-selected free-variant promos
- the free item (`y`) is derived from the customer's eligible cart lines, not chosen by admin

The goal is to keep the first version small, explicit, and compatible with the current Capella architecture.

## Current Repo State

Promo codes are not implemented anywhere in the current flow.

Current checkout and pricing path:

- storefront cart and checkout UI collect raw cart lines
- storefront checkout sends items directly to the API
- API validates checkout payload basics
- order creation service prices lines directly from current product variant, offer, or collection prices
- order persistence stores only the final order items and `totalAmount`

Relevant current behavior:

- checkout is server-priced
- payment method is currently `cod` only
- cart can contain:
  - product variants
  - offers
  - collections
- there is currently no order-level discount model
- there is currently no promo field in shared DTOs or checkout schemas
- there is currently no promo usage history or redemption tracking

Implication:

- promo validation and pricing authority must live on the API side
- storefront can assist UX, but cannot be the source of truth

## Product Direction

Plan only the domain that is actually agreed.

Do not build a generic promo-rule engine in v1.

Do not leave old promo types in the plan "for later" if they are not part of the current agreement.

The correct direction is:

- one promo family only
- server-side validation
- stable order snapshots
- room to extend later without pretending unused types already exist

## V1 Scope

### Included

- one promo code per order
- `buy_x_get_y_free`
- active/inactive admin status
- `starts_at`
- `expires_at`
- minimum subtotal rule if needed per promo
- first-order-only rule
- global usage cap
- per-user usage cap
- all-users promos
- specific-user promos

### Explicitly Out Of Scope

- percentage discount
- fixed discount
- free shipping
- admin-selected gifted variants
- promo stacking
- offers-targeted promos
- collections-targeted promos
- mixed carts with promo support
- user segments
- shipping destination rules
- payment-method rules
- generic item-targeted discount rules beyond BXGY
- refunds and redemption release behavior implementation

## Core Domain Model

Promo-code thinking should stay separated into these concerns:

- benefit
- eligibility
- limits
- scope
- audit

### Benefit

Supported benefit family in v1:

- `buy_x_get_y_free`

Business meaning:

- the customer buys eligible quantity `x`
- the customer receives eligible quantity `y` for free
- the free quantity is derived from the customer's own cart lines
- admin defines the promo rule, not the exact gifted line instance

Important note:

- this is not a numeric order discount
- this is line-level pricing behavior
- free items must be represented explicitly in pricing and order history

### Eligibility

Supported v1 eligibility:

- all users
- specific users
- first order only
- minimum product-only subtotal

Specific-user matching must be stored by `customerId`, not by name or email.

ERP user search may search by name, but the displayed result should include:

- customer name
- customer email

The saved reference must still be `customerId`.

### Limits

Supported v1 limits:

- global usage cap
- per-user usage cap

Promo usage is consumed on successful order placement.

Promo usage is not consumed when a customer merely types or applies a code in the cart UI.

### Scope

V1 promo scope is strict:

- promo codes apply only to carts whose lines are all product variants
- if any offer or collection is present in the cart, promo usage is rejected

User-facing rejection reason should be explicit:

- promo codes are not applicable on offers or collections

### Audit

Orders using promos must preserve enough history so old orders remain understandable even if:

- promo definitions change later
- promo is deactivated later
- catalog prices change later

History must remain frozen.

Future promo edits affect only future orders.

## BXGY Rules

### Promo Type

The only supported promo type is:

- `buy_x_get_y_free`

Suggested rule shape:

- `buy_quantity`
- `free_quantity`

Example meaning:

- buy `2`, get `1` free
- buy `3`, get `1` free

Important note:

- the implementation should validate only the agreed BXGY behavior
- do not carry old percentage/fixed/free-shipping branches into code or schema unless truly required for forward compatibility

### Free Item Derivation

Core agreement:

- `y` is derived from the customer's eligible cart content
- admin does not preselect the free variant

Practical meaning:

- the checkout service evaluates eligible product-variant lines in the cart
- it determines how many units qualify as free under the promo rule
- it marks or creates free quantity from the customer's own qualifying lines

Recommended pricing direction:

- choose the cheapest eligible units as the free units unless a different business rule is later agreed explicitly

Reason:

- this is deterministic
- it avoids accidental over-discounting
- it is easy to explain and test

If the business wants a different derivation rule, that rule must be documented explicitly before implementation.

### Representation Rule

Free quantity must be represented explicitly.

Do not silently reduce paid quantity without preserving promo meaning.

Recommended representation:

- separate promo-generated free order lines when splitting is needed

Example:

- `2 x variant A @ 300 EGP`
- `1 x variant A @ free`

If multiple lines participate, the resulting order snapshot must still clearly show:

- original bought quantity
- free quantity
- charged unit price
- promo-generated marker

Reason:

- clearer audit trail
- clearer ERP and storefront display
- safer historical pricing interpretation

## Eligibility Rules

### Minimum Subtotal

Definition:

- subtotal is the sum of bought product-variant lines only
- shipping is excluded
- promo-generated free quantity is excluded

This minimum subtotal is evaluated before promo effects are applied.

### First Order

Definition:

- first placed order
- cancellation, refund, or payment outcome do not matter
- once the customer places an order, the first-order promo opportunity is consumed

Logged-in rule:

- if a promo requires first-order validation, the customer must be logged in
- if the customer is not logged in, the promo is rejected immediately

Reason:

- first-order logic is enforced by `customerId`
- guest fallback is intentionally not used

### Specific Users

Definition:

- promo can be limited to specific existing customers
- matching is done by `customerId`

ERP rule:

- customer search can use names
- results should display `name + email`
- saved association must use ids

## Status And Time

### Status

Administrative status:

- `active`
- `inactive`

Status is only the first gate.

Meaning:

- inactive promo is immediately unusable
- active promo still must pass deeper validation rules

### Time

Supported fields:

- `starts_at`
- `expires_at`

Important distinction:

- active does not mean currently usable
- a promo may be active and still be:
  - not started yet
  - expired
  - over usage cap
  - ineligible for this customer
  - ineligible for this cart

## One-Code Rule

V1 stacking rule:

- only one promo code can be applied per order

UX rule:

- if a code is already applied, a second code cannot replace it automatically
- user must remove the existing code before trying a different one

## Code Format And Normalization

Promo-code format decision:

- promo codes are uppercase everywhere

Normalization rules:

- trim input
- uppercase before save
- uppercase before lookup

Examples:

- `BXGY10`
- `BUY2GET1`
- `SUMMERFREE`

Important implementation note:

- uniqueness should be enforced on the normalized stored code

## Usage Tracking

Usage must be tracked with history, not only a mutable counter.

Recommended direction:

- keep a redemption history table tied to promo and order
- aggregate counters may exist for convenience, but history is the source of truth

Required usage identity:

- per-user usage is keyed by `customerId`

Consumption rule:

- a promo usage is consumed on successful order placement

Current business direction:

- if refunds or cancellations are introduced later, redemption remains consumed unless future business rules change it
- no refund logic exists yet, so this should be flagged but not implemented now

## Order History And Snapshot Rules

Order history must remain immutable in meaning.

Meaning:

- old placed orders must not change because promo definition changes
- old placed orders must not change because catalog price changes
- old placed orders must not change because the promo later expires or is deactivated

Recommended snapshot data to persist for promo-applied orders:

- promo id
- promo code
- promo type
- order subtotal before promo
- derived free quantity details
- final total

Recommended snapshot data for promo-generated free lines:

- variant id
- variant display names
- size label
- original unit price at checkout time
- actual charged unit price
- promo-generated marker

## Editing Orders

Business rule:

- order history stays frozen
- future checkouts re-evaluate against the current promo definition

Important clarification:

- promo changes affect new orders only
- already placed orders do not get retroactively recalculated because promo config changed later

If order editing is implemented in ERP:

- do not silently rewrite historical meaning
- any pricing recomputation behavior must be deliberate and visible

## Failure Reasons

Do not collapse all failures into a generic invalid-promo response.

The API should support clear machine-level and user-level reasons such as:

- promo not found
- promo inactive
- promo not started
- promo expired
- login required
- first-order only
- customer not eligible
- global usage cap reached
- per-user usage cap reached
- subtotal too low
- promo not applicable on offers or collections
- cart does not satisfy buy quantity
- no eligible free quantity can be derived

Clear failure reasons will matter for:

- storefront UX
- ERP debugging
- support cases
- analytics

## Technical Guardrails

### Server Authority

Promo validity must be rechecked during order placement on the API side.

Client-side apply flows may exist for UX, but the client is not authoritative.

### Race Conditions

Usage-cap checks must be safe under concurrent checkout requests.

Recommended approach:

- validate promo
- consume promo usage
- create order

All inside the same DB transaction.

Recommended locking direction:

- lock the promo row
- lock or protect any related redemption-usage rows needed for cap enforcement

### Checkout Boundary

Promo logic belongs in API pricing and order creation, not in the storefront cart as the source of truth.

The correct shape is:

- storefront sends entered promo code
- API validates promo against customer and cart
- API derives free quantity from the eligible cart lines
- API calculates final pricing and any free lines
- API creates order and promo usage atomically

## Current-Codebase Fit

This feature should follow the existing app boundaries:

- storefront and ERP consume the API
- API owns validation, pricing, and persistence
- database schema owns promo persistence and order snapshot fields
- shared DTOs and schemas own the request and response contract

Likely touch path:

- `apps/storefront`
- `apps/erp`
- `apps/api`
- `packages/shared`
- `packages/database/drizzle/schema.ts`

Expected affected flow:

- storefront cart and checkout UI
- storefront checkout request contract
- ERP promo management pages and forms
- API checkout validation
- API promo evaluation service
- API order creation flow
- promo persistence and redemption history

## Recommended Data-Model Direction

The exact schema is implementation work, but the model should support at least:

- promo definition
- promo-specific user eligibility
- promo usage/redemption history
- order-level promo snapshot

Suggested conceptual entities:

- promos
- promo_eligible_customers
- promo_redemptions

Potential order-level additions:

- promo code reference on order
- promo type on order
- derived-free-quantity snapshot fields
- free-line markers on order items

Important note:

- because the free item is cart-derived, order-item markers are important to distinguish paid quantities from promo-generated free quantities

## ERP Notes

ERP needs promo-management UX that is operationally realistic.

Important notes:

- specific-user selection should not be a blind static dropdown
- it should support search by customer name
- results should display customer name and email
- saved value must be id-based

Admin should configure:

- promo code
- buy quantity
- free quantity
- status
- start and expiry dates
- eligibility and limits

Admin should not configure:

- a fixed gifted variant

## Storefront Notes

Storefront behavior should be explicit and unsurprising.

Expected v1 behavior:

- user enters one code
- if another code is already applied, user must remove the first code first
- if cart contains any offer or collection, promo cannot apply
- if login is required for the promo and user is not logged in, reject immediately
- server result must drive final truth during order placement

For BXGY specifically:

- storefront may preview the effect
- API remains the final authority on which units become free

## Deferred Topics

These topics are intentionally postponed:

- percentage discounts
- fixed discounts
- free shipping promos
- admin-selected free variants
- refunds and releasing consumed promo redemptions
- shipping-destination restrictions
- payment-method restrictions
- customer segments
- offer-targeted promos
- collection-targeted promos
- multi-code stacking
- generic combinability rules

## Final Decisions From Planning

- promo codes do not exist today and must be added as a new domain
- only one promo family is in scope: `buy_x_get_y_free`
- all other promo types are out of scope for this version
- one promo code only per order
- product-only carts are required for promo applicability
- carts containing offers or collections reject promo usage
- first-order promos require login
- first order means first placed order, regardless of later cancellation or payment outcome
- specific-user promos are keyed by `customerId`
- promo codes are uppercase and normalized
- promo usage is consumed on successful order placement
- promo usage history is preferred over counter-only tracking
- the free quantity is derived from the user's eligible cart lines, not chosen by admin
- promo-generated free quantity must remain explicit in order history
- order history remains frozen after placement
- future promo edits affect only future orders
- API is the source of truth for promo validation and pricing
- usage-cap enforcement must be transaction-safe

## Verification Notes For Future Implementation

When implementation starts, verification should include targeted tests for:

- checkout promo validation
- first-order enforcement
- specific-user enforcement
- product-only cart rejection when offers or collections are present
- buy-quantity eligibility rule
- correct derivation of free quantity from eligible cart lines
- promo redemption consumption on order placement
- transaction-safe usage cap handling
- frozen order snapshots after later promo or catalog changes

Potential command direction once implementation exists:

```powershell
pnpm --filter @capella/api test -- tests/routes/checkout.routes.test.ts
pnpm --filter @capella/api test -- tests/services/checkout.service.test.ts
pnpm --filter @capella/erp test
pnpm --filter @capella/storefront test
```
