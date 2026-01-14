// Check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Check if user is admin
exports.isAdmin = async (req, res, next) => {
  if (req.session.userId) {
    // In a real app we might want to fetch the user again or store role in session
    // Storing role in session for performance
    if (req.session.role === 'admin') {
      return next();
    } else {
      return res.status(403).send('Access Denied: Admins only');
    }
  }
  res.redirect('/login');
};
