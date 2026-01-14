const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Paper = require('../models/Paper');
const Progress = require('../models/Progress');
const Goal = require('../models/Goal');
const Announcement = require('../models/Announcement');
const { isAuthenticated } = require('../middleware/auth');

// Helper to escape regex
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Home Route: Dashboard with Progress
router.get('/', async (req, res) => {
    try {
        const subjects = await Subject.find({}).sort({ semester: 1, name: 1 });
        // Announcements fetched via middleware
        
        let progressMap = {};
        let goals = [];
        let user = req.session.userId; // Assuming userId is stored in session

        if (user) {
            // Fetch User Goals
            goals = await Goal.find({ user: user }).sort({ targetDate: 1 });

            // Calculate progress for each subject
            for (let sub of subjects) {
                const totalTopics = await Topic.countDocuments({ subject: sub._id });
                if (totalTopics === 0) {
                    progressMap[sub._id] = { completed: 0, total: 0, percentage: 0 };
                    continue;
                }

                const distinctCompleted = await Progress.find({ 
                    user: user, 
                    topic: { $in: await Topic.find({ subject: sub._id }).distinct('_id') },
                    status: { $in: ['read', 'revise'] }
                });

                const count = distinctCompleted.length;
                const percent = Math.round((count / totalTopics) * 100);
                
                progressMap[sub._id] = {
                    completed: count,
                    total: totalTopics,
                    percentage: percent
                };
            }
        }

        res.render('index', { subjects, progressMap, goals: goals || [] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Search Route
router.get('/search', async (req, res) => {
    try {
        if (!req.query.q) {
            return res.redirect('/');
        }
        
        const regex = new RegExp(escapeRegex(req.query.q), 'gi');
        
        // Search in Topics (title or content)
        const topicResults = await Topic.find({
            $or: [
                { title: regex },
                // { content: regex } // Content search might be slow/heavy, optional
            ]
        }).populate('subject');

        // Search in Subjects
        const subjectResults = await Subject.find({
            name: regex
        });

        res.render('search-results', { 
            query: req.query.q, 
            topics: topicResults, 
            subjects: subjectResults
        });

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Subject / Topic View
router.get('/subject/:id', async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).send('Subject not found');

        // Fetch all topics for navigation
        const allTopics = await Topic.find({ subject: subject._id }).sort({ createdAt: 1 }); // Or sort by a specific order field if you add one

        // Group for Sidebar
        const chapters = {};
        allTopics.forEach(topic => {
            if (!chapters[topic.chapterName]) chapters[topic.chapterName] = [];
            chapters[topic.chapterName].push(topic);
        });

        // Determine Active Topic
        let activeTopic = null;
        let activeIndex = -1;
        
        if (req.query.topicId) {
            activeTopic = allTopics.find(t => t._id.toString() === req.query.topicId);
            activeIndex = allTopics.findIndex(t => t._id.toString() === req.query.topicId);
        } else if (allTopics.length > 0) {
            activeTopic = allTopics[0];
            activeIndex = 0;
        }

        // Determine Prev/Next
        let prevTopic = null;
        let nextTopic = null;

        if (activeIndex > 0) {
            prevTopic = allTopics[activeIndex - 1];
        }
        if (activeIndex !== -1 && activeIndex < allTopics.length - 1) {
            nextTopic = allTopics[activeIndex + 1];
        }

        // Fetch Progress for Active Topic
        let userProgress = null;
        if (req.session.userId && activeTopic) {
            userProgress = await Progress.findOne({ 
                user: req.session.userId, 
                topic: activeTopic._id 
            });
        }

        res.render('subject', {
            subject,
            chapters,
            activeTopic,
            prevTopic,
            nextTopic,
            userProgress
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Subject Papers View
router.get('/subject/:id/papers', async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).send('Subject not found');

        const papers = await Paper.find({ subject: subject._id }).sort({ year: -1 });

        // Fetch chapters for sidebar consistency
        const allTopics = await Topic.find({ subject: subject._id }).sort({ createdAt: 1 });
        const chapters = {};
        allTopics.forEach(topic => {
            if (!chapters[topic.chapterName]) chapters[topic.chapterName] = [];
            chapters[topic.chapterName].push(topic);
        });

        res.render('subject-papers', {
            subject,
            papers,
            chapters,
            activeTopic: null // To highlight sidebar correctly if needed, or just leave null
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// API: Save Progress
router.post('/api/progress', isAuthenticated, async (req, res) => {
    try {
        const { topicId, status, note } = req.body;
        
        // Upsert progress
        let progress = await Progress.findOne({ user: req.session.userId, topic: topicId });
        
        if (!progress) {
            progress = new Progress({
                user: req.session.userId,
                topic: topicId,
                status: 'unread'
            });
        }

        if (status) progress.status = status;
        if (note !== undefined) progress.note = note; // note can be empty string

        await progress.save();
        res.json({ success: true, progress });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false });
    }
});

// Goal Routes
router.post('/goals', isAuthenticated, async (req, res) => {
    try {
        await Goal.create({
            user: req.session.userId,
            title: req.body.title,
            targetDate: req.body.targetDate
        });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

router.post('/goals/:id/toggle', isAuthenticated, async (req, res) => {
    try {
        const goal = await Goal.findOne({ _id: req.params.id, user: req.session.userId });
        if (goal) {
            goal.completed = !goal.completed;
            await goal.save();
        }
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

router.post('/goals/:id/delete', isAuthenticated, async (req, res) => {
    try {
        await Goal.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

module.exports = router;
