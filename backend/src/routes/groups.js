const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create a new group
router.post('/create', auth, async (req, res) => {
    try {
        const { name, connectionId } = req.body;

        // Check if user already has a group with this ID (optional, but good for cleanliness)
        // For simplicity, allow multiple.

        const group = new Group({
            name,
            connectionId,
            members: [req.user._id]
        });

        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Join a group
router.post('/join', auth, async (req, res) => {
    try {
        const { partnerPhone, connectionId } = req.body;

        // 1. Find the partner user
        const partner = await User.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found with this phone number' });
        }

        // 2. Find the group that belongs to partner with this connectionId
        const group = await Group.findOne({
            connectionId: connectionId,
            members: partner._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found or connection ID incorrect' });
        }

        // 3. Add current user if not already added
        if (!group.members.includes(req.user._id.toString())) {
            group.members.push(req.user._id);
            await group.save();
        }

        res.json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get my groups
router.get('/', auth, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user._id });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a group (or leave it)
router.delete('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.id, members: req.user._id });
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // If user is the only member, delete the group
        if (group.members.length === 1) {
            await Group.deleteOne({ _id: req.params.id });
            return res.json({ message: 'Group deleted' });
        }

        // Otherwise, just remove the user from members
        group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
        await group.save();

        res.json({ message: 'Left the group successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
