const mongoose = require('mongoose');

const userImportantNoteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    topic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        required: true
    },
    selectedText: {
        type: String,
        required: true
    },
    noteContent: {
        type: String, // The text note added by the student
        required: true
    },
    // Context to help locate the text if there are duplicates
    contextPrefix: {
        type: String, 
        default: ''
    },
    contextSuffix: {
        type: String,
        default: ''
    },
    style: {
        type: String,
        enum: ['highlight', 'underline'],
        default: 'highlight'
    },
    occurrenceIndex: {
        type: Number,
        default: 0
    },
    globalOffset: {
        type: Number,
        required: true
    },
    color: {
        type: String,
        default: '#ffd700' // Default highlight color (gold/yellow)
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserImportantNote', userImportantNoteSchema);
