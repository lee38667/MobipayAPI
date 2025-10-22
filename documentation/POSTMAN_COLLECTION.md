# MobipayAPI Postman Collection

This document contains the Postman Collection JSON for testing the MobipayAPI endpoints.

## Quick Setup

1. **Import the collection** into Postman by copying the JSON below
2. **Configure environment variables** in Postman:
   - `base_url`: Your API base URL (e.g., `https://api.yourdomain.com/api/v1`)
   - `hmac_key_id`: Your HMAC key ID (e.g., `demo-key`)
   - `hmac_secret`: Your HMAC secret (e.g., `demo-secret`)
3. **Run requests** - The collection includes pre-request scripts for automatic HMAC signature generation

---

## Postman Collection JSON

```json
{
  "info": {
    "name": "MobipayAPI",
    "description": "Complete API collection for MobipayAPI - Promax integration middleware",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "version": "1.0.0"
  },
  "auth": {
    "type": "noauth"
  },
  "event": [
    {
      "listen": "prerequest",
      "script": {
        "type": "text/javascript",
        "exec": [
          "// Helper function to generate HMAC signature",
          "function generateHmacSignature(method, path, contentType, body, keyId, secret) {",
          "    const timestamp = new Date().toISOString();",
          "    const bodyHash = CryptoJS.SHA256(body).toString(CryptoJS.enc.Hex);",
          "    ",
          "    const stringToSign = [",
          "        method,",
          "        path,",
          "        contentType.toLowerCase(),",
          "        timestamp,",
          "        bodyHash",
          "    ].join('\\n');",
          "    ",
          "    const signature = CryptoJS.HmacSHA256(stringToSign, secret).toString(CryptoJS.enc.Base64);",
          "    ",
          "    const authHeader = `HMAC key_id=${keyId}, algorithm=hmac-sha256, signature=\"${signature}\", timestamp=\"${timestamp}\"`;",
          "    ",
          "    return { authHeader, timestamp };",
          "}",
          "",
          "// Store for use in requests",
          "pm.environment.set('current_timestamp', new Date().toISOString());"
        ]
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000/api/v1",
      "type": "string"
    },
    {
      "key": "hmac_key_id",
      "value": "demo-key",
      "type": "string"
    },
    {
      "key": "hmac_secret",
      "value": "demo-secret",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/../health",
          "host": ["{{base_url}}"],
          "path": ["..", "health"]
        },
        "description": "Check if the API is running and healthy"
      },
      "response": []
    },
    {
      "name": "1. Account Lookup",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/lookup?account=user123&type=auto",
          "host": ["{{base_url}}"],
          "path": ["lookup"],
          "query": [
            {
              "key": "account",
              "value": "user123",
              "description": "Promax username or MAC address"
            },
            {
              "key": "type",
              "value": "auto",
              "description": "Device type: m3u, mag, or auto (default)"
            }
          ]
        },
        "description": "Retrieve account information and compute due amount for subscription renewal.\n\n**Query Parameters:**\n- `account` (required): Promax username or MAC address\n- `type` (optional): Device type - `m3u`, `mag`, or `auto` (default: `auto`)\n\n**Response Codes:**\n- `200 OK`: Account found\n- `404 Not Found`: Account not available\n- `400 Bad Request`: Invalid parameters\n- `502 Bad Gateway`: Promax unavailable"
      },
      "response": [
        {
          "name": "Success - Account Found",
          "originalRequest": {
            "method": "GET",
            "url": {
              "raw": "{{base_url}}/lookup?account=user123&type=auto"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "header": [
            {
              "key": "Content-Type",
              "value": "application/json"
            }
          ],
          "body": "{\n  \"status\": \"ok\",\n  \"client\": {\n    \"username\": \"abc123\",\n    \"user_id\": \"5000\",\n    \"expire\": \"2025-12-01\",\n    \"enabled\": \"1\",\n    \"package_id\": \"3\",\n    \"bouquet_name\": \"FR LIST\"\n  },\n  \"due_amount\": 9.99,\n  \"currency\": \"USD\",\n  \"allowed_subscriptions\": [1, 3, 6, 12],\n  \"message\": \"Account found. Due amount computed.\"\n}"
        },
        {
          "name": "Error - Account Not Found",
          "originalRequest": {
            "method": "GET",
            "url": {
              "raw": "{{base_url}}/lookup?account=unknown"
            }
          },
          "status": "Not Found",
          "code": 404,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"invalid\",\n  \"message\": \"username not available please register on www.jsiptv.africa\"\n}"
        }
      ]
    },
    {
      "name": "2. Trial Registration",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"account_reference\": \"user_custom_id_001\",\n  \"email\": \"customer@example.com\",\n  \"fullname\": \"John Doe\",\n  \"device_type\": \"m3u\",\n  \"pack_id\": 3,\n  \"trial_days\": 7\n}"
        },
        "url": {
          "raw": "{{base_url}}/register",
          "host": ["{{base_url}}"],
          "path": ["register"]
        },
        "description": "Create a new trial account with automatic credential generation and email delivery.\n\n**Request Body:**\n- `account_reference` (optional): Your internal account identifier\n- `email` (required): Valid email address for credentials\n- `fullname` (optional): Customer's full name\n- `device_type` (required): `m3u` or `mag`\n- `pack_id` (required): Promax package/bouquet ID (numeric)\n- `trial_days` (optional): Trial duration (positive integer)\n\n**Response Codes:**\n- `200 OK`: Trial created successfully\n- `400 Bad Request`: Invalid input (missing email, invalid device_type, etc.)\n- `502 Bad Gateway`: Promax service unavailable"
      },
      "response": [
        {
          "name": "Success - Trial Created",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"customer@example.com\",\n  \"device_type\": \"m3u\",\n  \"pack_id\": 3,\n  \"trial_days\": 7\n}"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"promax_user_id\": \"5001\",\n  \"username\": \"u_5001\",\n  \"password\": \"p_abcd1234\"\n}"
        }
      ]
    },
    {
      "name": "3. Payment Callback (HMAC)",
      "event": [
        {
          "listen": "prerequest",
          "script": {
            "type": "text/javascript",
            "exec": [
              "// Generate HMAC signature for payment callback",
              "const method = 'POST';",
              "const path = '/api/v1/payment/callback';",
              "const contentType = 'application/json';",
              "const body = pm.request.body.raw;",
              "const keyId = pm.collectionVariables.get('hmac_key_id');",
              "const secret = pm.collectionVariables.get('hmac_secret');",
              "",
              "const timestamp = new Date().toISOString();",
              "const bodyHash = CryptoJS.SHA256(body).toString(CryptoJS.enc.Hex);",
              "",
              "const stringToSign = [",
              "    method,",
              "    path,",
              "    contentType.toLowerCase(),",
              "    timestamp,",
              "    bodyHash",
              "].join('\\n');",
              "",
              "const signature = CryptoJS.HmacSHA256(stringToSign, secret).toString(CryptoJS.enc.Base64);",
              "",
              "const authHeader = `HMAC key_id=${keyId}, algorithm=hmac-sha256, signature=\"${signature}\", timestamp=\"${timestamp}\"`;",
              "",
              "pm.request.headers.add({",
              "    key: 'Authorization',",
              "    value: authHeader",
              "});",
              "",
              "// Update timestamp in body",
              "const bodyJson = JSON.parse(body);",
              "bodyJson.timestamp = timestamp;",
              "pm.request.body.raw = JSON.stringify(bodyJson, null, 2);"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"transaction_id\": \"MOBI{{$timestamp}}\",\n  \"account\": \"user123\",\n  \"amount\": 9.99,\n  \"currency\": \"USD\",\n  \"paid_for\": 1,\n  \"timestamp\": \"{{current_timestamp}}\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/payment/callback",
          "host": ["{{base_url}}"],
          "path": ["payment", "callback"]
        },
        "description": "Process payment and activate/renew subscription. **Requires HMAC authentication.**\n\nThe pre-request script automatically generates the HMAC signature.\n\n**Request Body:**\n- `transaction_id` (required): Unique transaction identifier\n- `account` (required): Promax username or MAC\n- `amount` (required): Payment amount (numeric)\n- `currency` (required): Currency code (e.g., USD)\n- `paid_for` (required): Subscription months (1, 3, 6, or 12)\n- `timestamp` (required): ISO8601 timestamp\n\n**Response Codes:**\n- `200 OK`: Payment processed successfully\n- `400 Bad Request`: Missing fields, invalid subscription, or amount mismatch\n- `401 Unauthorized`: Invalid HMAC signature\n- `409 Conflict`: Duplicate transaction_id\n- `502 Bad Gateway`: Promax unavailable"
      },
      "response": [
        {
          "name": "Success - New Account",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"transaction_id\": \"MOBI12345\",\n  \"account\": \"newuser\",\n  \"amount\": 9.99,\n  \"currency\": \"USD\",\n  \"paid_for\": 1,\n  \"timestamp\": \"2025-10-22T10:12:00Z\"\n}"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"promax_action\": \"new\",\n  \"promax_response\": {\n    \"status\": \"true\"\n  },\n  \"receipt_url\": \"/receipts/MOBI12345.pdf\"\n}"
        },
        {
          "name": "Success - Renewal",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"transaction_id\": \"MOBI12346\",\n  \"account\": \"user123\",\n  \"amount\": 27.99,\n  \"currency\": \"USD\",\n  \"paid_for\": 3,\n  \"timestamp\": \"2025-10-22T10:15:00Z\"\n}"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"promax_action\": \"renew\",\n  \"promax_response\": {\n    \"status\": \"true\",\n    \"message\": \"M3U renew successful\"\n  },\n  \"receipt_url\": \"/receipts/MOBI12346.pdf\"\n}"
        }
      ]
    },
    {
      "name": "4. Get Bouquets",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/bouquets",
          "host": ["{{base_url}}"],
          "path": ["bouquets"]
        },
        "description": "Retrieve available subscription packages/bouquets.\n\nData is cached for 1 hour to reduce upstream calls.\n\n**Response Codes:**\n- `200 OK`: Bouquets retrieved successfully\n- `502 Bad Gateway`: Promax service unavailable"
      },
      "response": [
        {
          "name": "Success - Bouquets List",
          "originalRequest": {
            "method": "GET",
            "url": {
              "raw": "{{base_url}}/bouquets"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"bouquets\": [\n    {\n      \"id\": 1,\n      \"name\": \"Standard Package\"\n    },\n    {\n      \"id\": 2,\n      \"name\": \"Premium Package\"\n    },\n    {\n      \"id\": 3,\n      \"name\": \"FR LIST\"\n    }\n  ]\n}"
        }
      ]
    },
    {
      "name": "5. Subscription Extension",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"user123\",\n  \"password\": \"userpass\",\n  \"sub\": 12\n}"
        },
        "url": {
          "raw": "{{base_url}}/subscription/extend",
          "host": ["{{base_url}}"],
          "path": ["subscription", "extend"]
        },
        "description": "Extend an existing subscription for a LINE (M3U) user.\n\n**Request Body:**\n- `username` (required): Promax username\n- `password` (required): Promax password\n- `sub` (required): Subscription months (1, 3, 6, or 12)\n\n**Response Codes:**\n- `200 OK`: Extension successful\n- `400 Bad Request`: Missing credentials or invalid subscription length\n- `502 Bad Gateway`: Promax rejected request or unavailable"
      },
      "response": [
        {
          "name": "Success - Extension",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"user123\",\n  \"password\": \"pass456\",\n  \"sub\": 12\n}"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"upstream\": [\n    {\n      \"status\": \"true\",\n      \"messasge\": \"M3U renew successful\"\n    }\n  ]\n}"
        }
      ]
    },
    {
      "name": "6. Client Information",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"user123\",\n  \"password\": \"userpass\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/subscription/info",
          "host": ["{{base_url}}"],
          "path": ["subscription", "info"]
        },
        "description": "Retrieve detailed client information using username/password or MAC address.\n\n**Request Body:**\n- `username` (conditional): Promax username (required if no MAC)\n- `password` (required): Promax password\n- `mac` (conditional): MAC address (required if no username)\n\n**Note:** Must provide either `username` or `mac` along with `password`.\n\n**Response Codes:**\n- `200 OK`: Client information retrieved\n- `404 Not Found`: Client not available\n- `400 Bad Request`: Missing password or both username and MAC\n- `502 Bad Gateway`: Promax unavailable"
      },
      "response": [
        {
          "name": "Success - Client Found",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"user123\",\n  \"password\": \"pass456\"\n}"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"client\": {\n    \"status\": \"true\",\n    \"username\": \"user123\",\n    \"expire\": \"2025-12-31\",\n    \"country\": \"NL\"\n  },\n  \"upstream\": [\n    {\n      \"status\": \"true\",\n      \"username\": \"user123\",\n      \"expire\": \"2025-12-31\",\n      \"country\": \"NL\"\n    }\n  ]\n}"
        },
        {
          "name": "Error - Client Not Found",
          "originalRequest": {
            "method": "POST",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"unknown\",\n  \"password\": \"pass456\"\n}"
            }
          },
          "status": "Not Found",
          "code": 404,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"invalid\",\n  \"message\": \"username not available please register on www.jsiptv.africa\",\n  \"upstream\": [\n    {\n      \"status\": \"false\",\n      \"messasge\": \"Not found\"\n    }\n  ]\n}"
        }
      ]
    },
    {
      "name": "7. Admin - Get Transaction",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/admin/transactions/:transactionId",
          "host": ["{{base_url}}"],
          "path": ["admin", "transactions", ":transactionId"],
          "variable": [
            {
              "key": "transactionId",
              "value": "MOBI12345",
              "description": "Transaction ID to retrieve"
            }
          ]
        },
        "description": "Retrieve transaction details by ID (Admin endpoint).\n\n**Path Parameters:**\n- `transactionId` (required): The transaction ID\n\n**Response Codes:**\n- `200 OK`: Transaction found\n- `404 Not Found`: Transaction not found"
      },
      "response": [
        {
          "name": "Success - Transaction Found",
          "originalRequest": {
            "method": "GET",
            "url": {
              "raw": "{{base_url}}/admin/transactions/MOBI12345"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\",\n  \"transaction\": {\n    \"transaction_id\": \"MOBI12345\",\n    \"account\": \"user123\",\n    \"amount\": 9.99,\n    \"currency\": \"USD\",\n    \"paid_for\": 1,\n    \"promax_action\": \"renew\",\n    \"promax_response\": {},\n    \"receipt_path\": \"/receipts/MOBI12345.pdf\",\n    \"status\": \"verified\"\n  }\n}"
        }
      ]
    },
    {
      "name": "8. Admin - Resend Receipt",
      "request": {
        "method": "POST",
        "header": [],
        "url": {
          "raw": "{{base_url}}/admin/clients/:username/resend-receipt",
          "host": ["{{base_url}}"],
          "path": ["admin", "clients", ":username", "resend-receipt"],
          "variable": [
            {
              "key": "username",
              "value": "user123",
              "description": "Client username"
            }
          ]
        },
        "description": "Resend receipt email to client (Admin endpoint).\n\n**Path Parameters:**\n- `username` (required): The client's username\n\n**Response Codes:**\n- `200 OK`: Receipt resent successfully\n- `404 Not Found`: Client or transaction not found"
      },
      "response": [
        {
          "name": "Success - Receipt Resent",
          "originalRequest": {
            "method": "POST",
            "url": {
              "raw": "{{base_url}}/admin/clients/user123/resend-receipt"
            }
          },
          "status": "OK",
          "code": 200,
          "_postman_previewlanguage": "json",
          "body": "{\n  \"status\": \"ok\"\n}"
        }
      ]
    }
  ]
}
```

---

## Environment Variables Setup

In Postman, create an environment with these variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000/api/v1` | API base URL (update for production) |
| `hmac_key_id` | `demo-key` | Your HMAC key ID |
| `hmac_secret` | `demo-secret` | Your HMAC secret |

---

## Testing Workflow

### 1. Quick Test Flow

```
Health Check → Get Bouquets → Account Lookup → Payment Callback
```

### 2. Full Registration Flow

```
Trial Registration → Get Bouquets → Account Lookup → Payment Callback → Client Information
```

### 3. Subscription Management

```
Account Lookup → Subscription Extension → Client Information
```

---

## HMAC Authentication Notes

The **Payment Callback** request includes a pre-request script that automatically:
1. Generates the current timestamp
2. Calculates SHA256 hash of the request body
3. Creates the string-to-sign
4. Generates HMAC-SHA256 signature
5. Adds the Authorization header

**No manual signature generation required!** Just update your `hmac_key_id` and `hmac_secret` in the collection variables.

---

## Sample Test Data

### Valid Accounts
- `user123` - Existing M3U account
- `00:1A:2B:3C:4D:5E` - MAC address format

### Package IDs
- `1` - Standard Package
- `2` - Premium Package
- `3` - FR LIST

### Subscription Periods
- `1` - 1 month ($9.99)
- `3` - 3 months ($27.99)
- `6` - 6 months ($53.99)
- `12` - 12 months ($99.99)

---

## Troubleshooting

### HMAC Signature Errors

If you get `401 Unauthorized`:
1. Verify `hmac_key_id` and `hmac_secret` are correct
2. Check that clock skew is within 5 minutes
3. Ensure the pre-request script is enabled
4. Verify the request body hasn't changed after signature generation

### Connection Errors

If you can't reach the API:
1. Verify the `base_url` is correct
2. Check that the API server is running
3. Ensure no firewall is blocking the connection

### Validation Errors

If you get `400 Bad Request`:
1. Check all required fields are present
2. Verify data types (numbers vs strings)
3. Ensure subscription periods are valid (1, 3, 6, or 12)
4. Confirm email format is valid

---

## Import Instructions

### Method 1: Copy-Paste
1. Copy the entire JSON above
2. Open Postman
3. Click **Import** button
4. Select **Raw text** tab
5. Paste the JSON
6. Click **Import**

### Method 2: Save as File
1. Save the JSON to a file: `MobipayAPI.postman_collection.json`
2. Open Postman
3. Click **Import** button
4. Drag and drop the file
5. Click **Import**

---

## Additional Resources

- **API Documentation**: See `API_DOCUMENTATION.md`
- **PRD**: See `PRD.md` for requirements
- **README**: See `README.md` for setup guide

---

**Last Updated:** October 23, 2025  
**Collection Version:** 1.0.0
