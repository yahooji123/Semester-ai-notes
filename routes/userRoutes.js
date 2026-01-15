const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

router.post('/update', isAuthenticated, async (req, res) => {
    try {
        const { semester, password } = req.body;
        const userId = req.session.userId;
        const user = await User.findById(userId);
        
        if (!user) return res.redirect('/');

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
             return res.send("<script>alert('Incorrect Password'); window.location.href='/';</script>");
        }

        user.semester = parseInt(semester);
        await user.save();
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

module.exports = router;