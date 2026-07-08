const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all categories for user (or specific group)
router.get('/', auth, async (req, res) => {
    try {
        const { groupId } = req.query;

        let filter = { userId: req.user._id };
        if (groupId && groupId !== 'null') {
            // If requesting specific group categories, only return those
            // OR return both? User asked for "different".
            // "in shared access expense we don't have it instead we will have 'car fix'"
            // imply segregation.
            filter = { groupId: groupId };
        } else {
            // Personal: categories with NO groupId OR categories explicitly for this user
            filter = {
                $or: [
                    { userId: req.user._id, groupId: null },
                    { userId: req.user._id, groupId: { $exists: false } }
                ]
            };
        }

        const categories = await Category.find(filter);
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create category
router.post('/', auth, async (req, res) => {
    try {
        const { groupId, ...data } = req.body;

        const categoryData = {
            ...data,
            userId: req.user._id
        };

        if (groupId) {
            categoryData.groupId = groupId;
            // Optional: Verify user is member of group
        }

        const category = new Category(categoryData);
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

// Delete category
router.delete('/:id', auth, async (req, res) => {
    try {
        const existingCategory = await Category.findById(req.params.id);
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Allow deletion if the user owns it, or if it's a shared group category
        if (existingCategory.userId.toString() !== req.user._id.toString() && !existingCategory.groupId) {
            return res.status(403).json({ error: 'Not authorized to delete this personal category' });
        }

        await Category.findByIdAndDelete(req.params.id);
        
        // Also remove from expenses
        const Expense = require('../models/Expense');
        await Expense.updateMany({ categoryId: req.params.id }, { $unset: { categoryId: 1 } });

        res.json({ message: 'Category deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
