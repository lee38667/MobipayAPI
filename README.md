# Mobipay ↔ Promax Middle-Layer API (from PRD)

This is a TypeScript/Express implementation scaffold of the middle-layer API described in `PRD.md`.

## Endpoints (v1)

- GET `/api/v1/lookup?account=...&type=mag|m3u|auto`
- POST `/api/v1/register`
- POST `/api/v1/payment/callback` (requires HMAC header)
- GET `/api/v1/bouquets`
- POST `/api/v1/subscription/extend`
- POST `/api/v1/subscription/info`
- GET `/health`

## Quick start

1) Copy `.env.example` to `.env` and fill in values.

2) Install deps and start dev server:

```bat
npm install
npm run dev
```

3) Health check: open http://localhost:3000/health

## HMAC Header (callback)

Example header:
```
Authorization: HMAC key_id=demo-key, algorithm=hmac-sha256, signature=BASE64, timestamp=2025-10-01T10:12:00Z
```
String-to-sign:
```
METHOD\nPATH\ncontent-type\ntimestamp\nsha256(body)
```

## Notes

- Promax client uses `PROMAX_BASE_URL` and `PROMAX_API_KEY`.
- `PROMAX_API_KEY` **must** be provided via environment variables (see `.env.example`); the application will refuse to call Promax without it.
- Receipts are written as text files to `RECEIPTS_DIR` (default `./receipts`).
- Email is printed to console.
- Pricing is a simple in-memory table in `src/services/pricing.ts`.

## Security

- Never commit real API keys, HMAC secrets, or customer data to source control.
- Store credentials only in your runtime environment or secure secret manager.
- Rotate the `PROMAX_API_KEY` and `MOBIPAY_HMAC_SECRET` regularly and update your deployment configuration accordingly.

## Build & Run

```bat
npm run build
npm start
```

## Tests

Tests are TBD; scaffold uses Jest and ts-jest.