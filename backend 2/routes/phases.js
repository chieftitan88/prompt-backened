const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const phasesController = require('../controllers/phasesController');
const Phase = require('../models/Phase');

/**
 * @route   GET api/phases
 * @desc    Get all phases
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const phases = await Phase.find().sort({ order: 1 });
    res.json(phases);
  } catch (error) {
    console.error('Error getting phases:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET api/phases/:id
 * @desc    Get phase by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const phase = await Phase.findById(req.params.id);
    
    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    res.json(phase);
  } catch (error) {
    console.error('Error getting phase:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/phases/:name
// @desc    Get phase by name
// @access  Public
router.get('/:name', phasesController.getPhaseByName);

// @route   POST api/phases/seed
// @desc    Seed phases data (admin only)
// @access  Private
router.post('/seed', auth, phasesController.seedPhases);

module.exports = router; 