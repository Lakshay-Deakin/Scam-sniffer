// utils/auth.js

/**
 * Attach a lightweight user object to res.locals (handy for future server-rendered pages).
 */
function withUser(req, res, next) {
  res.locals.user = {
    id: req.session?.userId || null,
    email: req.session?.email || null, // <- be sure to set this in /login and /register
    role: req.session?.role || null,
  };
  next();
}

/**
 * Require any authenticated user.
 * - For XHR/Fetch (JSON requests), return 401 JSON.
 * - For normal browser requests, redirect to sign-in.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ authenticated: false });
  }
  return res.redirect('/signin.html');
}

/**
 * Admin gate.
 */
function isAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).send('Not authenticated.');
  }
  if (req.session.role === 'admin') return next();
  return res.status(403).send('Access denied. Admins only.');
}

/**
 * JSON auth status used by the front-end (analyse.html)
 */
function authStatus(req, res) {
  res.json({
    authenticated: !!(req.session && req.session.userId),
    email: req.session?.email || null,
    role: req.session?.role || null,
  });
}

/**
 * Convenience to mount status endpoints.
 * Call this after session middleware: mountAuthEndpoints(app)
 */
function mountAuthEndpoints(app) {
  app.get('/api/auth/check', authStatus);
  app.get('/api/auth/status', authStatus); // alias
}

module.exports = {
  withUser,
  isAuthenticated,
  isAdmin,
  authStatus,
  mountAuthEndpoints,
};
