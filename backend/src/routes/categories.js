const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all categories for user
router.get('/', auth, async (req, res) => {
    try {
        const categories = await Category.find({ userId: req.user._id });
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create category
router.post('/', auth, async (req, res) => {
    try {
        const category = new Category({
            ...req.body,
            userId: req.user._id
        });
        await category.save();
        res.status(201).json(category);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Update category
router.patch('/:id', auth, async (req, res) => {
    try {
        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );
        if (!category) return res.status(404).json();
        res.json(category);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
