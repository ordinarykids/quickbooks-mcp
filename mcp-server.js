/*
 * MCP Server for QuickBooks Online V3 Accounting API
 * --------------------------------------------------
 * Modes:
 *  mock    – serve example responses generated from the OpenAPI spec
 *  proxy   – forward validated requests to QuickBooks production or sandbox
 *  capture – proxy + persist a log of each exchange (ND‑JSON)
 *
 * Usage:
 *  1.  npm i -S express openapi-backend http-proxy-middleware morgan dotenv
 *      npm i -D typescript ts-node @types/node @types/express @types/morgan @types/http-proxy-middleware
 *  2.  Put the spec in ./QuickBooksOnlineV3.json or point SPEC_PATH env to it.
 *  3.  cp .env.example .env  # then edit
 *  4.  MODE=mock   npx ts-node mcp-server.ts
 *      MODE=proxy  QBO_TOKEN=... QBO_BASE=https://quickbooks.api.intuit.com npx ts-node mcp-server.ts
 *  5.  Hit    http://localhost:4000/api/v3/company/<companyId>/customer
 */

import { OpenAPIBackend, Context } from 'openapi-backend';
import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Environment ---------------------------------------------------------------
const SPEC_PATH = process.env.SPEC_PATH || path.join(__dirname, 'QuickBooksOnlineV3.json');
const MODE = (process.env.MCP_MODE || 'mock').toLowerCase(); // mock | proxy | capture
const PORT = Number(process.env.PORT) || 4000;
const QBO_BASE = process.env.QBO_BASE || 'https://quickbooks.api.intuit.com';
const QBO_TOKEN = process.env.QBO_TOKEN; // Bearer token for proxy mode

// OpenAPI Backend -----------------------------------------------------------
const api = new OpenAPIBackend({ definition: SPEC_PATH, quick: true });

api.register({
  notImplemented: async (c: Context, req: Request, res: Response) =>
    res.status(501).json({ error: 'Not implemented in MCP mock' }),
  notFound: async (c: Context, req: Request, res: Response) =>
    res.status(404).json({ error: 'Path not found in specification' }),
  validationFail: async (c: Context, req: Request, res: Response) =>
    res.status(400).json({ errors: c.validation.errors }),
  mock: async (c: Context, req: Request, res: Response) =>
    res.status(c.response.status || 200).json(c.mock()),
});

await api.init();

// Express -------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// Capture helper ------------------------------------------------------------
const captureExchange = (req: Request, resBody: string, status: number): void => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    req: { method: req.method, url: req.originalUrl, headers: req.headers, body: req.body },
    res: { status, body: resBody },
  });
  fs.appendFileSync('captures.ndjson', line + '\n');
};

// Proxy or Capture ----------------------------------------------------------
if (MODE === 'proxy' || MODE === 'capture') {
  app.use(
    '/api',
    createProxyMiddleware({
      target: QBO_BASE,
      changeOrigin: true,
      pathRewrite: (pathStr) => pathStr.replace(/^\/api/, ''),
      onProxyReq: (proxyReq) => {
        if (QBO_TOKEN) proxyReq.setHeader('Authorization', `Bearer ${QBO_TOKEN}`);
      },
      onProxyRes: (proxyRes, req) => {
        if (MODE !== 'capture') return;
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          captureExchange(req as Request, body, proxyRes.statusCode || 0);
        });
      },
    })
  );
}

// Mock or Capture (validate + mock on fallback) -----------------------------
if (MODE === 'mock' || MODE === 'capture') {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Validate request against spec; if valid and MODE==mock provide example
    api.handleRequest(req, req, res, undefined, next);
  });
}

// Health --------------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ ok: true, mode: MODE }));

app.listen(PORT, () => {
  console.log(`🌀 MCP server listening on http://localhost:${PORT}  (mode=${MODE})`);
});

