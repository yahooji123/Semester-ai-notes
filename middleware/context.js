const User = require('../models/User');

exports.injectUser = async (req, res, next) => {
  res.locals.user = null;
  res.locals.isMainAdmin = false;

  if (req.session.userId) {
    res.locals.user = {
      _id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    };
    
    // Check if this user enabled registration (basically check if they are "main" admin logic could be here)
    // For now, simple injection
  }
  next();
};
