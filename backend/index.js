import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// ── Startup security checks ──────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

import './src/config/db.js';
import accountingRoutes   from './src/modules/accounting/accounting.routes.js';
import authRoutes         from './src/modules/auth/auth.routes.js';
import receivablesRoutes  from './src/modules/receivables/receivables.routes.js';
import payablesRoutes     from './src/modules/payables/payables.routes.js';
import inventoryRoutes    from './src/modules/inventory/inventory.routes.js';
import payrollRoutes      from './src/modules/payroll/payroll.routes.js';
import procurementRoutes  from './src/modules/procurement/procurement.routes.js';
import bankingRoutes      from './src/modules/banking/banking.routes.js';
import analyticsRoutes    from './src/modules/analytics/analytics.routes.js';
import posRoutes          from './src/modules/pos/pos.routes.js';
import settingsRoutes     from './src/modules/settings/settings.routes.js';
import creditNotesRoutes  from './src/modules/credit-notes/credit-notes.routes.js';
import cashRoutes         from './src/modules/cash/cash.routes.js';
import auditRoutes        from './src/modules/audit/audit.routes.js';

const app = express();

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,   // needed for some API clients
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));

// ── CORS — only allow the known frontend origin ──────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Gzip compress all responses ──────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Parse JSON bodies up to 1 MB (tighten from 2 MB to reduce DoS surface) ──
app.use(express.json({ limit: '1mb' }));

// ── Disable X-Powered-By (already done by Helmet, belt-and-braces) ──────────
app.disable('x-powered-by');

// ── Global rate limiter: 200 req / 15 min per IP ────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', globalLimiter);

// ── Strict rate limiter for auth endpoints: 10 attempts / 15 min ─────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/accounting',   accountingRoutes);
app.use('/api/receivables',  receivablesRoutes);
app.use('/api/payables',     payablesRoutes);
app.use('/api/inventory',    inventoryRoutes);
app.use('/api/payroll',      payrollRoutes);
app.use('/api/procurement',  procurementRoutes);
app.use('/api/banking',      bankingRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/pos',          posRoutes);
app.use('/api/settings',     settingsRoutes);
app.use('/api/credit-notes', creditNotesRoutes);
app.use('/api/cash',         cashRoutes);
app.use('/api/audit',        auditRoutes);

import { protect } from './src/middleware/auth.js';

app.get('/api/me', protect, (req, res) => {
  res.json({ message: 'Protected route works', user: req.user });
});

app.get('/', (req, res) => {
  res.json({ message: 'AI CFO Africa API is running' });
});

// ── Global error handler — never leak internal errors ────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err);
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(err.status || 500).json({ error: err.isOperational ? err.message : 'An internal error occurred' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
