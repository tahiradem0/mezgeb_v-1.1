const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true },
    biometricEnabled: { type: Boolean, default: false },
    profileImage: { type: String },
    settings: {
        darkMode: { type: Boolean, default: false },
        fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
        budgetLimit: { type: Number, default: 10000 },
        budgetAlertEnabled: { type: Boolean, default: true },
        reminderSchedule: { type: String, default: 'weekly' },
        notificationsEnabled: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
