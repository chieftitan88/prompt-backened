const express = require('express');
const router = express.Router();
const evaluateController = require('../controllers/evaluateController');
const progressController = require('../controllers/progressController');
const phasesController = require('../controllers/phasesController');

// Evaluation routes
router.post('/evaluate', evaluateController.evaluatePrompt);
router.get('/evaluate/history', evaluateController.getEvaluationHistory);
router.get('/evaluate/:id', evaluateController.getEvaluationById);

// Progress routes
router.get('/progress', progressController.getProgress);
router.post('/progress', progressController.updateProgress);
router.post('/progress/phase', progressController.changePhase);
router.post('/progress/onboarding-complete', progressController.completeOnboarding);
router.post('/progress/update-after-evaluation', progressController.updateProgressAfterEvaluation);

// Phases routes
router.get('/phases', phasesController.getPhases);
router.get('/phases/:name', phasesController.getPhaseByName);

module.exports = router; 