const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    period: { type: String, enum: ['Weekly', 'Monthly', 'Yearly'], default: 'Monthly' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null }, // null means personal context
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Budget', budgetSchema);
