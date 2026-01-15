/**
 * Semester Notes Management System
 * Final Year Project
 * 
 * Main Server File
 * Configures Express, Database, Middleware, and Routes.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const { injectUser } = require('./middleware/context');

// Initialize App
const app = express();


// --- CRON JOB: Recalculate Leaderboard every 1 hour ---
const User = require('./models/User');
setInterval(() => {
    User.recalculateScores().catch(err => console.error('Leaderboard Update Error:', err));
}, 1000 * 60 * 60); // 1 hour
// Run once on startup for development testing
setTimeout(() => {
    User.recalculateScores().catch(e => console.error(e));
}, 5000); 

/**
 * Database Connection (MongoDB)
 */
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/semester_notes')
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

/**
 * Middleware Configuration
 */
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.json()); // Parse JSON bodies
app.use(methodOverride('_method')); // Support PUT/DELETE in forms
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

/**
 * Session Configuration
 */
app.use(session({
  secret: process.env.session_secret || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/semester_notes' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day session
}));

// View Engine Setup (EJS)
app.set('view engine', 'ejs');

// Custom Global Middleware (User Context)
app.use(injectUser);

/**
 * Route Handlers
 */
app.use('/', require('./routes/indexRoutes')); // Public Routes
app.use('/', require('./routes/authRoutes'));  // Authentication
app.use('/admin', require('./routes/adminRoutes')); // Admin Panel
app.use('/contribution', require('./routes/contributionRoutes')); // Contribution Routes
app.use('/profile', require('./routes/userRoutes')); // User Profile

/**
 * Server Start
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
