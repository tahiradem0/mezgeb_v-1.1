const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Budget = require('../models/Budget');

// Get budgets for the current user contexts (personal + all groups they belong to)
router.get('/', auth, async (req, res) => {
    try {
        const { groupId } = req.query;
        let query = {};
        
        if (groupId) {
            query.groupId = groupId;
        } else {
            // Null explicitly means personal budget
            query.groupId = null;
        }

        // We only enforce 1 budget per context, but find() returns an array.
        // The frontend will take the first one or we handle it in upsert logic.
        const budgets = await Budget.find(query).populate('createdBy', 'username').populate('updatedBy', 'username');
        res.json(budgets);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Upsert a budget (Create or Update the single budget for the context)
router.post('/', auth, async (req, res) => {
    try {
        const { amount, period, groupId } = req.body;
        
        const filter = { groupId: groupId || null };
        const update = {
            amount,
            period,
            updatedBy: req.user.id,
            updatedAt: Date.now()
        };
        
        // If the document doesn't exist, these fields will be added on creation
        const options = {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        };

        const budget = await Budget.findOneAndUpdate(filter, update, options);
        
        // If it's a newly created document, it won't have createdBy set by findOneAndUpdate easily unless we do this:
        if (!budget.createdBy) {
            budget.createdBy = req.user.id;
            await budget.save();
        }

        const populatedBudget = await Budget.findById(budget._id)
            .populate('createdBy', 'username')
            .populate('updatedBy', 'username');
            
        res.json(populatedBudget);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Delete a budget
router.delete('/:id', auth, async (req, res) => {
    try {
        const budget = await Budget.findById(req.params.id);
        if (!budget) return res.status(404).json({ msg: 'Budget not found' });

        await budget.remove();
        res.json({ msg: 'Budget removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
