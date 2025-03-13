const express = require('express');
const router = express.Router();
const { evaluatePrompt, getEvaluationHistory, getEvaluationById } = require('../controllers/evaluateController');

/**
 * @route   POST api/evaluate
 * @desc    Evaluate a prompt using OpenAI
 * @access  Public (for now)
 */
router.post('/', evaluatePrompt);

/**
 * @route   GET api/evaluate/history
 * @desc    Get user's evaluation history
 * @access  Public (for now)
 */
router.get('/history', getEvaluationHistory);

/**
 * @route   GET api/evaluate/:id
 * @desc    Get a specific evaluation by ID
 * @access  Public (for now)
 */
router.get('/:id', getEvaluationById);

module.exports = router; 