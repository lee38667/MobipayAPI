# Product Requirements Document (PRD)

Mobipay ↔ Promax Dash Integration — Middle-Layer API
---

## Table of Contents

1. Overview & Goals
2. Scope
3. Stakeholders & Actors
4. Definitions & References
5. Key Decisions (with Options)
6. High-level Architecture & Flows
7. Functional Requirements
   - 7.1 User Stories
   - 7.2 Middle-Layer API (External)
   - 7.3 Promax API Calls (Upstream)
8. Data Model
9. Business Rules & Validation
10. Security
11. Error Handling & Idempotency
12. Monitoring & Observability
13. Non-functional Requirements (NFRs)
14. Edge Cases
15. Configuration & Pricing
16. Implementation Plan & Timeline
17. Testing Strategy
18. Risks & Mitigations
19. Assumptions
20. Out of Scope
21. Acceptance Criteria
22. Open Questions
23. Changelog

---

## 1) Overview & Goals

Build a resilient middle-layer REST API that sits between Mobipay (payments/UI) and Promax Dash (reseller panel API) to:

- Verify client identity and subscription status.
- Create trials during registration and send credentials/receipts via email (PDF).
- Accept payment callbacks from Mobipay, store receipts, and immediately activate/extend subscriptions in Promax.
- Support 1, 3, 6, 12-month packages and multiple bouquets/templates.
- Enforce clear pricing and business rules with configuration for future flexibility.

Success criteria:
- Accurate account lookups (<500ms p50) and reliable activations on successful payments.
- Idempotent payment processing (no double activations on duplicate callbacks).
- Clear audit trail (stored requests/responses and receipts PDF).
- Secure, compliant handling of secrets and PII.

## 2) Scope

In-scope:
- Public-facing middle-layer REST endpoints consumed by Mobipay: account lookup, registration (trial), payment callback, bouquets.
- Upstream integration with Promax `api.php` endpoints (`device_info`, `new`, `renew`, `bouquet`, `device_status`).
- Receipt generation and email delivery.
- Basic admin endpoints for transactions and receipts.

Out-of-scope (see section 20 for details):
- Direct Mobipay UI changes, Promax UI customization.
- Full credit wallet system (beyond minimally storing overpayment credit).
- Complex CRM features or reporting dashboards (beyond basic views).

## 3) Stakeholders & Actors

- Client (end user): pays via Mobipay.
- Mobipay: payment UI and processor; calls middle-layer for lookup and posts payment callback.
- Middle-Layer API (this system): exposes endpoints, calls Promax, stores receipts, sends emails, maintains mappings.
- Promax Dash API: third-party reseller panel API managing subscriptions.

## 4) Definitions & References

- Account identifier: Promax username (M3U) or MAG MAC address.
- Pack/Template: Promax bouquet/template identifier.
- Trial: Short-term access for evaluation.
- Promax API reference (source): https://api.promax-dash.com/documentation.html
  - Key actions: `action=device_info`, `action=new`, `action=renew`, `action=bouquet`, `action=device_status`.

## 5) Key Decisions (with Options)

5.1 Account identifier handling
- Options: (A) direct Promax username/MAC, (B) internal local mapping, (C) hybrid.
- Decision: Hybrid (C). Accept Promax username/MAC or local account number; resolve via Promax first, then local mapping.

5.2 Payment amount behavior
- Options: (1) exact fixed price, (2) variable & prorate, (3) top-up credit system.
- Decision: Start with (1) exact fixed price; optionally add (3) credit later.

5.3 Trial account creation
- Options: Promax trial via `new` (`sub=0` or short `sub=1`) vs. local-only trial.
- Decision: Create trial directly in Promax to reduce mapping complexity; email credentials.

5.4 Security for Mobipay → Middle layer
- Decision: HMAC signature on callbacks; short validity window; HTTPS only.

5.5 Architecture
- Decision: Middle layer now, with design enabling future direct Mobipay → Promax calls (e.g., via restricted keys) when desired.

## 6) High-level Architecture & Flows

Flow summary:
1. Client enters account in Mobipay UI.
2. Mobipay calls middle-layer `GET /api/v1/lookup?account=...`.
3. Middle-layer queries Promax `device_info` (and/or local mapping) and returns client info and computed due amount to Mobipay.
4. Client pays in Mobipay; upon success, Mobipay posts `POST /api/v1/payment/callback` with transaction details and receipt.
5. Middle-layer validates, stores, generates receipt PDF, then calls Promax `new` (if new user) or `renew` (if existing). Enable device if needed.
6. Middle-layer responds success to Mobipay and emails receipt to client.

Note: Add a sequence diagram in documentation later (non-blocking).

## 7) Functional Requirements

### 7.1 User Stories

- As a client, I want my account recognized so I can see how much to pay.
- As a client, when I pay, I want my subscription activated or extended immediately.
- As a client, I want a receipt emailed to me for my payment.
- As operations, I want idempotent processing to avoid duplicate activations if Mobipay retries a callback.
- As support, I want to look up transactions and resend receipts.

### 7.2 Middle-Layer API (External)

Base URL: `https://api.yourdomain.com/api/v1/`

1) Account lookup
- Method/Path: GET `/lookup`
- Query: `account={string}&type={mag|m3u|auto}`
- Behavior:
  - Try Promax `device_info` using provided account (username or MAC).
  - If not found, resolve via local mapping then query Promax.
  - If found, compute `due_amount` from pricing (section 15) and return details.
  - If not found, return 404 with `status: not_found` and suggestion for registration.
- Response 200:
  ```json
  {
    "status": "ok",
    "client": {
      "username": "abc123",
      "user_id": "5000",
      "expire": "2025-12-01",
      "enabled": "0",
      "package_id": "3",
      "bouquet_name": "FR LIST"
    },
    "due_amount": 9.99,
    "currency": "USD",
    "allowed_subscriptions": [1, 3, 6, 12],
    "message": "Account found. Due amount computed."
  }
  ```

2) Create trial (registration)
- Method/Path: POST `/register`
- Body:
  ```json
  {
    "account_reference": "user_provided_identifier",
    "email": "user@example.com",
    "fullname": "First Last",
    "device_type": "m3u|mag",
    "pack_id": 3,
    "trial_days": 7
  }
  ```
- Behavior:
  - Call Promax `new` (trial strategy per section 5.3).
  - Store local mapping (account_reference ↔ Promax identifiers).
  - Email trial credentials and save a confirmation PDF.
- Response 200:
  ```json
  { "status": "ok", "promax_user_id": "5001", "username": "u_5001", "password": "p_abcd" }
  ```

3) Payment callback (Mobipay → Middle layer)
- Method/Path: POST `/payment/callback`
- Headers: `Authorization: HMAC-SHA256 <signature>`
- Body (JSON or multipart when file upload):
  ```json
  {
    "transaction_id": "MOBI12345",
    "account": "abc123",
    "amount": 9.99,
    "currency": "USD",
    "paid_for": "1|3|6|12",
    "receipt_file": "<binary or URL>",
    "timestamp": "2025-10-01T10:12:00Z"
  }
  ```
- Behavior:
  - Validate signature, timestamp freshness, and schema.
  - Persist raw payload and receipt; generate receipt PDF and store path/URL.
  - Resolve account via Promax `device_info`. If non-existent, `new`; else `renew` and `device_status=enable` if disabled.
  - Enforce pricing rules (section 9) and idempotency (section 11).
  - Email receipt to customer.
- Response 200:
  ```json
  {
    "status": "ok",
    "promax_action": "renew",
    "promax_response": { "status": "true" },
    "receipt_url": "https://.../receipts/MOBI12345.pdf"
  }
  ```

4) Retrieve bouquets (for UI)
- Method/Path: GET `/bouquets`
- Behavior: proxy/cached Promax `action=bouquet&public=1` (cache ~1 hour).

5) Admin endpoints (internal)
- Examples: `GET /transactions/{id}`, `GET /clients/{id}`,
  `POST /clients/{id}/resend-receipt`, `GET /health`.

### 7.3 Promax API Calls (Upstream)

- Create new M3U example:
  `GET https://api.promax-dash.com/api.php?action=new&type=m3u&sub=12&pack=3&country=fr&adult=0&notes=registered_via_mobipay&api_key=KEY`
- Renew example:
  `GET https://api.promax-dash.com/api.php?action=renew&type=m3u&username=USERNAME&password=PASSWORD&sub=12&api_key=KEY`
- Device info example:
  `GET https://api.promax-dash.com/api.php?action=device_info&username=USERNAME&password=PASSWORD&api_key=KEY`

## 8) Data Model (simplified)

Tables:
1. users: id (pk), local_account_ref, promx_user_id, promx_username, promx_password, device_type, email, full_name, created_at, updated_at, status
2. transactions: id (pk), transaction_id, user_id (fk), amount, currency, paid_for (months), promx_action, promx_response (json), receipt_path, status (pending/verified/failed), created_at
3. packages: id, months (1/3/6/12), price, pack_id_promax, name, currency
4. bouquets_cache: promx_pack_id, name, json_data, last_fetched

## 9) Business Rules & Validation

- Amount must equal configured package price for `paid_for` months (default). If mismatch → 400.
- If amount > price: accept and store overage as credit (optional, feature-flagged).
- If amount < price: reject (unless credit wallet enabled).
- Activate account immediately after successful Promax operation.
- If Promax returns error, mark transaction failed and alert admin.

## 10) Security

- Transport: HTTPS/TLS v1.2+.
- Mobipay → Middle layer: HMAC signatures, clock-skew window (e.g., 5 minutes), replay protection with nonce or transaction_id.
- Middle layer → Promax: reseller API key; store securely (vault/secret manager); never expose to clients.
- Input validation & sanitation; receipt MIME/type/size limits; virus scan uploads if applicable.
- Audit logging for all callbacks and Promax responses.

## 11) Error Handling & Idempotency

- Duplicate transaction_id: detect and return previous result without reapplying activation.
- Promax failures (timeouts/5xx): exponential backoff (x3). If not resolved: persist as pending; background retries with alerts.
- HTTP mappings: 200 success; 400 validation; 401 auth; 404 not found; 409 duplicate; 500 server error.

## 12) Monitoring & Observability

- Metrics: API latency, error rate, Promax error rate, activation success ratio, queue depth.
- Logs: structured logs for requests, Promax calls, and outcomes; correlation IDs per transaction.
- Alerts: repeated Promax failures; >X failed activations/hour; receipt generation failures.

## 13) Non-functional Requirements (NFRs)

- Availability: 99.9% monthly.
- Performance: lookup p50 < 500ms; payment callback < 2s success path.
- Scalability: handle bursty callbacks; use queue/worker for retries.
- Compliance: no card data; secure handling of PII/transaction metadata.

## 14) Edge Cases

- Duplicate callbacks with same `transaction_id`.
- Partial payments (rejected by default unless feature enabled).
- Promax user exists on create: detect and switch to renew.
- Missing fields in callback: 400 with list of missing fields.
- Corrupted receipt file: mark failed; request re-upload.

## 15) Configuration & Pricing

- Price table per package duration and bouquet/template; currency per market.
- Feature flags: allow_credit_wallet, allow_variable_amounts.
- Secrets: Promax API key, email SMTP/API keys, storage credentials.
- Environment/configuration should cover base URLs, caching TTL, retry policies.

## 16) Implementation Plan & Timeline (indicative)

- Phase 0 — Design & infra (1 week): finalize trial length/pricing; provision hosting, storage, DB.
- Phase 1 — Core API (2 weeks): implement lookup, register, payment callback, bouquets; Promax integration with retries.
- Phase 2 — Receipts & Email (1 week): PDF template, email templates, storage integration.
- Phase 3 — Admin & Monitoring (1 week): admin endpoints, alerts.
- Phase 4 — Testing & QA (1 week): E2E with Mobipay sandbox, load tests.
- Phase 5 — Rollout & Handover (1 week): deploy, runbook, training.

## 17) Testing Strategy

- Unit tests: pricing, mapping, HMAC verification, idempotency keys.
- Integration tests: Promax sandbox (simulate success/failure responses).
- E2E tests: Mobipay sandbox (lookup → payment → callback → receipt).
- Security tests: replay attempts, signature forgery, invalid uploads.
- Load tests: high concurrency on payment callbacks.

## 18) Risks & Mitigations

- Promax instability → retries, pending queue, alerting, backoff.
- Mispriced packages → central pricing config and change control.
- Email/receipt delivery issues → retry + fallback email provider.
- Secret leakage → secret manager, least-privilege IAM, rotation policy.

## 19) Assumptions

- Mobipay can send HMAC-signed callbacks and include a timestamp.
- Promax credentials and API access are available for both sandbox and production.
- Email delivery provider (e.g., SendGrid/Mailgun) will be available.
- Storage (S3 or equivalent) available for receipts; local storage acceptable in development.

## 20) Out of Scope

- Full-featured wallet/credit accounting beyond minimal overpayment credit storage.
- Public customer portal beyond what Mobipay provides.
- Direct Promax UI customization.

## 21) Acceptance Criteria

- Lookup returns accurate client info and computed due amounts for valid accounts.
- Payment callback with valid signature activates/renews in Promax and returns receipt URL.
- Duplicate callback with same `transaction_id` does not double-activate and returns the same outcome.
- Trials can be created and credentials emailed successfully.
- Admin can search a transaction and resend a receipt.

## 22) Open Questions

- Exact pricing per 1/3/6/12 months and per bouquet/template? (Owner: Product)
- Trial policy: `sub=0` limitations vs 1-day trials — final choice?
- Email sender/domain and templates approval?
- Receipt storage choice: S3 bucket name/region or local?
- Countries/currencies to support at launch?

## 23) Changelog

- 1.0.0 (2025-10-01): Initial reorganized PRD; consolidated decisions, added TOC, clarified requirements, security, testing, and acceptance criteria.

Nice — thanks for the answers, Lee. I’ll deliver a comprehensive **Product Requirements Document (PRD)** for a **Middle-Layer API** that sits between **Mobipay** and your **Promax Dash** panel API, implements the funds/process flow you described, and supports the options you wanted (I’ll show options where you asked for choices and recommend the best approach).

I used the Promax Dash API documentation (their `api.php` endpoints) as the canonical reference while building this. Key Promax endpoints used: `action=device_info`, `action=new`, `action=renew`, `action=bouquet`, `action=device_status`, etc. (source: [https://api.promax-dash.com/documentation.html](https://api.promax-dash.com/documentation.html)).

---

# Product Requirements Document (PRD) — Mobipay ↔ Promax Dash Integration (Middle-Layer API)

## 1. Goal / Summary

Build a resilient middle-layer REST API that:

* Receives incoming requests from **Mobipay** when a customer enters an account number and/or completes payment.
* Verifies the client’s identity and subscription status using the **Promax Dash** API.
* Creates trial accounts on registration, delivers credentials by email (PDF receipt).
* Accepts payment callbacks from Mobipay (receipt + transaction ID), stores receipt as PDF, issues receipt to customer, and immediately activates or extends subscriptions in Promax Dash.
* Supports 1, 3, 6, 12-month packages and multiple bouquets/templates.
* Provides configurable business rules for payment amount handling (options + recommended default).

## 2. Actors

* **Client** — End user paying via Mobipay.
* **Mobipay** — Payment GUI and payment processor; triggers account lookup and sends payment callback to middle layer.
* **Middle-Layer API (this system)** — Your server/service that:

  * exposes endpoints to Mobipay (account lookup, create trial, payment callback),
  * calls Promax Dash API to query/create/renew users,
  * stores receipts, sends emails.
* **Promax Dash API** — Reseller panel API (third-party) used to manage clients.

## 3. High-level Process Flow (textual)

1. Client enters account number in Mobipay UI.
2. Mobipay calls Middle-Layer `GET /api/v1/lookup?account=...`.
3. Middle-Layer verifies account mapping (see username verification options) and queries Promax Dash `action=device_info` to fetch client info & due amount; returns client details and amount to Mobipay.
4. Mobipay displays amount and takes payment. (See amount strategies below.)
5. Mobipay posts payment result to Middle-Layer `POST /api/v1/payment/callback` with transaction id and receipt (file or link).
6. Middle-Layer:

   * Verifies payment signature/validity.
   * Generates and stores a PDF receipt.
   * Calls Promax Dash to `action=new` or `action=renew` depending on whether the user is new or existing; if activation required, calls `action=device_status?status=enable`.
   * Returns success to Mobipay and optionally emails receipt to client.
7. Client receives confirmation and can immediately use service.

(Sequence diagram can be added visually later — I included detailed sequences in endpoints section.)

## 4. Major Decisions & Options (you asked for options; recommended choices noted)

### 4.1 Account identifier / “username” verification (Mobipay → Middle layer)

Options:
A. **Direct username mapping** — require the client to enter the Promax username (M3U) or MAG MAC as the account number. Middle-Layer passes it to `action=device_info` directly.
B. **Internal account ID mapping** — client enters a “local account number” (your own DB id). Middle-Layer maps local → Promax username and then queries Promax.
C. **Hybrid** — accept either Promax username/MAC or local account number; attempt to resolve to Promax user.

**Recommendation:** Hybrid (C). Accept both forms: try Promax `device_info` query directly; if not found, check local DB mapping. This is flexible while migration-friendly.

### 4.2 Payment amount behavior (what Mobipay should collect)

Options:

1. **Exact fixed price only** — Mobipay enforces the exact standard price for the chosen package (1/3/6/12 months). Partial payments rejected. (Simplest / safest)
2. **Accept variable & prorate** — accept any amount, prorate subscription period or create credit balance. (More complex)
3. **Top-up credit system** — allow variable amounts, store as credit, extend when credit reaches package price. (Complex but flexible)

**Recommendation:** Start with Option 1 (Exact fixed price only). Later add Option 3 (credit) when ready. This reduces accounting complexity and ensures predictable activations.

### 4.3 Trial account creation (when client registers)

Options:

* **Short trial via Promax**: Immediately call `action=new` with `sub=0` (Promax docs note `sub=0` as test account with 5/day limit) or `sub=1` with short expiry.
* **Local trial then create at payment**: create trial in your DB and create Promax account only after payment.

**Recommendation:** Create trial directly via Promax with `sub=0` (or `sub=1` for a 1-day trial if `sub=0` has limits), and email credentials. This reduces later mapping complexity and uses Promax native features.

### 4.4 Direct vs indirect integration with Promax

You asked to start with middle layer while planning direct integration later. We'll design the middle layer **now** and make it easy to later allow Mobipay to call Promax directly (e.g., via issuing a restricted API key).

## 5. Functional Requirements (APIs, payloads & flows)

### 5.1 Middle-Layer API overview

Base URL: `https://api.yourdomain.com/api/v1/`

#### 1) Account lookup (called by Mobipay when client enters account number)

* **Endpoint:** `GET /lookup`
* **Query params:** `?account={string}&type={mag|m3u|auto}`
* **Behavior:**

  * Try to treat `account` as Promax username or MAC: call Promax `api.php?action=device_info&username=...` or `&mac=...`.
  * If Promax returns user, return Promax fields + `due_amount` computed (see pricing).
  * If Promax not found, check local DB mapping (account → promx_username). If found, query Promax.
  * If still not found, return `404` with `status: not_found` and optional suggestion to create account (trigger registration flow).
* **Response (200):**

```json
{
  "status":"ok",
  "client": {
    "username":"abc123",
    "user_id":"5000",
    "expire":"2025-12-01",
    "enabled":"0",
    "package_id":"3",
    "bouquet_name":"FR LIST"
  },
  "due_amount": 9.99,
  "currency":"USD",
  "allowed_subscriptions":[1,3,6,12],
  "message":"Account found. Due amount found for next renewal."
}
```

* **Notes:** `due_amount` is computed by the Middle-Layer based on your price tables. Include logic for discounts/promotions.

#### 2) Create trial (if Mobipay asks to register)

* **Endpoint:** `POST /register`
* **Body:**

```json
{
  "account_reference":"user_provided_identifier",
  "email":"user@example.com",
  "fullname":"First Last",
  "device_type":"m3u|mag",
  "pack_id": 3,
  "trial_days": 7  // optional; defaults to recommended
}
```

* **Behavior:**

  * Create a Promax account via `action=new` (e.g., `sub=0` or `sub=1` depending on chosen trial strategy).
  * Store mapping (local account → promx user_id).
  * Generate credentials PDF receipt and email to user.
* **Response:**

```json
{ "status":"ok", "promax_user_id":"5001", "username":"u_5001", "password":"p_abcd" }
```

#### 3) Payment callback (Mobipay → Middle-Layer)

* **Endpoint:** `POST /payment/callback`
* **Headers:** `Authorization: HMAC-SHA256 <signature>` (see Security)
* **Body (multipart/form-data or JSON + file link):**

```json
{
  "transaction_id":"MOBI12345",
  "account":"abc123",
  "amount": 9.99,
  "currency": "USD",
  "paid_for":"1|3|6|12",   // chosen subscription length or package_id
  "receipt_file": "<binary or URL>",
  "timestamp":"2025-10-01T10:12:00Z"
}
```

* **Behavior:**

  * Validate signature & transaction id with Mobipay (if available).
  * Save raw callback & receipt file; create PDF receipt (store in S3/filesystem).
  * Determine whether account exists in Promax (`device_info`).

    * If new: call `action=new` with requested `sub` and `pack` to create user and set expiry accordingly.
    * If existing: call `action=renew` with `sub` months or call `action=device_status&status=enable` if needed.
  * Send success response to Mobipay.
  * Email receipt to user (attach PDF).
* **Response:**

```json
{ "status":"ok", "promax_action":"renew", "promax_response": { ... }, "receipt_url":"https://..." }
```

#### 4) Retrieve bouquets (for UI)

* **Endpoint:** `GET /bouquets`
* **Behavior:** Proxy to Promax `action=bouquet&public=1` and cache results for e.g., 1 hour.
* **Response:** list of `id`/`name`.

#### 5) Admin endpoints (internal)

* `GET /transactions/{id}`, `GET /clients/{id}`, `POST /clients/{id}/resend-receipt`, `GET /health`, etc.

### 5.2 Promax calls (examples)

* Create new M3U:

```
GET https://api.promax-dash.com/api.php?action=new&type=m3u&sub=12&pack=3&country=fr&adult=0&notes=registered_via_mobipay&api_key=KEY
```

* Renew:

```
GET https://api.promax-dash.com/api.php?action=renew&type=m3u&username=USERNAME&password=PASSWORD&sub=12&api_key=KEY
```

* Device info:

```
GET https://api.promax-dash.com/api.php?action=device_info&username=USERNAME&password=PASSWORD&api_key=KEY
```

(Your Middle-Layer will call these endpoints and translate responses.)

## 6. Data model (simplified)

### Tables

1. `users`

* id (pk), local_account_ref (string), promx_user_id (string), promx_username, promx_password, device_type, email, full_name, created_at, updated_at, status

2. `transactions`

* id (pk), transaction_id (Mobipay), user_id (fk), amount, currency, paid_for (months), promx_action, promx_response (json), receipt_path, status (pending/verified/failed), created_at

3. `packages`

* id, months (1/3/6/12), price, pack_id_promax (template id), name, currency

4. `bouquets_cache`

* promx_pack_id, name, json_data, last_fetched

## 7. Business Rules & Validation

* Require `amount` to match the configured package price for that `paid_for` months by default (Option 1). If mismatch: reject callback and return `400` and instruct Mobipay to reattempt with correct amount.
* If payment is larger than package price: accept and create credit on user account (store in `transactions.credit_amount`), or use to buy next month (configurable).
* If payment is smaller: reject (unless credit system enabled).
* Activate account immediately after successful Promax API call.
* If Promax API returns `status:false` or an error, mark transaction `failed` and alert admin.

## 8. Receipt handling

* On payment callback success, generate a PDF receipt containing:

  * Transaction id, date/time, client name, account id/username, package purchased, amount, currency, payment method (Mobipay), promx activation details.
* Store PDF in S3 (or local storage) and store URL in `transactions.receipt_path`.
* Email PDF to client; optionally return receipt_url to Mobipay in callback response.

## 9. Security

* **Transport:** TLS for all calls (HTTPS). Require TLS v1.2+.
* **Auth (Mobipay → Middle Layer):**

  * Use HMAC signatures or mutual TLS.
  * Example: `Authorization: HMAC <key_id>:<signature>` where signature = HMAC_SHA256(secret, body + timestamp).
  * Reject requests older than configured window (e.g., 5 minutes).
* **Auth (Middle Layer → Promax):**

  * Use Reseller API key per Promax docs; store securely (vault).
  * Do NOT embed Promax key in client UI or expose it to Mobipay.
* **Input validation**: sanitize account strings, amounts, and uploaded files. Validate receipts MIME types and size limits.
* **Audit logs**: Keep full audit logs of payment callbacks and Promax API responses (retain per compliance).

## 10. Error handling & retries

* On Promax API failure (timeouts, 500), retry with exponential backoff (3 retries).
* If payment callback cannot be applied immediately (e.g., Promax down), mark transaction `pending` and schedule worker to retry and notify admin on repeated failure.
* Return appropriate HTTP codes to Mobipay: `200` success, `400` validation error, `401` auth fail, `500` server error.

## 11. Monitoring & Alerts

* Monitor:

  * API latency, error rate, Promax API error rate, failed activations.
  * Transaction processing time and failed receipts.
* Alerts:

  * Notify via Slack/email for repeated Promax API failures or >X failed activations per hour.

## 12. Non-functional requirements

* **Availability:** 99.9% SLA.
* **Latency:** Lookup responses < 500ms typical; payment callback processing < 2s for success path (unless waiting on Promax).
* **Scalability:** Process high volume of callbacks (queue worker architecture with retry).
* **Security & Compliance:** PCI not directly required (Mobipay handles card flow), but secure handling of transaction metadata required.

## 13. Edge cases & flows

* **Duplicate transaction IDs**: If same `transaction_id` re-sent, idempotently return existing transaction and do not double-activate.
* **Partial payment**: If business chooses to allow partials in future, implement `credit` table and reconciliation rules.
* **Promax returns account already exists on create**: If Promax responds `Add M3U successful` but user exists, parse error response and call `renew` instead.
* **Mobipay callback missing required fields**: respond `400` and include exact missing fields.
* **Receipt file corrupted**: mark as failed and request re-upload.

## 14. Implementation plan & timeline (high-level)

* **Phase 0 — Design & infra (1 week)**

  * Finalize PRD signing off details (trial length, pricing).
  * Provision hosting, storage (S3), DB.
* **Phase 1 — Core API (2 weeks)**

  * Implement `/lookup`, `/register`, `/payment/callback`, `bouquets` proxy.
  * Connect to Promax API with sample keys, implement retries.
* **Phase 2 — Email & PDF receipts (1 week)**

  * PDF template, email templates, S3 storage.
* **Phase 3 — Admin & Monitoring (1 week)**

  * Admin endpoints, transaction views, alerts.
* **Phase 4 — Testing & QA (1 week)**

  * End-to-end tests with Mobipay sandbox, stress tests.
* **Phase 5 — Rollout & Handover (1 week)**

  * Deploy, handover docs, runbook.

(Adjust durations to your team resources and priorities.)

## 15. Example JSON flows & sample Promax requests

### 15.1 Example Lookup call from Mobipay

`GET /api/v1/lookup?account=00:AA:11:22:33:44&type=mag`

* Middle-Layer calls:

  * `https://api.promax-dash.com/api.php?action=device_info&mac=00:AA:11:22:33:44&api_key=KEY`
* Return includes `due_amount` based on `packages` table.

### 15.2 Example Payment callback (from Mobipay)

`POST /api/v1/payment/callback` (JSON)

```json
{
  "transaction_id":"MOBI-20251001-0001",
  "account":"abc123",
  "amount":9.99,
  "currency":"USD",
  "paid_for":1,
  "receipt_url":"https://mobipay.sandbox/receipts/MOBI-20251001-0001.pdf",
  "timestamp":"2025-10-01T10:12:00Z"
}
```

Server validates → calls Promax renew/new → creates receipt PDF → responds with:

```json
{
  "status":"ok",
  "promax_action":"renew",
  "promax_response": { "status":"true", "messasge":"M3U renew successful" },
  "receipt_url":"https://s3.amazonaws.com/yourbucket/receipts/MOBI-20251001-0001.pdf"
}
```

## 16. Admin & Reporting

* Admin UI to:

  * Search transactions by `transaction_id`, account, status.
  * Re-send receipts.
  * Manual override activation with reason.
* Reporting:

  * Daily totals: transactions, activations, refunds, failed activations.

## 17. Testing checklist

* Unit tests for middle-layer business logic (pricing, mapping).
* Integration tests with Promax sandbox (simulate various responses).
* End-to-end tests with Mobipay sandbox (lookup → payment → callback).
* Security tests: replay, signature forging, invalid receipts uploads.
* Load tests: high concurrency payment callbacks.

Got it 👍 thanks for the clarification. Based on what you’ve given me and the points I can decide on, here’s a **proposed middle-layer API design** for integrating with the Promax Dash API:

---

## 🌐 Middle Layer API (Your System ↔ Promax Dash API)

### **1. Authentication**

* **Option A:** Start without API key (simpler for now).
* **Option B (future):** Add API key or OAuth token for secure calls.

➡ I’ll pick **Option A for now**, but design so authentication can be added later.

---

### **2. Core Endpoints (Middle Layer)**

#### 🔹 **a. POST `/transactions/create`**

* **Purpose:** Initiate a transaction via Promax Dash API.
* **Request:**

  ```json
  {
    "customerId": "12345",
    "amount": 250.00,
    "package": "Premium"
  }
  ```
* **Process:**

  1. Middle layer calls Promax Dash API to create a transaction.
  2. Gets receipt + transaction ID.
  3. Stores receipt (PDF).
  4. Optionally emails receipt to customer.
* **Response:**

  ```json
  {
    "status": "success",
    "transactionId": "abc123",
    "receiptUrl": "https://yourdomain.com/receipts/abc123.pdf"
  }
  ```

---

#### 🔹 **b. GET `/transactions/{transactionId}`**

* **Purpose:** Check status of a transaction.
* **Process:** Call Promax Dash API with the transaction ID.
* **Response:**

  ```json
  {
    "transactionId": "abc123",
    "status": "completed",
    "receiptUrl": "https://yourdomain.com/receipts/abc123.pdf"
  }
  ```

---

#### 🔹 **c. POST `/transactions/{transactionId}/resend-receipt`**

* **Purpose:** Resend receipt via email.
* **Process:** Pull stored PDF and send email.
* **Response:**

  ```json
  {
    "status": "sent",
    "email": "customer@email.com"
  }
  ```

---

### **3. Packages Management**

#### 🔹 **a. GET `/packages`**

* **Purpose:** Show available packages (Basic, Premium, etc.).
* **Response:**

  ```json
  [
    {"id": "basic", "name": "Basic", "price": 100},
    {"id": "premium", "name": "Premium", "price": 250}
  ]
  ```

---

### **4. Storage & Receipts**

* Store receipts in **local storage / cloud storage (S3, GCP, Azure)**.
* Keep **metadata in DB**: transactionId, customerId, receiptPath, emailSent.
* Emails sent via **SMTP service (SendGrid / Mailgun / Nodemailer)**.

---

### **5. Immediate Activation**

* Once Promax Dash API confirms payment, the middle layer **updates user status** (active) immediately.

---

✅ With this setup:

* Your system never directly talks to Promax Dash → only your middle layer does.
* Easy to add **API key auth later**.
* Supports **multiple packages, receipts, and email sending**.
* Transaction + receipt lifecycle fully handled.

--- 
