const express = require('express');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const router = express.Router();

const Group = require('../models/Group');

// Get expenses with filters (Supports Personal & Shared)
router.get('/', auth, async (req, res) => {
    try {
        const { search, dateFrom, dateTo, amountMin, amountMax, categoryId, groupId } = req.query;
        let query = {};

        // Shared vs Personal Context
        if (groupId && groupId !== 'undefined' && groupId !== 'null') {
            // Verify group membership
            const group = await Group.findOne({ _id: groupId, members: req.user._id });
            if (!group) return res.status(403).json({ error: 'Access denied to this group' });

            query.groupId = groupId;
        } else {
            // Personal expenses only (groupId null or not set)
            query.userId = req.user._id;
            query.groupId = null;
        }

        if (search) {
            query.reason = { $regex: search, $options: 'i' };
        }
        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = new Date(dateFrom);
            if (dateTo) query.date.$lte = new Date(dateTo);
        }
        if (amountMin || amountMax) {
            query.amount = {};
            if (amountMin) query.amount.$gte = parseFloat(amountMin);
            if (amountMax) query.amount.$lte = parseFloat(amountMax);
        }
        if (categoryId) {
            query.categoryId = categoryId;
        }

        const expenses = await Expense.find(query)
            .select('-receiptUrl') // Exclude heavy image data
            .sort({ date: -1 })
            .populate('categoryId')
            .populate('userId', 'username');
        res.json(expenses);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create expense
router.post('/', auth, async (req, res) => {
    try {
        const expenseData = {
            ...req.body,
            userId: req.user._id
        };

        // If adding to a group, verify membership
        if (req.body.groupId) {
            const group = await Group.findOne({ _id: req.body.groupId, members: req.user._id });
            if (!group) return res.status(403).json({ error: 'Access denied to this group' });
            expenseData.groupId = req.body.groupId;
        }

        const expense = new Expense(expenseData);
        await expense.save();

        // Populate user info for immediate frontend update in shared view
        await expense.populate('userId', 'username');

        const io = req.app.get('io');
        if (io && expense.groupId) {
            io.to(expense.groupId.toString()).emit('expenseUpdated');
        }

        res.status(201).json(expense);
    } catch (e) {
        console.error('Create Expense Error:', e);
        res.status(400).json({ error: e.message });
    }
});

// Get expense receipt
router.get('/:id/receipt', auth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id).select('receiptUrl groupId userId');
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        // Verify access (Personal or Shared Group)
        if (expense.groupId) {
            const group = await Group.findOne({ _id: expense.groupId, members: req.user._id });
            if (!group) return res.status(403).json({ error: 'Access denied' });
        } else if (expense.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ receiptUrl: expense.receiptUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update expense
router.patch('/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json();

        let hasPermission = expense.userId.toString() === req.user._id.toString();
        if (!hasPermission && expense.groupId) {
            const group = await Group.findOne({ _id: expense.groupId, members: req.user._id });
            if (group) hasPermission = true;
        }

        if (!hasPermission) return res.status(403).json({ error: 'Permission denied' });

        const updatedExpense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('userId', 'username');
        
        const io = req.app.get('io');
        if (io && updatedExpense.groupId) {
            io.to(updatedExpense.groupId.toString()).emit('expenseUpdated');
        }

        res.json(updatedExpense);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json();

        let hasPermission = expense.userId.toString() === req.user._id.toString();
        if (!hasPermission && expense.groupId) {
            const group = await Group.findOne({ _id: expense.groupId, members: req.user._id });
            if (group) hasPermission = true;
        }

        if (!hasPermission) return res.status(403).json({ error: 'Permission denied' });

        await Expense.findByIdAndDelete(req.params.id);
        
        const io = req.app.get('io');
        if (io && expense.groupId) {
            io.to(expense.groupId.toString()).emit('expenseUpdated');
        }

        res.json(expense);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
