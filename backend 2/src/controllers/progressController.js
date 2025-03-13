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

// Helper to check if we're in offline mode
const isOfflineMode = () => process.env.OFFLINE_MODE === 'true';

// Helper function to get the next phase
function getNextPhase(currentPhase) {
  const phaseOrder = ['detail', 'concise', 'creative'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  
  if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
    return null; // No next phase
  }
  
  return phaseOrder[currentIndex + 1];
}

/**
 * Get user progress data
 * @route GET /api/progress
 * @access Private
 */
exports.getProgress = async (req, res) => {
  try {
    // Use mock data in offline mode
    if (isOfflineMode()) {
      console.log('Returning mock progress data:', global.mockUserProgress);
      return res.json(global.mockUserProgress);
    }

    const userId = 'test-user'; // Placeholder
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      currentPhase: user.currentPhase,
      phaseProgress: user.phaseProgress,
      onboardingCompleted: user.onboardingCompleted || false
    });
  } catch (error) {
    console.error('Error in getProgress:', error);
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
    
    // Validate inputs
    if (!phase || score === undefined) {
      return res.status(400).json({ msg: 'Please provide both phase and score' });
    }
    
    console.log('Progress update triggered:', { userId, phase, score });
    
    // Check if we're in offline mode
    const isOffline = isOfflineMode();
    
    // Get the next phase (if any)
    const nextPhase = getNextPhase(phase);
    
    let phaseUnlocked = null;
    let updatedProgress;
    
    if (isOffline) {
      // Handle offline mode with mock data
      const progress = global.mockUserProgress;
      
      // Update the phase progress
      if (!progress.phaseProgress[phase]) {
        progress.phaseProgress[phase] = { attempts: 0, bestScore: 0, completed: false, locked: false };
      }
      
      // Increment attempts
      progress.phaseProgress[phase].attempts += 1;
      
      // Update best score if the new score is higher
      if (score > progress.phaseProgress[phase].bestScore) {
        progress.phaseProgress[phase].bestScore = score;
      }
      
      // Check if the phase is completed (score >= 9.0)
      const isCompleted = score >= 9.0;
      progress.phaseProgress[phase].completed = isCompleted;
      
      // If completed and there's a next phase, unlock it
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
      // Handle database mode
      // Find the user's progress
      const progress = await Progress.findOne({ user: userId || req.user.id });
      
      if (!progress) {
        return res.status(404).json({ msg: 'Progress not found' });
      }
      
      // Update the phase progress
      if (!progress.phases[phase]) {
        progress.phases[phase] = { attempts: 0, bestScore: 0, completed: false };
      }
      
      // Increment attempts
      progress.phases[phase].attempts += 1;
      
      // Update best score if the new score is higher
      if (score > progress.phases[phase].bestScore) {
        progress.phases[phase].bestScore = score;
      }
      
      // Check if the phase is completed (score >= 9.0)
      const isCompleted = score >= 9.0;
      progress.phases[phase].completed = isCompleted;
      
      // If completed and there's a next phase, unlock it
      if (isCompleted && nextPhase && progress.phases[nextPhase]?.locked) {
        progress.phases[nextPhase].locked = false;
        phaseUnlocked = nextPhase;
      }
      
      // Save the updated progress
      await progress.save();
      
      updatedProgress = {
        phase,
        attempts: progress.phases[phase].attempts,
        bestScore: progress.phases[phase].bestScore,
        completed: progress.phases[phase].completed,
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
 * Update user progress
 * @route POST /api/progress
 * @access Private
 */
exports.updateProgress = async (req, res) => {
  // Deprecated: Progress updates should occur in evaluatePrompt
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

    // Use mock data in offline mode
    if (isOfflineMode()) {
      // Check if phase is locked in mock data
      if (global.mockUserProgress.phaseProgress[phase].locked) {
        return res.status(403).json({ error: 'Phase is locked' });
      }
      
      // Update mock data
      global.mockUserProgress.currentPhase = phase;
      
      console.log('Changed phase to:', phase);
      return res.json({
        currentPhase: global.mockUserProgress.currentPhase,
        phaseProgress: global.mockUserProgress.phaseProgress
      });
    }

    const userId = 'test-user'; // Placeholder
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
    // Use mock data in offline mode
    if (isOfflineMode()) {
      // Update mock data
      global.mockUserProgress.onboardingCompleted = true;
      
      console.log('Onboarding completed');
      return res.json({
        onboardingCompleted: global.mockUserProgress.onboardingCompleted
      });
    }
    
    const userId = 'test-user'; // Placeholder - in a real app, this would come from req.user.id
    
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