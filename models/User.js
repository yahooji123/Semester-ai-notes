const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  semester: { type: Number, min: 1, max: 8, default: 1 },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  isRegistrationEnabled: { type: Boolean, default: true },
  score: { type: Number, default: 0 }, // For Leaderboard
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to recalculate scores for all users
userSchema.statics.recalculateScores = async function() {
    const Progress = require('./Progress');
    const DownloadLog = require('./DownloadLog');
    const Comment = require('./Comment');
    
    //console.log('🔄 Starting Leaderboard Recalculation...');
    const users = await this.find({ role: 'student' });
    
    for (const user of users) {
        // 1. Progress Points
        // Read = 2, Revise = 5 (Additive logic: Unread->Read(+2), Unread->Revise(+5))
        // We just count current status.
        const readCount = await Progress.countDocuments({ user: user._id, status: 'read' });
        const reviseCount = await Progress.countDocuments({ user: user._id, status: 'revise' });
        const progressPoints = (readCount * 2) + (reviseCount * 5); // 2 + 3 = 5 total for revised

        // 2. Download Points
        const downloadCount = await DownloadLog.countDocuments({ user: user._id });
        const downloadPoints = downloadCount * 1;

        // 3. Comment Points
        const commentCount = await Comment.countDocuments({ user: user._id });
        const commentPoints = commentCount * 1; // +1 point 

        const totalScore = progressPoints + downloadPoints + commentPoints;
        
        // Update only if changed
        if (user.score !== totalScore) {
            user.score = totalScore;
            await user.save();
        }
    }
    //console.log('✅ Leaderboard Updated');
};

module.exports = mongoose.model('User', userSchema);
