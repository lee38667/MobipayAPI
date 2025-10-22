# MobipayAPI - Comprehensive API Documentation

**Version:** 1.0.0  
**Last Updated:** October 22, 2025  
**Base URL:** `https://api.yourdomain.com/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication & Security](#authentication--security)
4. [API Endpoints](#api-endpoints)
   - [Account Lookup](#1-account-lookup)
   - [Trial Registration](#2-trial-registration)
   - [Payment Callback](#3-payment-callback)
   - [Bouquets](#4-bouquets)
   - [Subscription Extension](#5-subscription-extension)
   - [Client Information](#6-client-information)
   - [Admin Endpoints](#7-admin-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Rate Limits & Best Practices](#rate-limits--best-practices)
8. [Migration Guide](#migration-guide)
9. [Code Examples](#code-examples)
10. [Support & Resources](#support--resources)

---

## Overview

MobipayAPI is a middle-layer REST API that bridges Mobipay payment systems with Promax Dash subscription management. It provides endpoints for:

- **Account verification** and subscription status lookup
- **Trial account creation** with automated credential delivery
- **Payment processing** with automatic subscription activation/renewal
- **Subscription management** including extensions and client information retrieval
- **Receipt generation** in PDF format with email delivery

### Key Features

- ✅ HMAC-SHA256 authentication for secure callbacks
- ✅ Idempotent payment processing (no duplicate activations)
- ✅ Automatic PDF receipt generation
- ✅ Support for 1, 3, 6, and 12-month subscription periods
- ✅ Real-time Promax integration with intelligent caching
- ✅ Comprehensive error handling with detailed response codes

---

## Getting Started

### Prerequisites

- HTTPS endpoint for receiving callbacks
- HMAC credentials (key ID and secret) provided by the MobipayAPI administrator
- Promax reseller account credentials (if integrating directly)

### Environment Setup

Configure the following environment variables:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# HMAC Authentication
MOBIPAY_HMAC_KEY_ID=your-key-id
MOBIPAY_HMAC_SECRET=your-secret-key
HMAC_CLOCK_SKEW_SECONDS=300

# Promax Integration
PROMAX_BASE_URL=https://api.promax-dash.com/api.php
PROMAX_API_KEY=your-promax-api-key
PROMAX_TIMEOUT_MS=8000
PROMAX_BOUQUET_CACHE_TTL_MS=3600000

# Email & Storage
EMAIL_FROM=noreply@yourdomain.com
RECEIPTS_DIR=./receipts
```

### Quick Test

Verify the API is running:

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok"
}
```

---

## Authentication & Security

### HMAC Signature (Required for Payment Callbacks)

All payment callback requests **must** include an HMAC-SHA256 signature in the `Authorization` header.

#### Header Format

```
Authorization: HMAC key_id=<your-key-id>, algorithm=hmac-sha256, signature=<base64-signature>, timestamp=<ISO8601-timestamp>
```

#### Signature Generation

1. **Construct the string-to-sign** (concatenate with `\n`):
   ```
   HTTP_METHOD
   REQUEST_PATH
   content-type (lowercase)
   timestamp (ISO8601/RFC3339)
   SHA256(request_body) (hex digest)
   ```

2. **Generate signature**:
   ```
   signature = Base64(HMAC_SHA256(secret, string-to-sign))
   ```

3. **Add to Authorization header** with key_id, algorithm, signature, and timestamp.

#### Example (Python)

```python
import hmac
import hashlib
import base64
from datetime import datetime

def generate_hmac_signature(method, path, content_type, body, secret):
    timestamp = datetime.utcnow().isoformat() + 'Z'
    body_hash = hashlib.sha256(body.encode()).hexdigest()
    
    string_to_sign = f"{method}\n{path}\n{content_type}\n{timestamp}\n{body_hash}"
    
    signature = base64.b64encode(
        hmac.new(secret.encode(), string_to_sign.encode(), hashlib.sha256).digest()
    ).decode()
    
    return f'HMAC key_id=demo-key, algorithm=hmac-sha256, signature="{signature}", timestamp="{timestamp}"'
```

#### Security Considerations

- **Clock Skew:** Requests older than configured skew (default 300s) are rejected
- **Replay Protection:** Transaction IDs are tracked for idempotency
- **TLS Required:** All production traffic must use HTTPS
- **Secret Rotation:** Rotate HMAC secrets regularly

---

## API Endpoints

### 1. Account Lookup

Retrieve account information and compute due amount for subscription renewal.

**Endpoint:** `GET /api/v1/lookup`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account` | string | Yes | Promax username or MAC address |
| `type` | string | No | Device type: `m3u`, `mag`, or `auto` (default: `auto`) |

**Response (200 OK):**

```json
{
  "status": "ok",
  "client": {
    "username": "abc123",
    "user_id": "5000",
    "expire": "2025-12-01",
    "enabled": "1",
    "package_id": "3",
    "bouquet_name": "FR LIST"
  },
  "due_amount": 9.99,
  "currency": "USD",
  "allowed_subscriptions": [1, 3, 6, 12],
  "message": "Account found. Due amount computed."
}
```

**Response (404 Not Found):**

```json
{
  "status": "invalid",
  "message": "username not available please register on www.jsiptv.africa"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid type parameter
- `502 Bad Gateway` - Promax service unavailable

**Example Usage:**

```bash
curl "https://api.yourdomain.com/api/v1/lookup?account=user123&type=m3u"
```

---

### 2. Trial Registration

Create a new trial account with automatic credential generation and email delivery.

**Endpoint:** `POST /api/v1/register`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**

```json
{
  "account_reference": "user_custom_id",
  "email": "customer@example.com",
  "fullname": "John Doe",
  "device_type": "m3u",
  "pack_id": 3,
  "trial_days": 7
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account_reference` | string | No | Your internal account identifier |
| `email` | string | Yes | Valid email address for credentials |
| `fullname` | string | No | Customer's full name |
| `device_type` | string | Yes | `m3u` or `mag` |
| `pack_id` | number | Yes | Promax package/bouquet ID |
| `trial_days` | number | No | Trial duration (positive integer) |

**Response (200 OK):**

```json
{
  "status": "ok",
  "promax_user_id": "5001",
  "username": "u_5001",
  "password": "p_abcd1234"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input (missing email, invalid device_type, etc.)
- `502 Bad Gateway` - Promax service unavailable

**Example Usage:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "device_type": "m3u",
    "pack_id": 3,
    "trial_days": 7
  }'
```

---

### 3. Payment Callback

Process payment and activate/renew subscription. **Requires HMAC authentication.**

**Endpoint:** `POST /api/v1/payment/callback`

**Headers:**
```
Content-Type: application/json
Authorization: HMAC key_id=<id>, algorithm=hmac-sha256, signature=<sig>, timestamp=<ts>
```

**Request Body:**

```json
{
  "transaction_id": "MOBI12345",
  "account": "abc123",
  "amount": 9.99,
  "currency": "USD",
  "paid_for": 1,
  "receipt_file": "<optional>",
  "timestamp": "2025-10-22T10:12:00Z"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transaction_id` | string | Yes | Unique transaction identifier |
| `account` | string | Yes | Promax username or MAC |
| `amount` | number | Yes | Payment amount |
| `currency` | string | Yes | Currency code (e.g., USD) |
| `paid_for` | number | Yes | Subscription months (1, 3, 6, or 12) |
| `receipt_file` | string | No | Optional receipt reference |
| `timestamp` | string | Yes | ISO8601 timestamp |

**Response (200 OK):**

```json
{
  "status": "ok",
  "promax_action": "renew",
  "promax_response": {
    "status": "true",
    "message": "M3U renew successful"
  },
  "receipt_url": "/receipts/MOBI12345.pdf"
}
```

**Error Responses:**

- `400 Bad Request` - Missing fields, invalid subscription period, or amount mismatch
- `401 Unauthorized` - Invalid HMAC signature or expired timestamp
- `409 Conflict` - Duplicate transaction_id
- `502 Bad Gateway` - Promax service unavailable

**Idempotency:**

The API tracks `transaction_id` to prevent duplicate processing. Retrying with the same `transaction_id` returns the original response without reprocessing.

**Example Usage:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/payment/callback \
  -H "Content-Type: application/json" \
  -H "Authorization: HMAC key_id=demo-key, algorithm=hmac-sha256, signature=\"...\", timestamp=\"2025-10-22T10:12:00Z\"" \
  -d '{
    "transaction_id": "MOBI12345",
    "account": "user123",
    "amount": 9.99,
    "currency": "USD",
    "paid_for": 1,
    "timestamp": "2025-10-22T10:12:00Z"
  }'
```

---

### 4. Bouquets

Retrieve available subscription packages/bouquets.

**Endpoint:** `GET /api/v1/bouquets`

**Response (200 OK):**

```json
{
  "status": "ok",
  "bouquets": [
    {
      "id": 1,
      "name": "Standard Package"
    },
    {
      "id": 2,
      "name": "Premium Package"
    },
    {
      "id": 3,
      "name": "FR LIST"
    }
  ]
}
```

**Caching:**

Bouquet data is cached for 1 hour (configurable via `PROMAX_BOUQUET_CACHE_TTL_MS`) to reduce upstream calls.

**Error Responses:**

- `502 Bad Gateway` - Promax service unavailable

**Example Usage:**

```bash
curl https://api.yourdomain.com/api/v1/bouquets
```

---

### 5. Subscription Extension

Extend an existing subscription for a LINE (M3U) user.

**Endpoint:** `POST /api/v1/subscription/extend`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**

```json
{
  "username": "user123",
  "password": "userpass",
  "sub": 12
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Promax username |
| `password` | string | Yes | Promax password |
| `sub` | number | Yes | Subscription months (1, 3, 6, or 12) |

**Response (200 OK):**

```json
{
  "status": "ok",
  "upstream": [
    {
      "status": "true",
      "messasge": "M3U renew successful"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Missing credentials or invalid subscription length
- `502 Bad Gateway` - Promax rejected request or unavailable

**Example Usage:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/subscription/extend \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user123",
    "password": "pass456",
    "sub": 12
  }'
```

---

### 6. Client Information

Retrieve detailed client information using username/password or MAC address.

**Endpoint:** `POST /api/v1/subscription/info`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**

```json
{
  "username": "user123",
  "password": "userpass",
  "mac": "00:1A:2B:3C:4D:5E"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Conditional | Promax username (required if no MAC) |
| `password` | string | Yes | Promax password |
| `mac` | string | Conditional | MAC address (required if no username) |

**Response (200 OK):**

```json
{
  "status": "ok",
  "client": {
    "status": "true",
    "username": "user123",
    "expire": "2025-12-31",
    "country": "NL"
  },
  "upstream": [
    {
      "status": "true",
      "username": "user123",
      "expire": "2025-12-31",
      "country": "NL"
    }
  ]
}
```

**Response (404 Not Found):**

```json
{
  "status": "invalid",
  "message": "username not available please register on www.jsiptv.africa",
  "upstream": [
    {
      "status": "false",
      "messasge": "Not found"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Missing password or both username and MAC
- `502 Bad Gateway` - Promax service unavailable

**Example Usage:**

```bash
curl -X POST https://api.yourdomain.com/api/v1/subscription/info \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user123",
    "password": "pass456"
  }'
```

---

### 7. Admin Endpoints

Administrative endpoints for transaction management (internal use).

#### 7.1 Get Transaction

**Endpoint:** `GET /api/v1/admin/transactions/{id}`

**Response (200 OK):**

```json
{
  "status": "ok",
  "transaction": {
    "transaction_id": "MOBI12345",
    "account": "user123",
    "amount": 9.99,
    "currency": "USD",
    "paid_for": 1,
    "promax_action": "renew",
    "promax_response": {...},
    "receipt_path": "/receipts/MOBI12345.pdf",
    "status": "verified"
  }
}
```

#### 7.2 Resend Receipt

**Endpoint:** `POST /api/v1/admin/clients/{username}/resend-receipt`

**Response (200 OK):**

```json
{
  "status": "ok"
}
```

---

## Data Models

### Client Object

```typescript
{
  username: string;      // Promax username
  user_id: string;       // Promax user ID
  expire: string | null; // Expiration date (YYYY-MM-DD)
  enabled: string;       // "0" or "1"
  package_id: string;    // Package/bouquet ID
  bouquet_name: string;  // Package name
}
```

### Transaction Object

```typescript
{
  transaction_id: string;  // Unique transaction ID
  account: string;         // Username or MAC
  amount: number;          // Payment amount
  currency: string;        // Currency code
  paid_for: number;        // Subscription months
  promax_action: string;   // "new" or "renew"
  promax_response: object; // Upstream response
  receipt_path: string;    // PDF receipt path
  status: string;          // "pending" | "verified" | "failed"
}
```

### Pricing Structure

```typescript
{
  months: 1,  price: 9.99,  currency: "USD"
  months: 3,  price: 27.99, currency: "USD"
  months: 6,  price: 53.99, currency: "USD"
  months: 12, price: 99.99, currency: "USD"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "status": "error",
  "code": "machine_readable_code",
  "message": "Human-readable description",
  "correlation_id": "uuid-optional"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_input` | 400 | Missing or malformed request parameters |
| `invalid_type` | 400 | Invalid device type specified |
| `invalid_subscription` | 400 | Unsupported subscription duration |
| `amount_mismatch` | 400 | Payment amount doesn't match expected price |
| `unauthorized` | 401 | Invalid or missing HMAC signature |
| `duplicate_transaction` | 409 | Transaction already processed |
| `not_found` | 404 | Account or resource not found |
| `upstream_failure` | 502 | Promax service error |
| `upstream_unavailable` | 502 | Promax service unreachable |
| `config_missing` | 500 | Required configuration missing |
| `internal_error` | 500 | Unexpected server error |

### Error Handling Best Practices

1. **Check HTTP status first** - 2xx indicates success
2. **Parse error code** - Use machine-readable codes for conditional logic
3. **Log correlation_id** - Include in support requests for faster debugging
4. **Implement retries** - Use exponential backoff for 502/503 errors
5. **Validate locally** - Check required fields before making requests

---

## Rate Limits & Best Practices

### Rate Limits

- **Lookup endpoint:** 100 requests/minute per account
- **Payment callback:** No limit (idempotent by transaction_id)
- **Bouquets:** Cached for 1 hour, minimal upstream impact
- **Extension/Info:** 60 requests/minute per IP

### Best Practices

#### 1. Implement Proper Error Handling

```javascript
async function lookupAccount(account) {
  try {
    const response = await fetch(`${API_BASE}/lookup?account=${account}`);
    
    if (!response.ok) {
      const error = await response.json();
      
      if (error.code === 'upstream_failure') {
        // Retry with exponential backoff
        return retryWithBackoff(() => lookupAccount(account));
      }
      
      throw new Error(`API Error: ${error.message}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Lookup failed:', error);
    throw error;
  }
}
```

#### 2. Cache Bouquet Data

Don't request bouquets on every page load. Cache locally and refresh periodically.

#### 3. Use Idempotency

Always use unique `transaction_id` values and store them to safely retry payment callbacks.

#### 4. Validate Before Sending

Check subscription durations and amounts locally before making requests.

#### 5. Monitor Response Times

Track API latency and set alerts for degraded performance.

---

## Migration Guide

### Migrating from Direct Promax Integration

If you're currently calling Promax API directly, follow these steps:

#### Step 1: Update Base URL

**Before:**
```
https://api.promax-dash.com/api.php
```

**After:**
```
https://api.yourdomain.com/api/v1
```

#### Step 2: Adapt Endpoints

| Promax Action | MobipayAPI Endpoint |
|---------------|---------------------|
| `device_info` | `GET /lookup` or `POST /subscription/info` |
| `new` | `POST /register` or `POST /payment/callback` |
| `renew` | `POST /payment/callback` or `POST /subscription/extend` |
| `bouquet` | `GET /bouquets` |

#### Step 3: Update Authentication

Replace Promax API key with HMAC authentication for payment callbacks.

#### Step 4: Handle New Response Format

Update response parsing to match the standardized JSON format.

#### Step 5: Test in Sandbox

Verify all integrations in a test environment before production deployment.

---

## Code Examples

### Node.js/Express Integration

```javascript
const axios = require('axios');
const crypto = require('crypto');

const API_BASE = 'https://api.yourdomain.com/api/v1';
const HMAC_KEY_ID = 'your-key-id';
const HMAC_SECRET = 'your-secret';

// Generate HMAC signature
function generateHmacSignature(method, path, contentType, body) {
  const timestamp = new Date().toISOString();
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  
  const stringToSign = [
    method,
    path,
    contentType.toLowerCase(),
    timestamp,
    bodyHash
  ].join('\n');
  
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(stringToSign)
    .digest('base64');
  
  return {
    header: `HMAC key_id=${HMAC_KEY_ID}, algorithm=hmac-sha256, signature="${signature}", timestamp="${timestamp}"`,
    timestamp
  };
}

// Lookup account
async function lookupAccount(account) {
  const response = await axios.get(`${API_BASE}/lookup`, {
    params: { account, type: 'auto' }
  });
  return response.data;
}

// Process payment
async function processPayment(transactionData) {
  const body = JSON.stringify(transactionData);
  const { header, timestamp } = generateHmacSignature(
    'POST',
    '/api/v1/payment/callback',
    'application/json',
    body
  );
  
  const response = await axios.post(
    `${API_BASE}/payment/callback`,
    transactionData,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': header
      }
    }
  );
  
  return response.data;
}

// Example usage
(async () => {
  try {
    // Lookup account
    const client = await lookupAccount('user123');
    console.log('Client info:', client);
    
    // Process payment
    const payment = await processPayment({
      transaction_id: 'MOBI' + Date.now(),
      account: 'user123',
      amount: 9.99,
      currency: 'USD',
      paid_for: 1,
      timestamp: new Date().toISOString()
    });
    
    console.log('Payment result:', payment);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
})();
```

### Python Integration

```python
import requests
import hmac
import hashlib
import base64
import json
from datetime import datetime

API_BASE = 'https://api.yourdomain.com/api/v1'
HMAC_KEY_ID = 'your-key-id'
HMAC_SECRET = 'your-secret'

def generate_hmac_signature(method, path, content_type, body):
    timestamp = datetime.utcnow().isoformat() + 'Z'
    body_hash = hashlib.sha256(body.encode()).hexdigest()
    
    string_to_sign = f"{method}\n{path}\n{content_type.lower()}\n{timestamp}\n{body_hash}"
    
    signature = base64.b64encode(
        hmac.new(HMAC_SECRET.encode(), string_to_sign.encode(), hashlib.sha256).digest()
    ).decode()
    
    header = f'HMAC key_id={HMAC_KEY_ID}, algorithm=hmac-sha256, signature="{signature}", timestamp="{timestamp}"'
    return header, timestamp

def lookup_account(account):
    response = requests.get(
        f'{API_BASE}/lookup',
        params={'account': account, 'type': 'auto'}
    )
    response.raise_for_status()
    return response.json()

def process_payment(transaction_data):
    body = json.dumps(transaction_data)
    header, timestamp = generate_hmac_signature(
        'POST',
        '/api/v1/payment/callback',
        'application/json',
        body
    )
    
    response = requests.post(
        f'{API_BASE}/payment/callback',
        json=transaction_data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': header
        }
    )
    response.raise_for_status()
    return response.json()

# Example usage
if __name__ == '__main__':
    try:
        # Lookup account
        client = lookup_account('user123')
        print('Client info:', client)
        
        # Process payment
        payment = process_payment({
            'transaction_id': f'MOBI{int(datetime.now().timestamp())}',
            'account': 'user123',
            'amount': 9.99,
            'currency': 'USD',
            'paid_for': 1,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        })
        
        print('Payment result:', payment)
    except requests.exceptions.RequestException as e:
        print('Error:', e.response.json() if e.response else str(e))
```

### PHP Integration

```php
<?php

class MobipayAPI {
    private $apiBase;
    private $hmacKeyId;
    private $hmacSecret;
    
    public function __construct($apiBase, $hmacKeyId, $hmacSecret) {
        $this->apiBase = $apiBase;
        $this->hmacKeyId = $hmacKeyId;
        $this->hmacSecret = $hmacSecret;
    }
    
    private function generateHmacSignature($method, $path, $contentType, $body) {
        $timestamp = gmdate('Y-m-d\TH:i:s\Z');
        $bodyHash = hash('sha256', $body);
        
        $stringToSign = implode("\n", [
            $method,
            $path,
            strtolower($contentType),
            $timestamp,
            $bodyHash
        ]);
        
        $signature = base64_encode(
            hash_hmac('sha256', $stringToSign, $this->hmacSecret, true)
        );
        
        $header = sprintf(
            'HMAC key_id=%s, algorithm=hmac-sha256, signature="%s", timestamp="%s"',
            $this->hmacKeyId,
            $signature,
            $timestamp
        );
        
        return [$header, $timestamp];
    }
    
    public function lookupAccount($account, $type = 'auto') {
        $url = $this->apiBase . '/lookup?' . http_build_query([
            'account' => $account,
            'type' => $type
        ]);
        
        $response = file_get_contents($url);
        return json_decode($response, true);
    }
    
    public function processPayment($transactionData) {
        $body = json_encode($transactionData);
        list($authHeader, $timestamp) = $this->generateHmacSignature(
            'POST',
            '/api/v1/payment/callback',
            'application/json',
            $body
        );
        
        $options = [
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: ' . $authHeader
                ],
                'content' => $body
            ]
        ];
        
        $context = stream_context_create($options);
        $response = file_get_contents($this->apiBase . '/payment/callback', false, $context);
        return json_decode($response, true);
    }
}

// Example usage
$api = new MobipayAPI(
    'https://api.yourdomain.com/api/v1',
    'your-key-id',
    'your-secret'
);

try {
    // Lookup account
    $client = $api->lookupAccount('user123');
    echo "Client info: " . print_r($client, true) . "\n";
    
    // Process payment
    $payment = $api->processPayment([
        'transaction_id' => 'MOBI' . time(),
        'account' => 'user123',
        'amount' => 9.99,
        'currency' => 'USD',
        'paid_for' => 1,
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
    ]);
    
    echo "Payment result: " . print_r($payment, true) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
```

---

## Support & Resources

### Documentation

- **API Reference:** This document
- **README:** See `README.md` for quick start and development guide
- **PRD (if available):** Product requirements document provided by your business team

### Getting Help

- **Technical Issues:** Contact your API administrator
- **Integration Support:** Provide `correlation_id` from error responses
- **Feature Requests:** Submit through your designated channel

### Changelog

**Version 1.0.0** (October 22, 2025)
- Initial production release
- HMAC authentication for payment callbacks
- PDF receipt generation
- Subscription management endpoints (extend, info)
- Promax integration with intelligent caching
- Comprehensive error handling

### Testing Environment

**Sandbox URL:** `https://sandbox-api.yourdomain.com/api/v1`

Use sandbox credentials for testing without affecting production data.

### Additional Notes

- All timestamps should be in ISO8601/RFC3339 format
- All monetary amounts are decimal numbers (not strings)
- Currency codes follow ISO 4217 standard
- MAC addresses should use colon-separated hex format (e.g., `00:1A:2B:3C:4D:5E`)

---

**Questions or feedback?** Contact the API team or refer to the repository documentation.

**Last Updated:** October 22, 2025  
**Document Version:** 1.0.0
