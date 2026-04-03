# Skill: Gamma Market Nsite Webshop

This skill document explains how to rebuild or clone this project with the same Gamma Market catalog logic, checkout flow, and Nsite deployment behavior.

## Quick Start (60 Seconds)

1. Install deps and build static output:
   - `npm install`
   - `npm run generate`
2. Set local merchant for testing:
   - edit `public/shop-config.json` (`merchantNpub`, discovery relays)
3. Verify clone manifest logic:
   - `npm run test:nsite-clone`
4. Deploy to Nsite:
   - `nsyte deploy ./.output/public --fallback /index.html --sec <nsec>`
5. Verify live:
   - `nsyte status --sec <nsec>`
   - open `https://<npub>.nsite.lol/`

## 1) Project Goal

Build a minimal NIP-99/Gamma-compatible webshop that:

- resolves merchant from local config in dev and hostname in Nsite production,
- fetches products from merchant outbox relays,
- supports product detail and cart checkout,
- submits Gamma-style order events,
- shows Lightning invoice QR,
- supports "clone this nsite" onboarding for new and existing Nostr users.

## 2) Core Files To Reuse

- Identity + relay model:
  - `composables/useShopIdentity.js`
  - `composables/useRelayLists.js`
- Marketplace + ordering:
  - `composables/useMarketplace.js`
  - `composables/useNostrOrders.js`
  - `composables/useLightningInvoice.js`
  - `composables/useFiatToSats.js`
- Nsite clone/newcomer publish logic:
  - `composables/useNsiteClone.js`
  - `components/shop/NsiteCloneFab.vue`
- UI/state:
  - `stores/cart.js`
  - `pages/index.vue`
  - `pages/product/[d].vue`
  - `pages/cart.vue`
  - `components/shop/ShopHeader.vue`
  - `components/shop/DeveloperConsoleFab.vue`

## 3) Merchant Resolution Rules

- Local/dev mode:
  - Read `public/shop-config.json` (`merchantNpub`, `discoveryRelays`).
- Production/Nsite mode:
  - Resolve npub from hostname subdomain:
    - `npub1...` or `npubs1...` (converted to `npub1...`).
- Bootstrap relay set (discovery only):
  - `wss://relay.ditto.pub`
  - `wss://relay.damus.io`
  - `wss://relay.primal.net`

## 4) Inbox/Outbox Relay Model

- Fetch `kind:10002` relay list for merchant (and buyer when available).
- Classify relays into read/write semantics:
  - merchant outbox: product reads,
  - merchant inbox: order target relay set,
  - buyer inbox: payment-request listening,
  - buyer outbox: order publishing.
- Catalog operations should use merchant outbox, not fixed default relays.

## 5) Catalog/Event Parsing

- Products from `kind:30402`.
- Parse tags:
  - `d`, `title`, `summary`, `price`, `image`, `stock`, `visibility`, `shipping_option`, `spec`, `t`.
- Product reference format for checkout:
  - `30402:<pubkey>:<d-tag>`
- Product route safety:
  - encode `d` in links and decode in `pages/product/[d].vue` before query.

## 6) Checkout Logic (4 Steps)

Implemented in `pages/cart.vue`:

1. Shipping/contact input
2. Order overview + totals confirmation
3. Submit order
4. Show Lightning invoice QR

### Gamma Order Event

- Submit order as `kind:16`, `type:1`.
- Include tags:
  - `p`, `subject`, `type`, `order`, `amount`, repeated `item`
  - optional `shipping`, `address`, `email`, `phone`

### Payment Request

- Poll for merchant payment reply `kind:16`, `type:2` matching `order`.
- Extract `payment` lightning invoice tag for QR.
- Fallback path:
  - resolve merchant `lud16` from `kind:0`,
  - request LNURL-pay invoice,
  - render QR if available.

## 7) Fiat Conversion Rules

- Checkout totals must support `SATS`, `BTC`, and fiat currencies.
- Fiat conversion source:
  - CoinGecko simple price API (BTC vs fiat),
  - convert fiat -> sats for final order amount.
- Block submission if required rate is unavailable.

## 8) Clone UX Rules

`components/shop/NsiteCloneFab.vue` provides two paths:

- **Im new here**
  - generate keypair,
  - collect name,
  - show npub/nsec backup warning,
  - publish `kind:0` profile,
  - clone manifest and publish root nsite,
  - open new deployed URL.

- **Im already on Nostr**
  - use current `steal-this` flow (extension/bunker/NIP-46 QR),
  - no raw nsec input UI.

### Important clone fix

- Always publish newcomer clone as root manifest `kind:15128`.
- If source is named site (`35128`), strip `d`/`name` tags for root clone.

## 9) Deployment Logic (Nsite)

- Static build:
  - `npm run generate`
- Deploy:
  - `nsyte deploy ./.output/public --fallback /index.html --sec <nsec>`
- Verify:
  - `nsyte status --sec <nsec>`
  - gateway URL check: `https://<npub>.nsite.lol/`

Project config:

- `.nsite/config.json` stores relay/server/deploy defaults.

## 10) Developer Debugging Aids

- Dev console button (`bottom-left`) is powered by:
  - `composables/useShopDebug.js`
  - `components/shop/DeveloperConsoleFab.vue`
- Keep these populated from index/product/cart pages with:
  - merchant npub,
  - relay map,
  - page-specific diagnostics.

## 11) Local Assets Policy

Nostr branding assets are local in:

- `public/nostr-assets/nostr-logo-black.svg`
- `public/nostr-assets/nostr-ostrich-black.png`
- `public/nostr-assets/nostr-ostrich-running.gif`

Avoid remote icon dependencies for production resilience.

## 12) Validation Checklist

Before handing off:

- `npm run generate` succeeds.
- `npm run test:nsite-clone` succeeds.
- Product list loads from merchant outbox relays.
- Product route works for encoded `d` values.
- Checkout reaches invoice QR or fallback invoice path.
- Newcomer clone publishes profile + root clone and opens new nsite URL.
