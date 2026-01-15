const mongoose = require('mongoose');
const systemSettingsSchema = new mongoose.Schema({
    studentLoginEnabled: { type: Boolean, default: true }
});
module.exports = mongoose.model('SystemSettings', systemSettingsSchema);