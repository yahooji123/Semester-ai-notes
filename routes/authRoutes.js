const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Login Page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Login Handlder
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
        return res.render('login', { error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
         return res.render('login', { error: 'Invalid credentials' });
    }

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.user = user; // Set full user object for views
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Server error' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Register Page (Smart logic)
router.get('/register', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    
    // Allow if no users exist (First Admin)
    if (userCount === 0) {
      return res.render('register', { error: null, message: 'Welcome! Create the Main Admin account.' });
    }

    // If users exist, only logged-in Admins can register others
    if (req.session.userId && req.session.role === 'admin') {
         // Check if current admin has rights? For now assume all admins can, or just Main.
         // Let's implement the specific requirement: "main admin... uske enable disable kr sakega"
         // This implies a toggle. 
         const currentUser = await User.findById(req.session.userId);
         if(currentUser.isRegistrationEnabled) {
            return res.render('register', { error: null, message: 'Register a new user.' });
         } else {
             return res.render('admin/dashboard', { error: 'Registration is disabled by Main Admin.', success: null, subjects: [] }); // Simplification, ideally redirect
         }
    }

    // Default: Redirect to login
    res.redirect('/login');

  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Register Handler
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userCount = await User.countDocuments();
    let role = 'student'; // Default role
    let isRegistrationEnabled = false;

    if (userCount === 0) {
      role = 'admin';
      isRegistrationEnabled = true; // Main admin can register others by default? Or enables it?
      // "admin login krne ke baad aur koi register karega ya ni uske enable aur disable kr sakega"
      // Suggests defaults to false, but he can turn it on.
      // But if count is 0, this IS the registration.
    } else {
        // If not first user, ensure requester is authorized
        if (!req.session.userId) return res.status(403).send("Unauthorized");
        // Could force role selection here if needed
    }

    const newUser = new User({ username, password, role, isRegistrationEnabled });
    await newUser.save();

    if (userCount === 0) {
      // Login immediately if first user
      req.session.userId = newUser._id;
      req.session.username = newUser.username;
      req.session.role = newUser.role;
      return res.redirect('/admin');
    }

    res.redirect('/admin'); // Redirect back to admin dashboard
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Error creating user (Username might be taken)', message: null });
  }
});

module.exports = router;
