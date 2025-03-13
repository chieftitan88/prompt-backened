const phases = require('../config/phases.json');

/**
 * Get all phases
 * @route GET /api/phases
 * @access Public
 */
exports.getPhases = (req, res) => {
  try {
    res.json(phases);
  } catch (error) {
    console.error('Error in getPhases:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get phase by name
 * @route GET /api/phases/:name
 * @access Public
 */
exports.getPhaseByName = (req, res) => {
  try {
    const { name } = req.params;
    const phase = phases[name.toLowerCase()];
    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    res.json(phase);
  } catch (error) {
    console.error('Error in getPhaseByName:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create initial phases (for seeding the database)
 * @route POST /api/phases/seed
 * @access Private/Admin
 */
exports.seedPhases = async (req, res) => {
  try {
    // Check if phases already exist
    const phasesCount = await Phase.countDocuments();
    if (phasesCount > 0) {
      return res.status(400).json({ error: 'Phases already exist' });
    }
    
    // Create phases
    const phases = [
      {
        name: 'detail',
        displayName: 'Detail Phase',
        description: 'Learn to create comprehensive, specific prompts that leave little room for misinterpretation.',
        objectives: [
          'Clearly define the task and desired outcome',
          'Specify the subject matter in detail',
          'Include all necessary parameters and constraints',
          'Provide relevant context and background information'
        ],
        evaluationCriteria: [
          {
            name: 'Task Clarity',
            description: 'How clearly the prompt communicates what needs to be done',
            weight: 0.3
          },
          {
            name: 'Subject Specificity',
            description: 'How well the prompt defines the subject matter',
            weight: 0.25
          },
          {
            name: 'Completeness',
            description: 'How thoroughly the prompt covers all necessary aspects',
            weight: 0.25
          },
          {
            name: 'Context',
            description: 'How well the prompt provides relevant background information',
            weight: 0.2
          }
        ],
        examples: [
          {
            prompt: 'Create a comprehensive guide for first-time homebuyers in the United States in 2023. Include sections on mortgage pre-approval, down payment options, the house hunting process, making an offer, home inspections, closing costs, and post-purchase considerations. For each section, provide practical advice, potential pitfalls to avoid, and 2-3 actionable tips. The guide should be informative yet accessible to readers with no prior knowledge of real estate transactions. Format the guide with clear headings, bullet points where appropriate, and a summary of key points at the end.',
            score: 9.5,
            feedback: 'Excellent detailed prompt with clear structure and requirements.'
          }
        ],
        tips: [
          'Start by clearly stating the main task or question',
          'Specify any constraints or requirements',
          'Include relevant context and background information',
          'Define the format or structure you want the response to follow',
          'Be specific about the subject matter'
        ],
        order: 1,
        unlockRequirement: 9.0
      },
      {
        name: 'concise',
        displayName: 'Concise Phase',
        description: 'Master the art of brevity while maintaining clarity and effectiveness.',
        objectives: [
          'Communicate the essential requirements with minimal words',
          'Eliminate unnecessary details while preserving clarity',
          'Use precise language and avoid redundancy',
          'Maintain effectiveness despite brevity'
        ],
        evaluationCriteria: [
          {
            name: 'Task Clarity',
            description: 'How clearly the prompt communicates what needs to be done',
            weight: 0.3
          },
          {
            name: 'Subject Specificity',
            description: 'How well the prompt defines the subject matter',
            weight: 0.25
          },
          {
            name: 'Completeness',
            description: 'How thoroughly the prompt covers all necessary aspects',
            weight: 0.25
          },
          {
            name: 'Context',
            description: 'How well the prompt provides relevant background information',
            weight: 0.2
          }
        ],
        examples: [
          {
            prompt: 'Create a first-time homebuyer\'s guide for the US (2023). Cover: mortgage pre-approval, down payments, house hunting, offers, inspections, closing costs, and post-purchase tips. Include advice, pitfalls, and actionable tips for each section. Use clear headings and bullet points. End with a key points summary.',
            score: 9.2,
            feedback: 'Excellent concise prompt that maintains all essential information.'
          }
        ],
        tips: [
          'Use precise, specific language',
          'Eliminate unnecessary words and phrases',
          'Focus on the most important requirements',
          'Use bullet points for multiple requirements',
          'Avoid redundancy and repetition'
        ],
        order: 2,
        unlockRequirement: 9.0
      },
      {
        name: 'creative',
        displayName: 'Creative Phase',
        description: 'Develop prompts that encourage innovative and unique responses while maintaining direction.',
        objectives: [
          'Encourage innovative and unique responses',
          'Balance constraints with freedom for exploration',
          'Inspire the AI to approach topics from unusual angles',
          'Maintain direction while allowing for creative expression'
        ],
        evaluationCriteria: [
          {
            name: 'Task Clarity',
            description: 'How clearly the prompt communicates what needs to be done',
            weight: 0.3
          },
          {
            name: 'Subject Specificity',
            description: 'How well the prompt defines the subject matter',
            weight: 0.25
          },
          {
            name: 'Completeness',
            description: 'How thoroughly the prompt covers all necessary aspects',
            weight: 0.25
          },
          {
            name: 'Context',
            description: 'How well the prompt provides relevant background information',
            weight: 0.2
          }
        ],
        examples: [
          {
            prompt: 'Imagine you\'re a time-traveling real estate agent from 2050 creating a guide for first-time homebuyers in 2023. With your future perspective, highlight the most crucial aspects of the home buying process that people often overlook. Include sections on mortgage options, property selection, negotiation tactics, and long-term considerations. Balance practical advice with forward-thinking insights, and incorporate unexpected analogies to make complex concepts accessible. Format as a conversational guide with a touch of humor.',
            score: 9.7,
            feedback: 'Excellent creative prompt that encourages innovation while maintaining clear direction.'
          }
        ],
        tips: [
          'Use unusual perspectives or scenarios',
          'Encourage exploration while providing clear boundaries',
          'Ask for unexpected connections or analogies',
          'Specify a unique tone or style',
          'Balance creative freedom with specific requirements'
        ],
        order: 3,
        unlockRequirement: 9.0
      }
    ];
    
    await Phase.insertMany(phases);
    
    res.json({ message: 'Phases seeded successfully', phases });
  } catch (err) {
    console.error('Error in seedPhases:', err);
    res.status(500).json({ error: 'Server error' });
  }
}; 