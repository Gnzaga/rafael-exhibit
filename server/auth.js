import { Router } from 'express';
import { Issuer, generators } from 'openid-client';
import { db } from './db.js';

const router = Router();

let oidcClient = null;

async function getOidcClient() {
  if (oidcClient) return oidcClient;

  const issuerUrl = process.env.AUTHENTIK_ISSUER;
  if (!issuerUrl) throw new Error('AUTHENTIK_ISSUER not configured');

  const issuer = await Issuer.discover(issuerUrl);
  oidcClient = new issuer.Client({
    client_id: process.env.AUTHENTIK_CLIENT_ID,
    client_secret: process.env.AUTHENTIK_CLIENT_SECRET,
    redirect_uris: [process.env.AUTHENTIK_REDIRECT_URI],
    response_types: ['code'],
  });

  return oidcClient;
}

// GET /api/auth/login
router.get('/login', async (req, res) => {
  try {
    const client = await getOidcClient();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.oidcState = state;
    req.session.codeVerifier = codeVerifier;

    // Store where to redirect after login
    req.session.returnTo = req.query.returnTo || '/';

    await req.session.save(); // Ensure session is saved before redirect

    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authUrl);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

// GET /api/auth/callback
router.get('/callback', async (req, res) => {
  try {
    const client = await getOidcClient();
    const { oidcState: expectedState, codeVerifier, returnTo } = req.session;

    if (!expectedState || !codeVerifier) {
      return res.redirect('/?error=invalid_session');
    }

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(
      process.env.AUTHENTIK_REDIRECT_URI,
      params,
      { state: expectedState, code_verifier: codeVerifier }
    );

    const userinfo = await client.userinfo(tokenSet);

    // Determine if user is admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const isAdmin = adminEmails.includes((userinfo.email || '').toLowerCase()) ? 1 : 0;

    // Upsert user in database
    const upsert = db.prepare(`
      INSERT INTO users (authentik_sub, email, display_name, is_admin, updated_at)
      VALUES (@sub, @email, @display_name, @is_admin, datetime('now'))
      ON CONFLICT(authentik_sub) DO UPDATE SET
        email = excluded.email,
        is_admin = excluded.is_admin,
        updated_at = datetime('now')
    `);

    upsert.run({
      sub: userinfo.sub,
      email: userinfo.email || '',
      display_name: userinfo.name || userinfo.preferred_username || userinfo.email || '',
      is_admin: isAdmin,
    });

    // Fetch the full user record
    const user = db.prepare('SELECT * FROM users WHERE authentik_sub = ?').get(userinfo.sub);

    // Set session user
    req.session.user = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      relation: user.relation,
      is_admin: user.is_admin === 1,
    };

    // Clean up OIDC session data
    delete req.session.oidcState;
    delete req.session.codeVerifier;

    const redirectTo = returnTo || '/';
    delete req.session.returnTo;

    res.redirect(redirectTo);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json(req.session?.user || null);
});

export const requireAuth = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Authentication required' });
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.session.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

export default router;
