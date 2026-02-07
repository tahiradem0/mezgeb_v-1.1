const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String, required: true },
    color: { type: String, default: '#333' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional if groupId is present
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Shared Category
    isVisible: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Category', categorySchema);
