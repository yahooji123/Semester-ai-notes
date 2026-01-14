const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'admin'
  }
});

// Configure global settings for the app, strictly stored in a separate collection or just handled via the first user logic.
// For simplicity, we'll check if any user exists to determine "First Time" setup.
// And we can add a flag on the admin user document if they allow registration.
userSchema.add({
  isRegistrationEnabled: {
    type: Boolean,
    default: false // Only main admin can toggle this
  }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
