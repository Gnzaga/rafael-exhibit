import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import BetterSqliteStore from 'better-sqlite3-session-store';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import authRouter from './auth.js';
import userRouter from './routes/user.js';
import commentsRouter from './routes/comments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SqliteStore = BetterSqliteStore(session);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust the reverse proxy (nginx) so req.secure reflects the original HTTPS connection.
// Without this, express-session with secure:true silently skips setting the cookie.
app.set('trust proxy', 1);

// Security headers - needs to be permissive for local assets and inline scripts
app.use(helmet({
  contentSecurityPolicy: false, // We'll configure this later if needed
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session setup with SQLite store
app.use(session({
  store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// CSRF protection: check Origin header on state-changing requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).json({ error: 'CSRF check failed' });
      }
    }
  }
  next();
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/comments', commentsRouter);

// Serve static files from dist/
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
