import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { enforceProductionSecurity } from "./startup";
import { WebhookHandlers } from "./webhookHandlers";

// Run security checks on startup (will exit in production if critical vars missing)
enforceProductionSecurity();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function hasReplitConnector(): boolean {
  return !!(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
  );
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[stripe] DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    const { getStripeSync } = await import('./stripeClient');

    if (hasReplitConnector()) {
      const { runMigrations } = await import('stripe-replit-sync');
      console.log('[stripe] Initializing Stripe schema (Replit mode)...');
      await runMigrations({ databaseUrl });
      console.log('[stripe] Stripe schema ready');

      const stripeSync = await getStripeSync();

      const domains = process.env.REPLIT_DOMAINS?.split(',');
      if (domains && domains.length > 0) {
        const webhookBaseUrl = `https://${domains[0]}`;
        console.log('[stripe] Setting up managed webhook...');
        try {
          const webhook = await stripeSync.findOrCreateManagedWebhook(
            `${webhookBaseUrl}/api/stripe/webhook`
          );
          console.log(`[stripe] Webhook configured: ${webhook?.url || 'unknown'}`);
        } catch (webhookError: any) {
          console.error('[stripe] Webhook setup error:', webhookError.message);
        }
      }

      console.log('[stripe] Starting background data sync...');
      stripeSync.syncBackfill()
        .then(() => console.log('[stripe] Data sync complete'))
        .catch((err: Error) => console.error('[stripe] Data sync error:', err.message));
    } else {
      console.log('[stripe] Running in standard mode (Render/other)');
      console.log('[stripe] Webhook URL must be configured in Stripe Dashboard');
      console.log('[stripe] Required: POST /api/stripe/webhook');
      
      if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('[stripe] STRIPE_SECRET_KEY not set - Stripe will not work');
        return;
      }
      
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.warn('[stripe] STRIPE_WEBHOOK_SECRET not set - webhook signature verification may fail');
      }
      
      console.log('[stripe] Stripe initialized with environment variables');
    }
  } catch (error: any) {
    console.error('[stripe] Initialization error:', error.message);
  }
}

// CRITICAL: Stripe webhook route MUST be registered BEFORE express.json()
// This route needs the raw Buffer body, not parsed JSON
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      
      if (!Buffer.isBuffer(req.body)) {
        console.error('[stripe-webhook] req.body is not a Buffer - middleware order issue');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[stripe-webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Stripe (schema, webhook, data sync)
  await initStripe();
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve uploads directory in both development and production
  const uploadsPath = path.resolve(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsPath));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
