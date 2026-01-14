const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Announcement = require('../models/Announcement');
const { isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Clean filename to remove special chars
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage: storage });

// Admin Dashboard
router.get('/', isAdmin, async (req, res) => {
  try {
    // Basic dashboard stats
    const subjects = await Subject.find();
    const currentUser = await User.findById(req.session.userId);
    const announcements = await Announcement.find().sort({ createdAt: -1 });

    // --- Analytics ---
    
    // 1. Most Read Subject
    // Aggregate all progress 'read' -> lookup topic -> lookup subject -> group by subject
    const subjectPopularity = await Progress.aggregate([
        { $match: { status: 'read' } },
        { 
            $lookup: {
                from: 'topics',
                localField: 'topic',
                foreignField: '_id',
                as: 'topicDetails'
            }
        },
        { $unwind: '$topicDetails' },
        {
            $lookup: {
                from: 'subjects',
                localField: 'topicDetails.subject',
                foreignField: '_id',
                as: 'subjectDetails'
            }
        },
        { $unwind: '$subjectDetails' },
        {
            $group: {
                _id: '$subjectDetails.name',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);
    const mostReadSubject = subjectPopularity[0] || { _id: 'None', count: 0 };

    // 2. Most Revised Topic (Stuck Points)
    const stuckTopics = await Progress.aggregate([
        { $match: { status: 'revise' } },
        {
            $group: {
                _id: '$topic',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'topics',
                localField: '_id',
                foreignField: '_id',
                as: 'topicDetails'
            }
        },
        { $unwind: '$topicDetails' }
    ]);

    res.render('admin/dashboard', { 
        subjects, 
        currentUser, 
        announcements,
        analytics: {
            mostReadSubject,
            stuckTopics
        }
    });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error loading dashboard');
  }
});

// Announcement Routes
router.post('/announcement', isAdmin, async (req, res) => {
    try {
        await Announcement.create(req.body);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send("Error");
    }
});

router.post('/announcement/:id/delete', isAdmin, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send("Error");
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
router.post('/subject/:id/add-topic', isAdmin, upload.array('attachments'), async (req, res) => {
    try {
        const { chapterName, title, content } = req.body;
        
        let attachments = [];
        if (req.files) {
            attachments = req.files.map(file => ({
                filename: file.filename,
                path: '/uploads/' + file.filename,
                originalname: file.originalname
            }));
        }

        await Topic.create({
            subject: req.params.id,
            chapterName,
            title,
            content,
            attachments
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

        // Delete associated files
        if (topic.attachments && topic.attachments.length > 0) {
            topic.attachments.forEach(file => {
                const filePath = path.join(__dirname, '../public', file.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        await Topic.findByIdAndDelete(req.params.id);
        res.redirect(`/subject/${subjectId}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
