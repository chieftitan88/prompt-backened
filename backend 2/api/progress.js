const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Prompt = require('../models/Prompt');
const Evaluation = require('../models/Evaluation');

/**
 * @route   GET api/progress
 * @desc    Get user progress data
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get all user prompts with evaluations
    const prompts = await Prompt.find({ user: userId })
      .populate('evaluation')
      .sort({ date: -1 });
    
    // Calculate phase-specific progress
    const phases = {
      detail: { completed: false, highestScore: 0, attempts: 0 },
      concise: { completed: false, highestScore: 0, attempts: 0 },
      creative: { completed: false, highestScore: 0, attempts: 0 }
    };
    
    // Process prompts to calculate progress
    const promptsData = prompts.map(prompt => {
      const phase = prompt.phase;
      const score = prompt.evaluation ? prompt.evaluation.overallScore : 0;
      
      // Update phase data
      if (phases[phase]) {
        phases[phase].attempts++;
        phases[phase].highestScore = Math.max(phases[phase].highestScore, score);
        phases[phase].completed = user.completedPhases.includes(phase);
      }
      
      return {
        id: prompt._id,
        phase: prompt.phase,
        text: prompt.text,
        date: prompt.date,
        score: score
      };
    });
    
    // Return progress data
    res.json({
      currentPhase: user.currentPhase,
      completedPhases: user.completedPhases,
      phases,
      prompts: promptsData
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST api/progress/phase
 * @desc    Update user's current phase
 * @access  Private
 */
router.post('/phase', auth, async (req, res) => {
  try {
    const { phase } = req.body;
    
    // Validate phase
    if (!phase || !['detail', 'concise', 'creative'].includes(phase)) {
      return res.status(400).json({ error: 'Valid phase is required' });
    }
    
    const userId = req.user.id;
    
    // Update user's current phase
    const user = await User.findByIdAndUpdate(
      userId,
      { currentPhase: phase },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      currentPhase: user.currentPhase,
      completedPhases: user.completedPhases
    });
  } catch (error) {
    console.error('Error updating phase:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 