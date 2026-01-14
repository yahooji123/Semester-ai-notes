/**
 * Admin Routes
 * Handles all administrative actions: Dashboard, Subjects, Topics, Papers, Announcements.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Models
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Paper = require('../models/Paper');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Announcement = require('../models/Announcement');

// Middleware & Config
const { isAdmin } = require('../middleware/auth');
const { storage: cloudinaryStorage, cloudinary } = require('../config/cloudinary');

/**
 * --- MULTER CONFIGURATION ---
 */

// 1. Local Storage for Topic Attachments
const localStorageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const uploadLocal = multer({ storage: localStorageConfig });

// 2. Cloudinary Storage for Question Papers (Images)
const uploadCloudinary = multer({ storage: cloudinaryStorage });


/**
 * --- DASHBOARD & ANALYTICS ---
 */

// GET Admin Dashboard
router.get('/', isAdmin, async (req, res) => {
  try {
    // Fetch Core Data
    const subjects = await Subject.find().sort({ semester: 1, name: 1 });
    const papers = await Paper.find().populate('subject');
    const currentUser = await User.findById(req.session.userId);
    const announcements = await Announcement.find().sort({ createdAt: -1 });

    // --- Analytics Logic ---
    
    // 1. Most Read Subject
    const subjectPopularity = await Progress.aggregate([
        { $match: { status: 'read' } },
        { 
            $lookup: {
                from: 'topics', localField: 'topic', foreignField: '_id', as: 'topic'
            }
        },
        { $unwind: '$topic' },
        {
            $lookup: {
                from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject'
            }
        },
        { $unwind: '$subject' },
        {
            $group: { _id: '$subject.name', count: { $sum: 1 } }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);
    const mostReadSubject = subjectPopularity[0] || { _id: 'None', count: 0 };

    // 2. Most "Stuck" Topics (Marked as 'revise')
    const stuckTopics = await Progress.aggregate([
        { $match: { status: 'revise' } },
        {
            $group: { _id: '$topic', count: { $sum: 1 } }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'topics', localField: '_id', foreignField: '_id', as: 'topicDetails'
            }
        },
        { $unwind: '$topicDetails' }
    ]);

    // Render View
    res.render('admin/dashboard', { 
        subjects, 
        papers,
        currentUser, 
        announcements,
        analytics: { mostReadSubject, stuckTopics }
    });

  } catch (err) {
      console.error("Dashboard Error:", err);
      res.status(500).send('Error loading dashboard');
  }
});


/**
 * --- ANNOUNCEMENTS ---
 */
router.post('/announcement', isAdmin, async (req, res) => {
    try {
        await Announcement.create(req.body);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating announcement");
    }
});

router.post('/announcement/:id/delete', isAdmin, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting announcement");
    }
});


/**
 * --- SITE SETTINGS ---
 */
router.post('/toggle-registration', isAdmin, async (req, res) => {
  try {
      const user = await User.findById(req.session.userId);
      user.isRegistrationEnabled = !user.isRegistrationEnabled;
      await user.save();
      res.redirect('/admin');
  } catch (err) {
      console.error(err);
      res.status(500).send("Error toggling registration");
  }
});


/**
 * --- SUBJECT MANAGEMENT ---
 */

// Add Subject Page
router.get('/subject/add', isAdmin, (req, res) => {
    res.render('admin/add-subject');
});

// Create Subject
router.post('/subject/add', isAdmin, async (req, res) => {
    try {
        await Subject.create(req.body);
        res.redirect('/admin');
    } catch(err) {
        res.send("Error creating subject: " + err.message);
    }
});

// Delete Subject & Cascading Delete
router.delete('/subject/:id', isAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        
        // 1. Delete associated Topics
        const topics = await Topic.find({ subject: subjectId });
        // (Ideally, we should also delete topic attachments from disk here, implemented in Topic deletion)
        await Topic.deleteMany({ subject: subjectId });

        // 2. Delete the Subject
        await Subject.findByIdAndDelete(subjectId);
        
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


/**
 * --- TOPIC MANAGEMENT ---
 */

// Add Topic Page
router.get('/subject/:id/add-topic', isAdmin, async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        const topics = await Topic.find({ subject: subject._id });
        const chapters = [...new Set(topics.map(t => t.chapterName))]; // Unique chapters
        
        res.render('admin/add-topic', { subject, chapters });
    } catch (err) {
        res.status(500).send("Error loading add topic page");
    }
});

// Create Topic (with Local Attachments)
router.post('/subject/:id/add-topic', isAdmin, uploadLocal.array('attachments'), async (req, res) => {
    try {
        const { chapterName, title, content } = req.body;
        
        // Process uploaded files
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

        res.redirect(`/subject/${req.params.id}`);
    } catch (err) {
        res.status(500).send("Error adding topic: " + err.message);
    }
});

// Delete Topic & Files
router.delete('/topic/:id', isAdmin, async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        const subjectId = topic.subject;

        // Delete files from disk
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


/**
 * --- PAPER (PYQ) MANAGEMENT ---
 */

// Add Paper Page
router.get('/paper/add', isAdmin, async (req, res) => {
    try {
        const subjects = await Subject.find().sort({ semester: 1, name: 1 });
        res.render('admin/add-paper', { subjects });
    } catch (err) {
        res.status(500).send("Error loading page");
    }
});

// Create Paper (Cloudinary Images)
router.post('/paper/add', isAdmin, (req, res, next) => {
    // Error handling wrapper for Multer
    uploadCloudinary.array('images', 50)(req, res, (err) => {
        if (err) {
            console.error("Multer Upload Error:", err);
            return res.status(500).send(`Upload Error: ${err.message}`);
        }
        next();
    });
}, async (req, res) => {
    try {
        const { subjectId, title, year, type } = req.body;
        
        let images = [];
        if (req.files) {
            images = req.files.map(file => ({
                url: file.path, 
                public_id: file.filename // Cloudinary returns 'filename' as the public ID mapping key in this storage engine usually
            }));
        }

        await Paper.create({
            subject: subjectId,
            title,
            year,
            type,
            images
        });

        res.redirect('/admin');
    } catch (err) {
        console.error("Error adding paper:", err);
        res.status(500).send("Database Error: " + err.message);
    }
});

// Delete Paper & Cloudinary Images
router.delete('/paper/:id', isAdmin, async (req, res) => {
    try {
        const paper = await Paper.findById(req.params.id);
        
        if (paper && paper.images) {
            for (let img of paper.images) {
                if (img.public_id) {
                    await cloudinary.uploader.destroy(img.public_id);
                }
            }
        }

        await Paper.findByIdAndDelete(req.params.id);
        
        const referer = req.get('Referer');
        if (referer && referer.includes('/subject/')) {
            res.redirect(referer);
        } else {
            res.redirect('/admin');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting paper");
    }
});

module.exports = router;
