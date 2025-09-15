// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/index.html');
}

// Role-based middleware
function isAdmin(req, res, next) {
  if (req.session.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admins only.');
}
