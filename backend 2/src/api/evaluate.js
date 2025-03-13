const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { evaluatePrompt } = require('../services/openai');
const Prompt = require('../models/Prompt');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');

/**
 * @route   POST api/evaluate
 * @desc    Evaluate a prompt using OpenAI
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { prompt, phase } = req.body;
    
    // Validate input
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    if (!phase || !['detail', 'concise', 'creative'].includes(phase)) {
      return res.status(400).json({ error: 'Valid phase is required' });
    }
    
    // Get user ID from auth middleware
    const userId = req.user.id;
    
    // Call OpenAI service to evaluate the prompt
    const evaluation = await evaluatePrompt(prompt, phase);
    
    // Save prompt to database
    const newPrompt = new Prompt({
      user: userId,
      phase,
      text: prompt
    });
    await newPrompt.save();
    
    // Save evaluation to database
    const newEvaluation = new Evaluation({
      prompt: newPrompt._id,
      user: userId,
      phase,
      scores: evaluation.scores,
      overallScore: evaluation.overallScore,
      feedback: evaluation.feedback,
      suggestions: evaluation.suggestions,
    });
    await newEvaluation.save();
    
    // Update prompt with evaluation reference
    await Prompt.findByIdAndUpdate(newPrompt._id, { evaluation: newEvaluation._id });
    
    // Check if user has completed this phase (score >= 9.0)
    if (evaluation.overallScore >= 9.0) {
      const user = await User.findById(userId);
      if (!user.completedPhases.includes(phase)) {
        await User.findByIdAndUpdate(userId, {
          $push: { completedPhases: phase }
        });
      }
    }
    
    // Return the evaluation with the prompt text
    res.json({
      ...evaluation,
      promptText: prompt
    });
  } catch (error) {
    console.error('Error evaluating prompt:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 