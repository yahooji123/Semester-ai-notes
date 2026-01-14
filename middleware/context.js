const User = require('../models/User');
const Announcement = require('../models/Announcement');

exports.injectUser = async (req, res, next) => {
  res.locals.user = null;
  res.locals.isMainAdmin = false;
  res.locals.announcements = [];

  try {
      // Inject active announcements globally
      const announcements = await Announcement.find({ active: true }).sort({ createdAt: -1 });
      res.locals.announcements = announcements;
  } catch (err) {
      console.error('Error fetching announcements in middleware:', err);
  }

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
