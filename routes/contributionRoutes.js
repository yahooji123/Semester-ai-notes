const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage, cloudinary } = require('../config/cloudinary');
const upload = multer({ storage });

const CommunityNote = require('../models/CommunityNote');
const Subject = require('../models/Subject');
const User = require('../models/User');

const { isAuthenticated, isAdmin } = require('../middleware/auth');

// POST: Upload a new note (Student)
router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        const { subjectId, title, description } = req.body;
        
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const newNote = new CommunityNote({
            subject: subjectId,
            uploadedBy: req.session.userId,
            title,
            description,
            fileUrl: req.file.path,
            originalName: req.file.originalname,
            status: 'pending' // pending approval
        });

        await newNote.save();
        res.redirect('/subject/' + subjectId + '/papers?msg=uploaded');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ADMIN ROUTES

// GET: Manage Contributions Requests
router.get('/admin/manage', isAdmin, async (req, res) => {
    try {
        const pendingNotes = await CommunityNote.find({ status: 'pending' })
            .populate('subject')
            .populate('uploadedBy')
            .sort({ createdAt: -1 });
            
        res.render('admin/contributions', { pendingNotes, path: '/admin/contributions' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Approve
router.post('/admin/approve/:id', isAdmin, async (req, res) => {
    try {
        const note = await CommunityNote.findById(req.params.id);
        if (!note) return res.status(404).send('Note not found');

        note.status = 'approved';
        await note.save();

        // Recalculate scores specifically for this user to trigger instant update?
        // Actually global recalculate runs hourly.
        // But for better UX, let's update this user specifically if possible, or just wait.
        // User.recalculateScores() is static and recalculates ALL.
        // Let's just wait for Cron or run it for everyone here (might be heavy?)
        // Let's leave it to Cron, or manual trigger.
        // Or if I want instant gratification, I can call User.recalculateScores().
        
        await User.recalculateScores(); 

        res.redirect('/contribution/admin/manage?msg=approved');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Reject
router.post('/admin/reject/:id', isAdmin, async (req, res) => {
    try {
        const note = await CommunityNote.findById(req.params.id);
        if (note) {
            note.status = 'rejected';
            // Optionally delete from Cloudinary using note.fileUrl public_id logic
            // But soft delete (status rejected) is safer for history.
            await note.save();
        }
        res.redirect('/contribution/admin/manage?msg=rejected');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE: Delete a Note
router.delete('/admin/delete/:id', isAdmin, async (req, res) => {
    try {
        const note = await CommunityNote.findById(req.params.id);
        if (note) {
            // Delete from Cloudinary
            if (note.fileUrl) {
                // Extract public_id from URL
                // URL: .../upload/v1234/folder/filename.ext
                // Needed: folder/filename (without extension)
                
                // Regex to find content between 'upload/' (and optional version) and the extension
                const publicIdMatch = note.fileUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
                
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = publicIdMatch[1];
                    try {
                        // For raw files (PDFs often are treated as 'image' by Cloudinary SDK if uploaded via image upload preset/method, or 'raw'.
                        // However, multer-storage-cloudinary usually uploads as 'image' resource type by default unless specified.
                        // We'll try destroying safely.
                        await cloudinary.uploader.destroy(publicId);
                    } catch (e) {
                        console.error("Cloudinary Delete Error:", e);
                    }
                }
            }
            
            await CommunityNote.findByIdAndDelete(req.params.id);
        }
        
        // Redirect back to request page (referer)
        const referer = req.get('Referer');
        res.redirect(referer || '/contribution/admin/manage');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
