const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Admin Dashboard
router.get('/', isAdmin, async (req, res) => {
  try {
    // Basic dashboard stats
    const subjects = await Subject.find();
    const currentUser = await User.findById(req.session.userId);
    res.render('admin/dashboard', { subjects, currentUser });
  } catch (err) {
    res.status(500).send('Error loading dashboard');
  }
});

// Toggle Registration
router.post('/toggle-registration', isAdmin, async (req, res) => {
  try {
      const user = await User.findById(req.session.userId);
      user.isRegistrationEnabled = !user.isRegistrationEnabled;
      await user.save();
      res.redirect('/admin');
  } catch (err) {
      res.status(500).send("Error");
  }
});

// Add Subject Page
router.get('/subject/add', isAdmin, (req, res) => {
    res.render('admin/add-subject');
});

// Add Subject POST
router.post('/subject/add', isAdmin, async (req, res) => {
    try {
        await Subject.create(req.body);
        res.redirect('/admin');
    } catch(err) {
        res.send("Error creating subject: " + err.message);
    }
});

// Delete Subject
router.delete('/subject/:id', isAdmin, async (req, res) => {
    try {
        await Subject.findByIdAndDelete(req.params.id);
        // Also delete associated topics
        await Topic.deleteMany({ subject: req.params.id });
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Add Topic Page
router.get('/subject/:id/add-topic', isAdmin, async (req, res) => {
    const subject = await Subject.findById(req.params.id);
    // Find existing chapters to autocomplete
    const topics = await Topic.find({ subject: subject._id });
    const chapters = [...new Set(topics.map(t => t.chapterName))];
    
    res.render('admin/add-topic', { subject, chapters });
});

// Add Topic POST
router.post('/subject/:id/add-topic', isAdmin, async (req, res) => {
    try {
        const { chapterName, title, content } = req.body;
        await Topic.create({
            subject: req.params.id,
            chapterName,
            title,
            content
        });
        res.redirect(`/subject/${req.params.id}`); // Redirect to view subject
    } catch (err) {
        res.send("Error adding topic: " + err.message);
    }
});

// Delete Topic
router.delete('/topic/:id', isAdmin, async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        const subjectId = topic.subject;
        await Topic.findByIdAndDelete(req.params.id);
        res.redirect(`/subject/${subjectId}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
