# MCP Server for QuickBooks Online V3 API

A **Mock–Capture–Proxy (MCP) server** that sits in front of Intuit’s QuickBooks Online V3 Accounting API. It can:

| Mode        | Purpose                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **mock**    | Serve example payloads generated from the OpenAPI spec—design and test without calling Intuit.       |
| **proxy**   | Forward validated traffic to Intuit’s live or sandbox endpoints (adding the OAuth 2.0 bearer token). |
| **capture** | Proxy traffic **and** persist every request/response pair to an ND‑JSON log for replay or analytics. |

---

## ✨ Key Features

- **OpenAPI‑strict validation** – every incoming request is checked against the spec before it leaves your machine.
- **Automatic sample responses** – powered by `openapi‑backend`.
- **One‑line mode switch** – choose `mock`, `proxy`, or `capture` via `MCP_MODE` env var.
- **Stateless design** – no database required; capture logs are flat files.
- **100 % TypeScript** – easy to extend and type‑safe.

---

## 🛠️ Prerequisites

- Node.js ≥ 18
- A local copy of **QuickBooksOnlineV3.json** (Intuit’s OpenAPI definition).
- (Proxy/Capture only) An **OAuth 2.0 access token** for QuickBooks Online.

---

## 🚀 Getting Started

### 1  Clone & install

```bash
# clone repo (or copy the two source files)
npm i -S express openapi-backend http-proxy-middleware morgan dotenv
npm i -D typescript ts-node @types/node @types/express @types/morgan \
       @types/http-proxy-middleware
```

### 2  Place the spec

```bash
cp /path/to/QuickBooksOnlineV3.json ./QuickBooksOnlineV3.json
```

### 3  Configure environment

Create **.env** (or export vars) and adjust as needed:

```dotenv
# .env.example
MCP_MODE=mock                # mock | proxy | capture
SPEC_PATH=./QuickBooksOnlineV3.json
PORT=4000
QBO_BASE=https://quickbooks.api.intuit.com
QBO_TOKEN=eyJhbGc...          # required in proxy/capture modes
```

### 4  Run

```bash
# Mock server (no Intuit traffic)
MCP_MODE=mock  npx ts-node mcp-server.ts

# Validating reverse‑proxy
MCP_MODE=proxy QBO_TOKEN=<token> npx ts-node mcp-server.ts

# Proxy + persistent capture
MCP_MODE=capture QBO_TOKEN=<token> npx ts-node mcp-server.ts
```

You’ll see:

```
🌀 MCP server listening on http://localhost:4000  (mode=mock)
```

---

## 🔗 Local Endpoints

| URL           | Description                                    |
| ------------- | ---------------------------------------------- |
| `GET /health` | Simple JSON health‑check.                      |
| `ANY /api/*`  | All QuickBooks API paths (mock/proxy/capture). |

_Example_: `GET http://localhost:4000/api/v3/company/1234567890/customer`

---

## 📝 Capture Log Format (captures.ndjson)

Each line is a JSON object:

```json
{
  "ts": "2025-04-22T19:34:12.345Z",
  "req": {
    "method": "GET",
    "url": "/api/v3/company/1234/invoice/42",
    "headers": { "authorization": "Bearer …" },
    "body": {}
  },
  "res": {
    "status": 200,
    "body": { "Invoice": { … } }
  }
}
```

Great for regression tests, analytics, or seeding fixtures.

---

## 🧩 Extending & Customising

1. **Schema‑driven fakes** – swap `c.mock()` for [Stoplight Prism](https://github.com/stoplightio/prism) if you need dynamic values.
2. **Rate limiting** – bolt on `express-rate-limit` or front with Nginx to stay under Intuit’s 500 RPM cap.
3. **OAuth auto‑refresh** – catch 401s and swap your `refresh_token` for a new access token automatically.
4. **Typed SDK** – generate a client with `openapi-generator-cli` and import it to enforce compile‑time safety in custom handlers.

---

## 🐛 Common Errors & Fixes

| Symptom                 | Likely Cause               | Fix                                                       |
| ----------------------- | -------------------------- | --------------------------------------------------------- |
| `400 validationFail`    | Request doesn’t match spec | Double‑check path params, query, body schema              |
| `429 Throttle exceeded` | QuickBooks limit hit       | Slow down / add exponential back‑off                      |
| `401 Unauthorized`      | Expired access token       | Refresh OAuth token and restart or implement auto‑refresh |

---

## 📄 License

MIT © 2025 Your Name
