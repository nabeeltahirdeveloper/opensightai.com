# Payment Gateway Onboarding Documentation

**Version:** 1.0  
**Last Updated:** 2025  
**Purpose:** This document specifies the required API endpoints and webhook configuration needed to integrate with our payment processing system. This document should be shared with payment gateway providers during onboarding to ensure proper API setup and webhook configuration.

---

## Table of Contents

1. [Overview](#overview)
2. [Required API Endpoints](#required-api-endpoints)
3. [API Specifications](#api-specifications)
4. [Webhook Requirements](#webhook-requirements)
5. [Payment Flow](#payment-flow)
6. [Security & Compliance](#security--compliance)
7. [Testing & Sandbox](#testing--sandbox)
8. [Integration Checklist](#integration-checklist)

---

## Overview

### Our System Requirements

We require a payment gateway that supports:

- **Payment Methods**: Credit/Debit Cards, Apple Pay, Google Pay
- **Primary Currency**: USD (United States Dollar)
- **Payment Types**: One-time immediate payments (debit/capture)
- **Real-time Status Updates**: Via webhooks
- **Idempotency**: Support for duplicate transaction prevention

### Integration Architecture

Our system uses a **server-to-server** integration model with:

1.**Backend API Calls**: Our server calls your payment gateway APIs to create payment sessions
2.**User Redirection**: Customers are redirected to your hosted payment page or use your payment widget
3.**Webhook Notifications**: Your system sends real-time payment status updates to our webhook endpoint
4.**Status Polling** (Optional): Our system may poll payment status via API as a fallback mechanism

---

## Required API Endpoints

### 1. Authentication API (If Required)

If your gateway uses OAuth-style authentication or token-based access, provide:

**Endpoint:** `POST /identity/auth/access-token` (or equivalent)

**Purpose:** Obtain access tokens for API authentication

**Requirements:**
- Token should be valid for at least 5 minutes
- Support token caching (we cache tokens until expiration)
- Return clear expiration time in response

**Example Request:**
```http
POST /identity/auth/access-token HTTP/1.1
Host: api.payment-gateway.com
Content-Type: application/vnd.ni-identity.v1+json
Authorization: Basic {base64_encoded_api_key}
```

**Example Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

---

### 2. Create Payment/Checkout Session API

**Endpoint:** `POST /v1/checkouts` (or equivalent)

**Purpose:** Create a payment session that allows a customer to complete payment

**Required Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/x-www-form-urlencoded
  OR
Content-Type: application/json
```

**Required Request Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | decimal/string | Yes | Payment amount in USD (e.g., "10.50" or 10.50) |
| `currency` | string | Yes | Currency code (must support "USD") |
| `paymentType` | string | Yes | Payment type (e.g., "DB" for debit, "SALE" for one-time charge) |
| `merchantTransactionId` | string | Yes | Unique transaction identifier from our system |
| `customer.email` | string | Yes | Customer email address |
| `customer.givenName` | string | No | Customer first name |
| `customer.surname` | string | No | Customer last name |
| `customer.phone` | string | No | Customer phone number |
| `customer.ip` | string | No | Customer IP address (for fraud prevention) |
| `billing.street1` | string | No | Billing address line 1 |
| `billing.city` | string | No | Billing city |
| `billing.postcode` | string | No | Billing postal/ZIP code |
| `billing.country` | string | No | Billing country code (ISO 3166-1 alpha-2) |
| `billing.state` | string | No | Billing state/province |
| `shipping.street1` | string | No | Shipping address line 1 |
| `shipping.city` | string | No | Shipping city |
| `shipping.postcode` | string | No | Shipping postal/ZIP code |
| `shipping.country` | string | No | Shipping country code (ISO 3166-1 alpha-2) |
| `shipping.state` | string | No | Shipping state/province |

**Example Request:**
```http
POST /v1/checkouts HTTP/1.1
Host: api.payment-gateway.com
Authorization: Bearer {access_token}
Content-Type: application/x-www-form-urlencoded

entityId={entity_id}
&amount=10.50
&currency=USD
&paymentType=DB
&merchantTransactionId=order_1234567890_abc123
&customer.email=customer@example.com
&customer.givenName=John
&customer.surname=Doe
&billing.country=US
&shipping.country=US
```

**Required Response Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique checkout session ID |
| `paymentUrl` | string | Conditional | URL for redirect-based payment (if using hosted payment page) |
| `checkoutId` | string | Conditional | Alternative field name for checkout session ID |

**Example Response (Widget-Based):**
```json
{
  "id": "8acda4c999c83f980199c866d6cb0241",
  "integrity": "sha256-hash-here",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

**Important Notes for Widget-Based Flow:**
- `shopperResultUrl` is **NOT** sent in the API request body
- `shopperResultUrl` must be set in the payment form's `action` attribute when widget renders
- Browser data (for 3D Secure) is automatically collected by the widget - do NOT send it in the API request
- Widget script requires `integrity` attribute and `crossorigin="anonymous"` attribute
- Widget will automatically render payment form fields in a container element

**Example Response (Redirect-Based):**
```json
{
  "reference": "ORD-12345",
  "paymentUrl": "https://payment-gateway.com/pay/ORD-12345",
  "_links": {
    "payment": {
      "href": "https://payment-gateway.com/pay/ORD-12345"
    }
  }
}
```

**Error Response Format:**
```json
{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be greater than 0",
    "details": {}
  }
}
```

---

### 3. Verify/Poll Payment Status API

**Endpoint:** `GET /v1/checkouts/{checkoutId}/payment` (or equivalent)

**Purpose:** Retrieve current payment status for a checkout session

**Required Request Headers:**
```
Authorization: Bearer {access_token}
Accept: application/json
```

**Required Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `checkoutId` / `orderReference` | string | Yes | Checkout session ID or order reference |
| `entityId` | string | Conditional | Entity/account ID (if required by gateway) |

**Example Request:**
```http
GET /v1/checkouts/8acda4c999c83f980199c866d6cb0241/payment?entityId={entity_id} HTTP/1.1
Host: api.payment-gateway.com
Authorization: Bearer {access_token}
```

**Required Response Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Payment transaction ID |
| `result.code` | string | Yes | Result code indicating payment status |
| `result.description` | string | Yes | Human-readable status description |
| `amount` | decimal | Yes | Payment amount |
| `currency` | string | Yes | Currency code |
| `merchantTransactionId` | string | Yes | Our original transaction ID |
| `paymentType` | string | Yes | Payment type used |
| `state` | string | Conditional | Payment state (e.g., "CAPTURED", "AUTHORISED", "FAILED") |

**Success Code Patterns:**
- Success codes should clearly indicate successful payment (e.g., `000.000.000`, `CAPTURED`, `SUCCESS`)
- Pending codes should indicate payment is processing (e.g., `000.200.000`, `PENDING`)
- Failure codes should indicate payment failed (all other codes)

**Example Success Response:**
```json
{
  "id": "8acda4c99c83f980199c866d6cb0242",
  "result": {
    "code": "000.000.000",
    "description": "Transaction successfully processed"
  },
  "amount": "10.50",
  "currency": "USD",
  "merchantTransactionId": "order_1234567890_abc123",
  "paymentType": "DB",
  "state": "CAPTURED",
  "card": {
    "bin": "411111",
    "last4Digits": "1111",
    "brand": "VISA",
    "holder": "John Doe"
  }
}
```

**Example Pending Response:**
```json
{
  "id": "8acda4c99c83f980199c866d6cb0242",
  "result": {
    "code": "000.200.000",
    "description": "Transaction pending"
  },
  "amount": "10.50",
  "currency": "USD",
  "merchantTransactionId": "order_1234567890_abc123",
  "state": "PENDING"
}
```

---

### 4. Optional: Refund API

**Endpoint:** `POST /v1/payments/{paymentId}/refund` (or equivalent)

**Purpose:** Process full or partial refunds (if required)

**Required Request Body:**
```json
{
  "amount": 10.50,
  "currency": "USD",
  "reason": "Customer request"
}
```

---

## API Specifications

### Authentication Methods

We support the following authentication methods:

1.**Bearer Token Authentication** (Preferred)
   - Header: `Authorization: Bearer {token}`
   - Token obtained via authentication API or provided as static credential

2.**Basic Authentication**
   - Header: `Authorization: Basic {base64_encoded_credentials}`
   - Used for authentication endpoint only

3.**API Key in Header**
   - Header: `X-API-Key: {api_key}` or `X-Auth-Token: {token}`

### Request/Response Formats

- **Content-Type**: We support both `application/json` and `application/x-www-form-urlencoded`
- **Response Format**: All responses must be valid JSON
- **Character Encoding**: UTF-8

### HTTP Status Codes

Your API should return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Invalid or missing authentication
- `403 Forbidden`: Valid authentication but insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

### Error Response Format

All error responses must include:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "result": {
    "code": "000.400.000",
    "description": "Error description"
  }
}
```

---

## Webhook Requirements

### Webhook Endpoint

**Our Webhook URL:** `https://api-dev.OpenSightai.com/api/webhook`  
**Alternative N-Genius Endpoint:** `https://api-dev.OpenSightai.com/api/webhooks/ngenius`

**Note:** Production URL will be provided during go-live. Test endpoint should be accessible for sandbox testing.

---

### Webhook Configuration

#### 1. Supported HTTP Methods

- **POST** (Required)

#### 2. Authentication Methods

We support the following authentication methods:

**Option A: Secret Header (Preferred)**
```
X-Webhook-Secret: {shared_secret_key}
```

**Option B: Signature Verification**
```
X-Signature: {hmac_sha256_signature}
X-Timestamp: {unix_timestamp}
```

**Option C: Bearer Token**
```
Authorization: Bearer {webhook_token}
```

#### 3. Encryption (Highly Recommended)

We **strongly prefer** encrypted webhooks for security. Supported encryption methods:

**Option A: AES-256-GCM Encryption (Preferred)**
- Algorithm: AES-256-GCM
- Key: Shared secret key (256 bits / 32 bytes)
- IV: 12-16 bytes, sent in header
- Auth Tag: 16 bytes, sent in header
- Format: Hex-encoded encrypted payload

**Required Headers:**
```
X-Initialization-Vector: {hex_encoded_iv}
X-Authentication-Tag: {hex_encoded_auth_tag}
```

**Payload Format:**
```json
{
  "encryptedBody": "hex_encoded_encrypted_data"
}
```
OR raw hex string in request body

**Option B: AES-256-CBC Encryption**
- Algorithm: AES-256-CBC
- Key: Shared secret key (256 bits / 32 bytes)
- IV: First 16 bytes of Base64-encoded payload
- Format: Base64-encoded encrypted payload

**Option C: Plain JSON with Authentication**
- Unencrypted JSON payload
- Must include authentication header (secret/signature)

---

### Webhook Events

#### Required Events

You **MUST** send webhooks for the following events:

1.**Payment Success** (`PAYMENT_SUCCESS`, `CAPTURED`, `AUTHORISED`, `PURCHASED`)
   - Triggered when payment is successfully processed
   - Must include: `merchantTransactionId`, `paymentId`, `amount`, `currency`, `resultCode`

2.**Payment Failure** (`PAYMENT_FAILED`, `DECLINED`, `FAILED`)
   - Triggered when payment is declined or fails
   - Must include: `merchantTransactionId`, `paymentId`, `failureReason`, `errorCode`

3.**Payment Pending** (`PENDING`, `PROCESSING`)
   - Triggered when payment is being processed
   - Must include: `merchantTransactionId`, `paymentId`

#### Optional Events (Recommended)

1.**Payment Reversal** (`REVERSED`, `REVERSAL`)
2.**Refund** (`REFUNDED`, `PARTIALLY_REFUNDED`)
3.**Chargeback** (`CHARGEBACK`)

---

### Webhook Payload Format

**Required Fields in Webhook Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type (e.g., "PAYMENT", "REFUND") |
| `eventId` | string | Yes | Unique event identifier for idempotency |
| `eventName` | string | Yes | Event name (e.g., "PAYMENT_SUCCESS", "CAPTURED") |
| `payload.id` | string | Yes | Payment transaction ID |
| `payload.merchantTransactionId` | string | Yes | Our original transaction ID |
| `payload.amount` | decimal | Yes | Payment amount |
| `payload.currency` | string | Yes | Currency code |
| `payload.result.code` | string | Yes | Result/status code |
| `payload.result.description` | string | Yes | Status description |
| `payload.timestamp` | string | Yes | ISO 8601 timestamp |
| `payload.customer.email` | string | No | Customer email |

**Example Webhook Payload (Encrypted/Decrypted):**

```json
{
  "type": "PAYMENT",
  "eventId": "evt_1234567890_abc123",
  "eventName": "PAYMENT_SUCCESS",
  "payload": {
    "id": "8acda4c99c83f980199c866d6cb0242",
    "merchantTransactionId": "order_1234567890_abc123",
    "amount": "10.50",
    "currency": "USD",
    "result": {
      "code": "000.000.000",
      "description": "Transaction successfully processed"
    },
    "paymentType": "DB",
    "paymentBrand": "VISA",
    "card": {
      "bin": "411111",
      "last4Digits": "1111",
      "brand": "VISA"
    },
    "customer": {
      "email": "customer@example.com"
    },
    "timestamp": "2025-01-01T12:00:00Z"
  }
}
```

**Alternative Format (N-Genius Style):**

```json
{
  "eventId": "evt_1234567890_abc123",
  "eventName": "CAPTURED",
  "outletId": "outlet_reference",
  "order": {
    "reference": "ORD-12345",
    "_id": "urn:order:ORD-12345",
    "_embedded": {
      "payment": [{
        "state": "CAPTURED",
        "amount": {
          "value": 1050,
          "currencyCode": "USD"
        },
        "paymentMethod": {
          "name": "VISA",
          "pan": "411111******1111",
          "cardholderName": "John Doe"
        },
        "authResponse": {
          "resultCode": "00",
          "resultMessage": "Approved",
          "authorizationCode": "AUTH123"
        }
      }]
    },
    "billingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "countryCode": "US"
    }
  }
}
```

---

### Webhook Delivery Requirements

1.**Retry Logic**: If our webhook endpoint returns non-2xx status, retry with exponential backoff (recommended: 3-5 retries)
2.**Timeout**: Webhook requests should timeout after 30 seconds
3.**Idempotency**: Include unique `eventId` in every webhook. We will ignore duplicate events based on this ID
4.**Ordering**: Webhooks should be sent in order of event occurrence (if possible)
5.**Acknowledgment**: We will return `200 OK` or `{"acknowledged": true}` upon successful processing

**Our Response Format:**
```json
{
  "acknowledged": true
}
```
OR
```
200 OK
```

---

### Payment Methods Support

We require support for the following payment methods:

1.**Credit/Debit Cards**
   - Visa, Mastercard, American Express, Discover
   - 3D Secure (3DS) support required

2.**Apple Pay** (Optional but preferred)
   - Separate entity/account ID may be required
   - Webhook payload should indicate payment method

3.**Google Pay** (Optional but preferred)
   - Separate entity/account ID may be required
   - Webhook payload should indicate payment method

**Payment Method Identification in Webhook:**
- Include `paymentBrand`, `paymentMethod`, or `card.brand` field
- For Apple Pay/Google Pay, include clear indicator (e.g., `paymentBrand: "APPLEPAY"`)

---

## Payment Flow

### Widget-Based Payment Flow (Preferred)

1.**Our Backend** calls your "Create Checkout" API
2.**Your Gateway** returns checkout session ID and integrity hash
3.**Our Frontend** loads your payment widget using checkout ID
4.**Customer** enters payment details in widget (on our site)
5.**Your Gateway** processes payment and redirects to our callback URL
6.**Our Backend** receives callback with resource path
7.**Our Backend** calls your "Verify Payment" API using resource path
8.**Your Gateway** sends webhook to our endpoint (confirmation)

#### Widget Integration Requirements

For widget-based payment flows, you must provide:

**Widget Script URL Format:**
```
{BASE_URL}/v1/paymentWidgets.js?checkoutId={checkoutId}
```

**Required Script Attributes:**
- `integrity`: Integrity hash from checkout response (for Subresource Integrity)
- `crossorigin`: Must be set to `"anonymous"`
- `async`: Script should load asynchronously

**Example Widget Integration:**
```html
<script 
  src="https://api.payment-gateway.com/v1/paymentWidgets.js?checkoutId={checkoutId}"
  integrity="sha256-{integrity_hash}"
  crossorigin="anonymous"
  async
></script>
```

**Widget Form Container:**
- The widget will automatically render a payment form in a container element
- Form container must be available in the DOM before script loads
- Widget automatically collects browser data (language, screen dimensions, timezone, user agent, etc.)

**shopperResultUrl (Callback URL):**
- **Important:** This is NOT included in the API request body
- Must be set in the form's `action` attribute when widget renders
- Format: `{your_gateway_url}/v1/checkouts/{checkoutId}/payment?shopperResultUrl={our_callback_url}`
- Our callback URL: `https://api-dev.OpenSightai.com/api/checkout/verify-payment?resourcePath={resourcePath}`

**Multiple Payment Methods:**
- We create separate checkout sessions for:
  - Credit/Debit Cards (primary checkout ID)
  - Apple Pay (separate checkout ID and entity ID)
  - Google Pay (separate checkout ID and entity ID)
- Each requires its own integrity hash
- Widget options can be configured via `wpwlOptions` global object (if supported)

**Browser Data Collection:**
- Widget automatically collects for 3D Secure:
  - Language
  - Screen height/width
  - Timezone
  - User agent
  - Java/JavaScript enabled status
  - Screen color depth
  - Challenge window size
- This data should NOT be sent in the initial API request (causes conflicts)

### Hosted Payment Page Flow (Alternative)

1.**Our Backend** calls your "Create Order" API
2.**Your Gateway** returns payment URL
3.**Our Frontend** redirects customer to your payment URL
4.**Customer** enters payment details on your hosted page
5.**Your Gateway** processes payment and redirects to our callback URL
6.**Your Gateway** sends webhook to our endpoint (confirmation)

### Redirect URLs

**Success/Callback URL:** `https://api-dev.OpenSightai.com/api/checkout/verify-payment?resourcePath={resourcePath}`

**Cancel URL:** `https://checkout.OpenSightai.com/payment-failed?reason=cancelled`

**Note:** Production URLs will be provided during go-live.

---

## Security & Compliance

### HTTPS Requirement

- All API endpoints **MUST** use HTTPS (TLS 1.2 or higher)
- SSL certificates must be valid and from a trusted CA
- No HTTP endpoints will be accepted

### PCI Compliance

- Payment gateway must be PCI DSS Level 1 compliant
- We do not store full card numbers on our servers
- Card data should only pass through your systems

### Data Encryption

- **In Transit**: All API calls must use HTTPS/TLS
- **Webhooks**: Strongly preferred to be encrypted (AES-256-GCM or AES-256-CBC)
- **Sensitive Data**: Card numbers, CVV codes should never be sent to our webhook endpoint

### IP Whitelisting (Optional)

If you require IP whitelisting, our production server IPs will be provided during go-live.

**Current Test Environment IPs:**
- (To be provided during integration setup)

### Rate Limiting

- API should support reasonable rate limits (minimum 100 requests/minute per account)
- Rate limit headers should be included in responses:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1640995200
  ```

---

## Testing & Sandbox

### Test Environment Requirements

1.**Sandbox API Base URL**: Must be provided for testing
2.**Test Credentials**: 
   - API Key/Token
   - Entity ID / Outlet Reference
   - Webhook Secret Key
3.**Test Cards**: List of test card numbers with expected behaviors
4.**Test Scenarios**: Documentation for testing success, failure, and edge cases

### Webhook Testing

We require the ability to:

1.**Send Test Webhooks**: Your gateway dashboard should allow sending test webhooks
2.**View Webhook Logs**: Access to webhook delivery logs and retry history
3.**Simulate Events**: Ability to trigger test events (success, failure, pending)

### Test Card Numbers

Please provide test card numbers for:

- **Success**: Card that processes successfully
- **Failure**: Card that declines with specific error codes
- **3D Secure**: Card that triggers 3DS authentication flow
- **Apple Pay / Google Pay**: Test wallet credentials

### Test Scenarios

Please provide test scenarios for:

1. Successful payment (all payment methods)
2. Declined payment (insufficient funds, card declined)
3. 3D Secure authentication flow
4. Payment timeout/expiry
5. Duplicate transaction prevention
6. Webhook delivery and retry logic
7. Invalid webhook payload handling

---

## Integration Checklist

Use this checklist to ensure all requirements are met:

### Pre-Integration

- [ ] API documentation provided and reviewed
- [ ] Sandbox/test environment credentials provided
- [ ] Test card numbers provided
- [ ] Webhook documentation provided
- [ ] Webhook secret/key shared securely

### API Endpoints

- [ ] Authentication API tested and working
- [ ] Create Payment/Checkout API tested and working
- [ ] Verify Payment Status API tested and working
- [ ] All required request parameters documented
- [ ] All required response fields documented
- [ ] Error responses include proper codes and messages

### Webhook Configuration

- [ ] Webhook endpoint URL configured in gateway dashboard
- [ ] Webhook authentication method configured (secret/signature)
- [ ] Webhook encryption configured (if applicable)
- [ ] Test webhook sent and successfully received
- [ ] Webhook payload format matches specification
- [ ] All required events configured to send webhooks
- [ ] Idempotency supported (unique event IDs)

### Payment Methods

- [ ] Credit/Debit card payments tested
- [ ] 3D Secure flow tested
- [ ] Apple Pay tested (if supported)
- [ ] Google Pay tested (if supported)
- [ ] Payment method identification in webhooks verified

### Security

- [ ] HTTPS enabled for all endpoints
- [ ] SSL certificate valid and trusted
- [ ] Webhook encryption implemented (preferred)
- [ ] Authentication credentials shared securely
- [ ] PCI compliance documentation provided

### Testing

- [ ] Successful payment flow tested end-to-end
- [ ] Failed payment flow tested
- [ ] Pending payment flow tested
- [ ] Webhook delivery tested (success, failure, pending)
- [ ] Webhook retry logic tested
- [ ] Duplicate transaction prevention tested
- [ ] Error handling tested

### Production Readiness

- [ ] Production credentials provided securely
- [ ] Production webhook URL configured
- [ ] Production redirect URLs configured
- [ ] Monitoring and logging set up
- [ ] Support contact information provided
- [ ] Emergency escalation process documented

---

## Contact Information

For integration support, please contact:

**Technical Contact:** Dave merlin  
**Email:** Support@OpenSightai.com  
**Support Hours:** 09:00-18:00

---

## Appendix

### Status Code Reference

Our system maps payment statuses as follows:

| Gateway Status | Our Internal Status | Description |
|----------------|-------------------|-------------|
| `CAPTURED`, `SUCCESS`, `000.000.000` | `unpaid` | Payment successful, awaiting commission payment |
| `PENDING`, `PROCESSING`, `000.200.000` | `pending` | Payment being processed |
| `FAILED`, `DECLINED`, `REJECTED` | `failed` | Payment declined or failed |
| `REVERSED`, `CANCELLED` | `reversed` | Payment reversed |
| `REFUNDED` | `refunded` | Payment refunded |

### Merchant Transaction ID Format

Our merchant transaction IDs follow this format:
```
order_{timestamp}_{random_string}
```

Example: `order_1704110400000_abc123xyz`

For Apple Pay/Google Pay, we append suffixes:
- Apple Pay: `order_1704110400000_abc123xyz_applepay`
- Google Pay: `order_1704110400000_abc123xyz_googlepay`

Please preserve this transaction ID in all API responses and webhook payloads.

---

**Document End**

