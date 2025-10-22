# MobipayAPI Documentation

Welcome to the MobipayAPI documentation directory. This folder contains all the technical documentation needed to integrate with and use the MobipayAPI.

## 📚 Documentation Files

### [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
**Comprehensive API Reference**

Complete developer documentation including:
- All API endpoints with detailed specifications
- Request/response examples
- HMAC authentication guide with code samples in Node.js, Python, and PHP
- Error codes and troubleshooting
- Integration workflows
- Migration guide for existing systems
- Best practices and rate limiting
- Security guidelines

**Start here if you're integrating with the API.**

---

### [POSTMAN_COLLECTION.md](./POSTMAN_COLLECTION.md)
**Postman Collection for Quick Testing**

Pre-built Postman collection with:
- All API endpoints pre-configured
- Automatic HMAC signature generation scripts
- Sample request data and parameters
- Environment variable templates
- Testing workflows
- Import instructions

**Perfect for rapid API testing and exploration.**

---

## 🚀 Quick Start

### For Developers

1. **Read the basics**: Start with [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) sections:
   - Authentication (HMAC)
   - Base URL and endpoints overview
   
2. **Test the API**: Import the Postman collection from [POSTMAN_COLLECTION.md](./POSTMAN_COLLECTION.md)
   - Configure your environment variables
   - Run the "Health Check" request
   - Try the "Account Lookup" endpoint

3. **Implement integration**: Follow the integration workflows in API_DOCUMENTATION.md:
   - Trial registration flow
   - Payment processing flow
   - Subscription management flow

### For QA/Testing Teams

1. Import the Postman collection (see [POSTMAN_COLLECTION.md](./POSTMAN_COLLECTION.md))
2. Configure environment variables with test credentials
3. Follow the testing workflows provided
4. Use the sample test data included in the collection

---

## 🔐 Authentication

All HMAC-protected endpoints require:
- `HMAC key_id` (e.g., `demo-key`)
- `HMAC secret` (e.g., `demo-secret`)
- Proper signature generation (examples in API_DOCUMENTATION.md)

The Postman collection includes pre-request scripts that handle signature generation automatically.

---

## 📡 Available Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/api/v1/lookup` | GET | None | Account lookup |
| `/api/v1/register` | POST | None | Trial registration |
| `/api/v1/payment/callback` | POST | **HMAC** | Payment processing |
| `/api/v1/bouquets` | GET | None | Get packages |
| `/api/v1/subscription/extend` | POST | None | Extend subscription |
| `/api/v1/subscription/info` | POST | None | Client information |
| `/api/v1/admin/transactions/:id` | GET | None | Get transaction |
| `/api/v1/admin/clients/:user/resend-receipt` | POST | None | Resend receipt |

---

## 🛠️ Integration Support

### Code Examples
The API documentation includes complete code examples in:
- **Node.js** (with Axios)
- **Python** (with Requests)
- **PHP** (with cURL)

### Common Integration Patterns

#### 1. New Customer Onboarding
```
Trial Registration → Email with Credentials → Payment Callback → Subscription Activated
```

#### 2. Existing Customer Renewal
```
Account Lookup → Display Due Amount → Payment Callback → Subscription Extended
```

#### 3. Self-Service Portal
```
Client Info → Display Expiration → Subscription Extend → Confirmation
```

---

## 🐛 Troubleshooting

### Common Issues

**401 Unauthorized (HMAC)**
- Verify key_id and secret are correct
- Check timestamp is within 5 minutes (clock skew)
- Ensure signature is generated correctly

**400 Bad Request**
- Check all required fields are present
- Verify data types (numbers vs strings)
- Ensure subscription periods are 1, 3, 6, or 12 months

**502 Bad Gateway**
- Promax Dash service may be unavailable
- Check upstream service status
- Retry with exponential backoff

**404 Not Found (Account Lookup)**
- Account doesn't exist in Promax
- User should register at www.jsiptv.africa
- Check account spelling/format

---

## 📊 Testing Environments

### Development
```
Base URL: http://localhost:3000/api/v1
HMAC Key ID: demo-key
HMAC Secret: demo-secret
```

### Production
```
Base URL: https://api.yourdomain.com/api/v1
HMAC Key ID: <your-production-key-id>
HMAC Secret: <your-production-secret>
```

---

## 📞 Support

For technical support or questions:
- Check the API Documentation for detailed examples
- Review error codes and troubleshooting sections
- Test with Postman collection to isolate issues

---

## 🔄 Version History

- **v1.0.0** - Initial release with full Promax integration
  - Account lookup and registration
  - HMAC-authenticated payment processing
  - Subscription management (extend, info)
  - PDF receipt generation
  - Admin endpoints

---

## 📝 Additional Resources

- **Main README**: `../README.md` - Project setup and configuration
- **Environment Example**: `../.env.example` - Required environment variables
- **Test Suite**: `../tests/` - Automated test examples

---

**Last Updated:** October 23, 2025  
**Documentation Version:** 1.0.0
