/**
 * Paper Model
 * Represents a Question Paper (Previous Year Question - PYQ).
 * 
 * Relationships:
 * - Belongs to a Subject.
 * - Contains multiple Images (pages of the question paper).
 */

const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  title: {
    type: String,
    required: true // e.g., "End Semester 2023", "Mid Sem 2024"
  },
  year: {
    type: Number,
    required: true
  },
  type: {
    type: String, // 'mid', 'end', 'assignment'
    enum: ['mid', 'end', 'assignment', 'other'], // Restricted values
    default: 'end'
  },
  // Stores array of image URLs from Cloudinary
  images: [{
    url: String,
    public_id: String // Used for deletion from Cloudinary
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Paper', paperSchema);

module.exports = mongoose.model('Paper', paperSchema);
