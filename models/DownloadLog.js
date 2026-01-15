const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper', // Assuming you have a Paper model
    required: true
  },
  downloadedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure unique download record per user per paper
downloadLogSchema.index({ user: 1, paper: 1 }, { unique: true });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);
