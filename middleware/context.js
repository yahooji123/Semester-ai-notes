const User = require('../models/User');
const Announcement = require('../models/Announcement');
const SystemSettings = require('../models/SystemSettings');

exports.injectUser = async (req, res, next) => {
  res.locals.user = null;
  res.locals.isMainAdmin = false;
  res.locals.announcements = [];
  res.locals.studentLoginEnabled = true;

  try {
      let settings = await SystemSettings.findOne();
      if (!settings) settings = await SystemSettings.create({ studentLoginEnabled: true });
      res.locals.studentLoginEnabled = settings.studentLoginEnabled;

      if (req.session.userId) {
          const user = await User.findById(req.session.userId).select('-password');
          if (user) {
              res.locals.user = user;
              res.locals.isMainAdmin = (user.role === 'admin' && user.username === 'admin');
              req.session.username = user.username;
              req.session.role = user.role;
          } else {
              req.session.destroy();
          }
      }

      const announcements = await Announcement.find({ active: true }).sort({ createdAt: -1 });
      res.locals.announcements = announcements;
  } catch (err) {
      console.error('Error in context middleware:', err);
  }
  next();
};