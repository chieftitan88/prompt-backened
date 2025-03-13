const User = require('../models/User');
const Prompt = require('../models/Prompt');
const Evaluation = require('../models/Evaluation');

// Initialize global mock progress data
if (!global.mockUserProgress) {
  global.mockUserProgress = {
    userId: 'test-user',
    currentPhase: 'detail',
    phaseProgress: {
      detail: { bestScore: 0, completed: false, attempts: 0, locked: false },
      concise: { bestScore: 0, completed: false, attempts: 0, locked: true },
      creative: { bestScore: 0, completed: false, attempts: 0, locked: true }
    },
    onboardingCompleted: false
  };
}

// Helper to check offline mode
const isOfflineMode = () => process.env.OFFLINE_MODE === 'true';

// Helper function to get the next phase
function getNextPhase(currentPhase) {
  const phaseOrder = ['detail', 'concise', 'creative'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  return (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) ? phaseOrder[currentIndex + 1] : null;
}

/**
 * Get user progress data
 * @route GET /api/progress
 * @access Private
 */
exports.getProgress = async (req, res) => {
  try {
    if (isOfflineMode()) {
      console.log('Serving mock progress data:', global.mockUserProgress);
      return res.json(global.mockUserProgress);
    }

    const userId = 'test-user'; // Placeholder
    const user = await User.findOne({ userId });
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Serving user progress:', { currentPhase: user.currentPhase });
    res.json({
      currentPhase: user.currentPhase,
      phaseProgress: user.phaseProgress,
      onboardingCompleted: user.onboardingCompleted || false
    });
  } catch (error) {
    console.error('Error in getProgress:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update user progress after evaluation
 * @route POST /api/progress/update-after-evaluation
 * @access Private
 */
exports.updateProgressAfterEvaluation = async (req, res) => {
  try {
    const { phase, score, userId } = req.body;
    if (!phase || score === undefined) {
      return res.status(400).json({ msg: 'Please provide both phase and score' });
    }
    
    console.log('Progress update triggered:', { userId, phase, score });
    const isOffline = isOfflineMode();
    const nextPhase = getNextPhase(phase);
    let phaseUnlocked = null;
    let updatedProgress;

    if (isOffline) {
      const progress = global.mockUserProgress;
      if (!progress.phaseProgress[phase]) {
        progress.phaseProgress[phase] = { attempts: 0, bestScore: 0, completed: false, locked: false };
      }
      
      progress.phaseProgress[phase].attempts += 1;
      if (score > progress.phaseProgress[phase].bestScore) {
        progress.phaseProgress[phase].bestScore = score;
      }
      const isCompleted = score >= 9.0;
      progress.phaseProgress[phase].completed = isCompleted;
      
      if (isCompleted && nextPhase && progress.phaseProgress[nextPhase]?.locked) {
        progress.phaseProgress[nextPhase].locked = false;
        phaseUnlocked = nextPhase;
      }
      
      updatedProgress = {
        phase,
        attempts: progress.phaseProgress[phase].attempts,
        bestScore: progress.phaseProgress[phase].bestScore,
        completed: progress.phaseProgress[phase].completed,
        phaseUnlocked
      };
      console.log('Updated mock progress:', progress);
    } else {
      const progress = await User.findOne({ userId: userId || 'test-user' });
      if (!progress) {
        return res.status(404).json({ msg: 'User not found' });
      }
      
      if (!progress.phaseProgress[phase]) {
        progress.phaseProgress[phase] = { attempts: 0, bestScore: 0, completed: false, locked: false };
      }
      
      progress.phaseProgress[phase].attempts += 1;
      if (score > progress.phaseProgress[phase].bestScore) {
        progress.phaseProgress[phase].bestScore = score;
      }
      const isCompleted = score >= 9.0;
      progress.phaseProgress[phase].completed = isCompleted;
      
      if (isCompleted && nextPhase && progress.phaseProgress[nextPhase]?.locked) {
        progress.phaseProgress[nextPhase].locked = false;
        phaseUnlocked = nextPhase;
      }
      
      await progress.save();
      updatedProgress = {
        phase,
        attempts: progress.phaseProgress[phase].attempts,
        bestScore: progress.phaseProgress[phase].bestScore,
        completed: progress.phaseProgress[phase].completed,
        phaseUnlocked
      };
    }
    
    res.json(updatedProgress);
  } catch (err) {
    console.error('Error updating progress after evaluation:', err.message);
    res.status(500).send('Server Error');
  }
};

/**
 * Update user progress - Deprecated
 * @route POST /api/progress
 * @access Private
 */
exports.updateProgress = async (req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated; use /api/evaluate' });
};

/**
 * Change user's current phase
 * @route POST /api/progress/phase
 * @access Private
 */
exports.changePhase = async (req, res) => {
  try {
    const { phase } = req.body;
    if (!phase || !['detail', 'concise', 'creative'].includes(phase)) {
      return res.status(400).json({ error: 'Valid phase is required' });
    }

    if (isOfflineMode()) {
      if (global.mockUserProgress.phaseProgress[phase].locked) {
        return res.status(403).json({ error: 'Phase is locked' });
      }
      global.mockUserProgress.currentPhase = phase;
      console.log('Changed phase to:', phase);
      return res.json({
        currentPhase: global.mockUserProgress.currentPhase,
        phaseProgress: global.mockUserProgress.phaseProgress
      });
    }

    const userId = 'test-user';
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.phaseProgress[phase].locked) {
      return res.status(403).json({ error: 'Phase is locked' });
    }

    await User.updateOne({ userId }, { currentPhase: phase });
    res.json({
      currentPhase: phase,
      phaseProgress: user.phaseProgress
    });
  } catch (error) {
    console.error('Error in changePhase:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Mark onboarding as completed for the user
 * @route POST /api/progress/onboarding-complete
 * @access Private
 */
exports.completeOnboarding = async (req, res) => {
  try {
    if (isOfflineMode()) {
      global.mockUserProgress.onboardingCompleted = true;
      console.log('Onboarding completed');
      return res.json({
        onboardingCompleted: global.mockUserProgress.onboardingCompleted
      });
    }
    
    const userId = 'test-user';
    const user = await User.findOneAndUpdate(
      { userId },
      { onboardingCompleted: true },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      onboardingCompleted: user.onboardingCompleted
    });
  } catch (error) {
    console.error('Error in completeOnboarding:', error);
    res.status(500).json({ error: 'Server error' });
  }
};