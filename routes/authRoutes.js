const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const { isAdmin } = require('../middleware/auth');

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('login', { error: null });
});

router.get('/admin/login', (req, res) => {
    if (req.session.userId && req.session.role === 'admin') return res.redirect('/admin');
    res.render('admin-login', { error: null });
});

router.post('/admin/toggle-student-login', isAdmin, async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) settings = new SystemSettings();
        settings.studentLoginEnabled = !settings.studentLoginEnabled;
        await settings.save();
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

router.post('/login', async (req, res) => {
    const { username, password, loginType } = req.body;
    
    try {
        if (loginType !== 'admin') {
            const settings = await SystemSettings.findOne();
            if (settings && !settings.studentLoginEnabled) {
                return res.render('login', { error: 'Student login is currently disabled by the Administrator.' });
            }
        }

        let user;
        if (loginType === 'admin') {
            user = await User.findOne({ username: username });
        } else {
            user = await User.findOne({ 
                $or: [{ email: username.toLowerCase() }, { username: username.toLowerCase() }] 
            });
        }

        if (!user) {
            const view = loginType === 'admin' ? 'admin-login' : 'login';
            return res.render(view, { error: 'Invalid credentials' });
        }

        if (loginType !== 'admin' && user.role === 'admin') {
            return res.render('login', { error: 'Admins must use the Dedicated Admin Portal.' });
        }
        if (loginType === 'admin' && user.role !== 'admin') {
            return res.render('admin-login', { error: 'Access Denied: This portal is for Admins only.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            const view = loginType === 'admin' ? 'admin-login' : 'login';
             return res.render(view, { error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.redirect(user.role === 'admin' ? '/admin' : '/');

    } catch (err) {
        console.error('Login Error:', err);
        res.render(loginType === 'admin' ? 'admin-login' : 'login', { error: 'Server Error' });
    }
});

router.get('/register', async (req, res) => {
    if (req.session.userId) return res.redirect('/');
    try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            return res.render('register', { message: 'System Setup: Create Main Admin Account.', error: null, isSetup: true });
        }
        const mainAdmin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
        if (mainAdmin && mainAdmin.isRegistrationEnabled === false) {
             return res.render('login', { error: 'Registration is closed.' });
        }
        res.render('register', { message: null, error: null, isSetup: false });
    } catch (err) { res.redirect('/'); }
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, semester, password } = req.body;
        const userCount = await User.countDocuments();

        if (!email || !password) return res.render('register', { error: 'Missing fields', message: null, isSetup: userCount===0 });

        const existingUser = await User.findOne({ $or: [{ email: email }, { username: email }] });
        if (existingUser) return res.render('register', { error: 'Email already registered.', message: null, isSetup: userCount===0 });

        let newUser;
        if (userCount === 0) {
            newUser = new User({
                name: name || 'Admin',
                email: email.toLowerCase(),
                username: 'admin',
                password: password,
                role: 'admin',
                semester: null
            });
        } else {
            newUser = new User({
                name: name,
                email: email.toLowerCase(),
                username: email.toLowerCase(),
                password: password,
                semester: semester || 1,
                role: 'student'
            });
        }
        await newUser.save();
        res.redirect(userCount === 0 ? '/admin/login' : '/login');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Registration failed.', message: null, isSetup: false });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;