const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['unread', 'read', 'revise'],
    default: 'unread'
  },
  note: {
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Composite index to ensure one progress entry per user per topic
progressSchema.index({ user: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
