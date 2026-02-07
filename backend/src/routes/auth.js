const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { phone, password, username, enableBiometric } = req.body;
        const user = new User({
            phone,
            password,
            username,
            biometricEnabled: enableBiometric
        });
        await user.save();

        // No default categories - user creates their own

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.status(201).json({ user, token });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid login credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ user, token });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Get profile
router.get('/me', auth, async (req, res) => {
    res.json(req.user);
});

// Update settings
router.patch('/settings', auth, async (req, res) => {
    try {
        const { profileImage, ...settingsData } = req.body;

        // Handle profile image separately
        if (profileImage) {
            req.user.profileImage = profileImage;
        }

        // Update settings
        if (Object.keys(settingsData).length > 0) {
            req.user.settings = { ...req.user.settings, ...settingsData };
        }

        await req.user.save();
        res.json(req.user);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
