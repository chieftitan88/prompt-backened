const axios = require('axios');
const User = require('../models/User');
const Prompt = require('../models/Prompt');
const Evaluation = require('../models/Evaluation');
const phases = require('../config/phases.json'); // Switch to static JSON
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const VALID_PHASES = ['detail', 'concise', 'creative'];

const validatePrompt = (prompt, phase) => {
  const errors = [];
  console.log('Validating prompt:', { prompt, phase });

  // Basic validation
  if (!prompt || !prompt.trim()) {
    errors.push('Prompt text is required');
    return errors;
  }

  const words = prompt.split(/\s+/).filter(Boolean).length;
  console.log('Word count:', words);

  // Enhanced task-oriented check with expanded verb list
  const taskVerbs = /\b(write|create|explain|describe|generate|make|develop|discuss|list|outline|prepare|design|compose|draft|present)\b/i;
  if (!taskVerbs.test(prompt)) {
    errors.push('Prompt must request a specific action (e.g., write, create, explain)');
  }

  // Phase-specific validation with enhanced edge case handling
  switch (phase) {
    case 'detail':
      console.log('Detail phase validation');
      if (words < 20) {
        errors.push(words === 19 ? 
          'Detail phase requires 20 words (current: 19, add one more word)' :
          `Detail phase requires at least 20 words (current: ${words})`
        );
      }
      if (!/\b(must|should|need to|has to|require)\b/i.test(prompt)) {
        errors.push('Detail phase requires explicit constraints (using words like "must" or "should")');
      }
      if (!/\b(for|audience|users|readers|people|students|professionals)\b/i.test(prompt)) {
        errors.push('Detail phase requires specifying target audience');
      }
      break;

    case 'concise':
      console.log('Concise phase validation');
      if (words > 18) {
        errors.push(words === 19 ?
          'Concise phase requires 18 or fewer words (current: 19, remove one word)' :
          `Concise phase requires 18 words or fewer (current: ${words})`
        );
      }
      const sentences = prompt.split(/[.!?]+/).filter(s => s.trim()).length;
      if (sentences !== 1) {
        errors.push(sentences === 0 ?
          'Prompt must contain exactly one sentence' :
          `Concise phase requires exactly one sentence (current: ${sentences} sentences)`
        );
      }
      break;

    case 'creative':
      console.log('Creative phase validation');
      const creativeWords = /\b(imagine|creative|innovative|unique|original|novel|envision|inspiring|transformative|revolutionary|fresh|inventive|pioneering)\b/i;
      const subtleCreativeWords = /\b(different|new|better|improved|enhanced|advanced|modern|future|tomorrow|beyond|reimagine|rethink)\b/i;
      
      if (!creativeWords.test(prompt) && !subtleCreativeWords.test(prompt)) {
        errors.push('Creative phase requires imaginative elements (using words like "imagine", "innovative", or similar creative terms)');
      } else if (!creativeWords.test(prompt) && subtleCreativeWords.test(prompt)) {
        // This is a warning rather than an error
        console.log('Warning: Subtle creativity detected - consider using more explicit creative terms');
      }
      break;

    default:
      errors.push('Invalid phase specified');
  }

  // Multiple error detection logging
  if (errors.length > 1) {
    console.log('Multiple validation errors detected:', errors.length);
  }

  console.log('Validation errors:', errors);
  return errors;
};

const fallbackEvaluation = {
  criteriaScores: {
    taskClarity: 10,
    subjectSpecificity: 10,
    completeness: 10,
    context: 10
  },
  deductions: [],
  feedback: {
    strengths: [],
    improvements: ["Evaluation failed"],
    suggestions: ["Try again"],
    examples: []
  }
};

const validateEvaluationData = (data) => {
  // Validate structure and types
  if (!data?.criteriaScores || typeof data.criteriaScores !== 'object') return false;
  if (!Array.isArray(data?.deductions)) return false;
  if (!data?.feedback || typeof data.feedback !== 'object') return false;

  // Validate criteria scores
  const requiredScores = ['taskClarity', 'subjectSpecificity', 'completeness', 'context'];
  if (!requiredScores.every(key => 
    typeof data.criteriaScores[key] === 'number' && 
    data.criteriaScores[key] >= 0 && 
    data.criteriaScores[key] <= 25
  )) return false;

  // Validate deductions
  if (!data.deductions.every(d => 
    typeof d.reason === 'string' && 
    typeof d.amount === 'number' && 
    d.amount <= 0
  )) return false;

  // Validate feedback arrays
  const requiredFeedback = ['strengths', 'improvements', 'suggestions', 'examples'];
  if (!requiredFeedback.every(key => 
    Array.isArray(data.feedback[key]) && 
    data.feedback[key].every(item => typeof item === 'string')
  )) return false;

  return true;
};

const callGPT4 = async (systemPrompt, userPrompt) => {
  let retries = 3;
  let lastError = null;

  while (retries > 0) {
    try {
      console.log(`GPT-4 attempt ${4 - retries}/3`);
      console.log('API Key configured:', !!process.env.OPENAI_API_KEY);
      console.log('API Key starts with:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 5) + '...' : 'N/A');
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('OpenAI API response status:', response.status);
      const rawResponse = response.data.choices[0].message.content;
      console.log('GPT-4 raw response:', rawResponse);

      try {
        const evaluationData = JSON.parse(rawResponse);
        if (validateEvaluationData(evaluationData)) {
          return { success: true, data: evaluationData };
        }
        throw new Error('Invalid evaluation data structure');
      } catch (parseError) {
        console.error('Parse error details:', parseError);
        throw new Error(`Failed to parse GPT-4 response: ${parseError.message}`);
      }
    } catch (error) {
      lastError = error;
      console.error('OpenAI API error details:', error.response?.data || error.message);
      retries--;
      if (retries > 0) {
        console.log(`Retrying GPT-4 call, ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between retries
        continue;
      }
      console.error('GPT-4 failed after all retries:', error.message);
      return { success: false, error: lastError.message };
    }
  }
};

// Mock evaluation data for testing different scoring scenarios
const mockEvaluationData = {
  detail: {
    high: {
      criteriaScores: {
        taskClarity: 23,
        subjectSpecificity: 22,
        completeness: 22,
        context: 23
      },
      deductions: [],
      feedback: {
        strengths: [
          "Excellent task clarity with specific action required",
          "Well-defined subject matter with clear scope",
          "Comprehensive requirements specified",
          "Excellent contextual information provided"
        ],
        improvements: [],
        suggestions: [],
        examples: []
      }
    },
    mid: {
      criteriaScores: {
        taskClarity: 18,
        subjectSpecificity: 16,
        completeness: 15,
        context: 16
      },
      deductions: [
        { reason: "Could be more specific about the target audience", amount: -1.0 }
      ],
      feedback: {
        strengths: [
          "Clear action-oriented task",
          "Good focus on subject matter"
        ],
        improvements: [
          "Could specify the target audience more clearly",
          "Consider adding more specific constraints"
        ],
        suggestions: [
          "Add specific mention of the educational level of students",
          "Include requirements for specific sections or elements"
        ],
        examples: [
          "Write a comprehensive guide for first-year college students that must include detailed steps for effective study habits and time management techniques, with at least 3 visual diagrams."
        ]
      }
    },
    low: {
      criteriaScores: {
        taskClarity: 14,
        subjectSpecificity: 12,
        completeness: 10,
        context: 12
      },
      deductions: [
        { reason: "Missing audience specification", amount: -1.5 },
        { reason: "Ambiguous requirements", amount: -1.0 }
      ],
      feedback: {
        strengths: [
          "Includes a clear action verb"
        ],
        improvements: [
          "Specify the target audience clearly",
          "Add explicit constraints",
          "Provide more context about the purpose"
        ],
        suggestions: [
          "Include 'must' or 'should' statements to clarify requirements",
          "Specify who the guide is for (e.g., high school, college, graduate students)"
        ],
        examples: [
          "Write a comprehensive study guide for undergraduate biology students that must include at least 5 effective study techniques, 3 time management strategies, and specific examples for laboratory courses."
        ]
      }
    },
    exactNine: {
      criteriaScores: {
        taskClarity: 23,
        subjectSpecificity: 22,
        completeness: 22,
        context: 23
      },
      deductions: [
        { reason: "Could include more specific constraints", amount: -0.5 }
      ],
      feedback: {
        strengths: [
          "Excellent task clarity with specific action required",
          "Well-defined subject matter with clear scope",
          "Good requirements specified",
          "Excellent contextual information provided"
        ],
        improvements: [
          "Add more specific constraints about format or content"
        ],
        suggestions: [
          "Include specific number of techniques or strategies required"
        ],
        examples: []
      }
    },
    exactSix: {
      criteriaScores: {
        taskClarity: 15,
        subjectSpecificity: 15,
        completeness: 15,
        context: 15
      },
      deductions: [],
      feedback: {
        strengths: [
          "Clear action verb",
          "Basic subject matter defined"
        ],
        improvements: [
          "Add more specific constraints",
          "Clarify the target audience",
          "Provide more context"
        ],
        suggestions: [
          "Specify exactly what elements must be included",
          "Define who the content is for more precisely"
        ],
        examples: [
          "Write a detailed study guide for first-year medical students that must include specific memory techniques, time management strategies, and exam preparation methods with examples for anatomy courses."
        ]
      }
    },
    almostSix: {
      criteriaScores: {
        taskClarity: 15,
        subjectSpecificity: 15,
        completeness: 14,
        context: 15
      },
      deductions: [
        { reason: "Missing specific requirements", amount: -0.5 }
      ],
      feedback: {
        strengths: [
          "Clear action verb",
          "Basic subject matter defined"
        ],
        improvements: [
          "Add more specific constraints",
          "Clarify the target audience",
          "Provide more context"
        ],
        suggestions: [
          "Specify exactly what elements must be included",
          "Define who the content is for more precisely"
        ],
        examples: [
          "Write a detailed study guide for first-year medical students that must include specific memory techniques, time management strategies, and exam preparation methods with examples for anatomy courses."
        ]
      }
    }
  },
  concise: {
    high: {
      criteriaScores: {
        taskClarity: 24,
        subjectSpecificity: 23,
        completeness: 23,
        context: 22
      },
      deductions: [],
      feedback: {
        strengths: [
          "Excellent concise formulation",
          "Clear action with specific subject",
          "Complete request in a single sentence",
          "Good context despite brevity"
        ],
        improvements: [],
        suggestions: [],
        examples: []
      }
    },
    mid: {
      criteriaScores: {
        taskClarity: 18,
        subjectSpecificity: 16,
        completeness: 15,
        context: 16
      },
      deductions: [],
      feedback: {
        strengths: [
          "Good concise formulation",
          "Clear action verb"
        ],
        improvements: [
          "Could be more specific about the subject",
          "Add a bit more context while keeping it concise"
        ],
        suggestions: [
          "Specify the exact type of guide needed",
          "Include a specific audience if possible"
        ],
        examples: [
          "Create a concise study guide for medical students covering key memory techniques."
        ]
      }
    }
  },
  creative: {
    high: {
      criteriaScores: {
        taskClarity: 23,
        subjectSpecificity: 22,
        completeness: 22,
        context: 23
      },
      deductions: [],
      feedback: {
        strengths: [
          "Excellent creative elements",
          "Clear innovative approach",
          "Well-defined creative task",
          "Good context for creative work"
        ],
        improvements: [],
        suggestions: [],
        examples: []
      }
    },
    mid: {
      criteriaScores: {
        taskClarity: 18,
        subjectSpecificity: 16,
        completeness: 15,
        context: 16
      },
      deductions: [
        { reason: "Could include more imaginative elements", amount: -0.5 }
      ],
      feedback: {
        strengths: [
          "Good creative direction",
          "Clear action verb"
        ],
        improvements: [
          "Add more specific creative elements",
          "Include more innovative requirements"
        ],
        suggestions: [
          "Specify what makes this truly innovative",
          "Add requirements for unique or original elements"
        ],
        examples: [
          "Create an innovative study guide that reimagines learning through interactive storytelling, visual metaphors, and personalized memory techniques for different learning styles."
        ]
      }
    }
  }
};

// Helper function to get appropriate mock data based on phase and desired score range
const getMockEvaluationData = (phase, prompt) => {
  // Default to mid-range if we don't have a specific match
  const phaseData = mockEvaluationData[phase] || mockEvaluationData.detail;
  
  // For testing specific score thresholds
  if (prompt.includes('test-score-9.0')) {
    return phaseData.exactNine || phaseData.high;
  } else if (prompt.includes('test-score-6.0')) {
    return phaseData.exactSix || phaseData.mid;
  } else if (prompt.includes('test-score-5.9')) {
    return phaseData.almostSix || phaseData.low;
  } else if (prompt.includes('test-high-score')) {
    return phaseData.high;
  } else if (prompt.includes('test-low-score')) {
    return phaseData.low;
  } else {
    return phaseData.mid;
  }
};

/**
 * Calculate scores based on evaluation data
 * @param {Object} evaluationData - The evaluation data with criteria scores and deductions
 * @param {String} phase - The phase being evaluated
 * @param {String} prompt - The prompt text
 * @returns {Object} The calculated scores and quality tier
 */
const calculateScores = (evaluationData, phase, prompt) => {
  // Calculate total score (0-100)
  const totalScore = Object.values(evaluationData.criteriaScores).reduce((sum, score) => sum + score, 0);
  
  // Apply deductions
  let deductionsSum = evaluationData.deductions.reduce((sum, d) => sum + d.amount, 0);
  
  // Phase-specific adjustments and additional deductions
  const additionalDeductions = [];
  
  // Check for audience specification in detail and creative phases
  if (phase !== 'concise' && !prompt.toLowerCase().includes('for')) {
    additionalDeductions.push({ 
      reason: 'Missing audience specification', 
      amount: -0.5 
    });
  }
  
  // Check for ambiguity in any phase
  if (prompt.toLowerCase().includes('some') || prompt.toLowerCase().includes('various')) {
    additionalDeductions.push({
      reason: 'Ambiguous quantifiers (use specific numbers instead of "some" or "various")',
      amount: -1.0
    });
  }
  
  // Add additional deductions to the evaluation data and sum
  if (additionalDeductions.length > 0) {
    evaluationData.deductions = [...evaluationData.deductions, ...additionalDeductions];
    deductionsSum = evaluationData.deductions.reduce((sum, d) => sum + d.amount, 0);
  }
  
  // Calculate final score (0-10)
  // Formula: (totalScore + deductionsSum) / 10, clamped between 0 and 10
  const finalScore = Math.max(0, Math.min(10, (totalScore + deductionsSum) / 10));
  
  // Round to 1 decimal place for display
  const roundedScore = Math.round(finalScore * 10) / 10;
  
  // Determine quality tier
  // High: ≥9.0, Mid: 6.0-8.9, Low: <6.0
  const qualityTier = roundedScore >= 9.0 ? 'High' : roundedScore >= 6.0 ? 'Mid' : 'Low';
  
  return {
    score: roundedScore,
    qualityPercentage: totalScore,
    qualityTier,
    deductionsSum
  };
};

// Phase-specific evaluation rubrics to guide feedback generation
const evaluationRubrics = {
  detail: {
    taskClarity: {
      high: "Excellent task clarity with specific action required",
      mid: "Clear action-oriented task",
      low: "Basic task definition present"
    },
    subjectSpecificity: {
      high: "Well-defined subject matter with clear scope",
      mid: "Good subject focus",
      low: "Subject matter needs more definition"
    },
    completeness: {
      high: "Comprehensive requirements specified",
      mid: "Adequate requirements included",
      low: "Minimal requirements specified"
    },
    context: {
      high: "Excellent contextual information provided",
      mid: "Sufficient context included",
      low: "Limited context provided"
    },
    improvements: {
      audience: "Specify the target audience more clearly",
      constraints: "Add more explicit constraints (using 'must' or 'should')",
      specificity: "Include specific requirements about content or format",
      examples: "Consider requiring specific examples or case studies"
    },
    suggestions: {
      audience: "Add specific mention of who the content is for (e.g., 'for first-year college students')",
      constraints: "Include specific requirements like 'must include at least 5 techniques'",
      format: "Specify format requirements such as 'with visual diagrams'"
    }
  },
  concise: {
    taskClarity: {
      high: "Excellent concise task definition",
      mid: "Clear action verb in concise format",
      low: "Basic task present but could be clearer"
    },
    subjectSpecificity: {
      high: "Precise subject focus despite brevity",
      mid: "Subject is defined within word limit",
      low: "Subject needs more specificity while maintaining brevity"
    },
    completeness: {
      high: "Complete request in a single sentence",
      mid: "Adequate information in concise format",
      low: "Missing key elements while staying concise"
    },
    context: {
      high: "Excellent context despite word constraints",
      mid: "Sufficient context for brevity",
      low: "Minimal context provided"
    },
    improvements: {
      wordCount: "Ensure the prompt stays under 18 words",
      singleSentence: "Format as a single, clear sentence",
      precision: "Use more precise language to convey requirements concisely"
    },
    suggestions: {
      precision: "Replace general terms with specific ones",
      audience: "Include audience briefly (e.g., 'for students')",
      focus: "Focus on a single, clear deliverable"
    }
  },
  creative: {
    taskClarity: {
      high: "Excellent creative task definition",
      mid: "Clear creative direction provided",
      low: "Basic creative elements present"
    },
    subjectSpecificity: {
      high: "Well-defined creative subject matter",
      mid: "Creative subject is adequately specified",
      low: "Creative subject needs more definition"
    },
    completeness: {
      high: "Comprehensive creative requirements",
      mid: "Adequate creative elements included",
      low: "Minimal creative specifications"
    },
    context: {
      high: "Excellent context for creative work",
      mid: "Sufficient creative context provided",
      low: "Limited creative context"
    },
    improvements: {
      innovation: "Include more specific innovative elements",
      imagination: "Add more imaginative requirements",
      originality: "Emphasize originality in the prompt"
    },
    suggestions: {
      creativity: "Use more explicit creative terms (e.g., 'reimagine', 'transform')",
      innovation: "Specify what makes this truly innovative",
      uniqueness: "Add requirements for unique or original elements"
    }
  }
};

// Example templates for different score ranges
const exampleTemplates = {
  detail: {
    high: "Write a comprehensive guide for first-year medical students that must include at least 5 evidence-based study techniques, 3 time management strategies, and visual diagrams for complex concepts.",
    mid: "Write a detailed study guide for college students that must include effective study habits and time management techniques.",
    low: "Write a guide about studying."
  },
  concise: {
    high: "Create a focused study guide covering essential memory techniques for medical students.",
    mid: "Write a concise guide for effective studying.",
    low: "Make a study guide."
  },
  creative: {
    high: "Create an innovative learning framework that reimagines traditional study methods through interactive storytelling and personalized memory techniques.",
    mid: "Design a creative study approach using new learning techniques.",
    low: "Make a different kind of study guide."
  }
};

/**
 * Generate phase-specific feedback based on evaluation data and scores
 * @param {Object} evaluationData - The evaluation data with criteria scores and deductions
 * @param {Number} finalScore - The calculated final score (0-10)
 * @param {String} phase - The phase being evaluated
 * @param {String} prompt - The original prompt text
 * @returns {Object} Enhanced feedback object
 */
const generateEnhancedFeedback = (evaluationData, finalScore, phase, prompt) => {
  const rubric = evaluationRubrics[phase] || evaluationRubrics.detail;
  const baseScores = evaluationData.criteriaScores;
  const baseDeductions = evaluationData.deductions;
  const baseFeedback = evaluationData.feedback;
  
  // Determine score level for each criterion
  const getScoreLevel = (score) => {
    if (score >= 20) return 'high';
    if (score >= 15) return 'mid';
    return 'low';
  };
  
  // Generate strengths based on criteria scores
  const strengths = [];
  if (baseScores.taskClarity >= 15) {
    strengths.push(rubric.taskClarity[getScoreLevel(baseScores.taskClarity)]);
  }
  if (baseScores.subjectSpecificity >= 15) {
    strengths.push(rubric.subjectSpecificity[getScoreLevel(baseScores.subjectSpecificity)]);
  }
  if (baseScores.completeness >= 15) {
    strengths.push(rubric.completeness[getScoreLevel(baseScores.completeness)]);
  }
  if (baseScores.context >= 15) {
    strengths.push(rubric.context[getScoreLevel(baseScores.context)]);
  }
  
  // Generate improvements based on low scores and deductions
  const improvements = [];
  if (baseScores.taskClarity < 15) {
    improvements.push("Improve task clarity with a specific action verb");
  }
  if (baseScores.subjectSpecificity < 15) {
    improvements.push("Define the subject matter more clearly");
  }
  if (baseScores.completeness < 15) {
    improvements.push("Include more comprehensive requirements");
  }
  if (baseScores.context < 15) {
    improvements.push("Provide more contextual information");
  }
  
  // Add phase-specific improvements
  if (phase === 'detail') {
    if (!prompt.toLowerCase().includes('must') && !prompt.toLowerCase().includes('should')) {
      improvements.push(rubric.improvements.constraints);
    }
    if (!prompt.toLowerCase().includes('for')) {
      improvements.push(rubric.improvements.audience);
    }
  } else if (phase === 'concise') {
    const wordCount = prompt.split(/\s+/).filter(Boolean).length;
    if (wordCount > 15) {
      improvements.push(rubric.improvements.wordCount);
    }
  } else if (phase === 'creative') {
    const creativeWords = /\b(imagine|creative|innovative|unique|original|novel|envision|inspiring|transformative|revolutionary|fresh|inventive|pioneering)\b/i;
    if (!creativeWords.test(prompt)) {
      improvements.push(rubric.improvements.innovation);
    }
  }
  
  // Add deduction-based improvements
  baseDeductions.forEach(deduction => {
    if (deduction.reason.toLowerCase().includes('audience')) {
      if (!improvements.includes(rubric.improvements.audience)) {
        improvements.push(rubric.improvements.audience);
      }
    } else if (deduction.reason.toLowerCase().includes('ambiguous')) {
      improvements.push("Replace ambiguous terms like 'some' or 'various' with specific numbers");
    } else if (deduction.reason.toLowerCase().includes('constraints')) {
      if (!improvements.includes(rubric.improvements.constraints)) {
        improvements.push(rubric.improvements.constraints);
      }
    }
  });
  
  // Generate suggestions based on improvements
  const suggestions = [];
  if (improvements.some(imp => imp.includes('audience'))) {
    suggestions.push(rubric.suggestions.audience);
  }
  if (improvements.some(imp => imp.includes('constraints'))) {
    suggestions.push(rubric.suggestions.constraints);
  }
  if (phase === 'creative' && improvements.some(imp => imp.includes('innovative'))) {
    suggestions.push(rubric.suggestions.creativity);
    suggestions.push(rubric.suggestions.innovation);
  }
  if (phase === 'concise' && improvements.some(imp => imp.includes('word'))) {
    suggestions.push(rubric.suggestions.precision);
  }
  
  // Generate examples for scores below 8.0
  const examples = [];
  if (finalScore < 8.0) {
    // Get the appropriate example template based on score
    let templateLevel = 'mid';
    if (finalScore < 6.0) templateLevel = 'low';
    
    const beforeExample = prompt;
    const afterExample = exampleTemplates[phase][templateLevel];
    
    examples.push(`Before: "${beforeExample}"`);
    examples.push(`After: "${afterExample}"`);
  }
  
  // Combine with base feedback, prioritizing generated feedback
  return {
    strengths: [...new Set([...strengths, ...baseFeedback.strengths])].slice(0, 4),
    improvements: [...new Set([...improvements, ...baseFeedback.improvements])].slice(0, 4),
    suggestions: [...new Set([...suggestions, ...baseFeedback.suggestions])].slice(0, 3),
    examples: examples.length > 0 ? examples : baseFeedback.examples
  };
};

/**
 * Evaluate a prompt using OpenAI and save results
 * @route POST /api/evaluate
 * @access Private
 */
exports.evaluatePrompt = async (req, res) => {
  try {
    console.log('Received evaluation request:', req.body);
    const { prompt, phase } = req.body;

    if (!prompt || !phase) {
      console.error('Missing required fields:', { prompt: !!prompt, phase: !!phase });
      return res.status(400).json({ error: 'Missing required fields: prompt and phase' });
    }

    if (!VALID_PHASES.includes(phase.toLowerCase())) {
      console.error('Invalid phase:', phase);
      return res.status(400).json({ error: 'Invalid phase. Must be one of: detail, concise, creative' });
    }

    // Validate prompt
    const validationErrors = validatePrompt(prompt, phase);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors
      });
    }

    console.log('Using mock evaluation data for testing');
    // Get appropriate mock data based on phase and prompt content
    const evaluationData = getMockEvaluationData(phase, prompt);
    
    // Calculate scores
    const { score, qualityPercentage, qualityTier, deductionsSum } = calculateScores(evaluationData, phase, prompt);
    
    // Generate enhanced feedback
    const enhancedFeedback = generateEnhancedFeedback(evaluationData, score, phase, prompt);
    
    // Log scoring and feedback details for debugging
    console.log('Scoring details:', {
      phase,
      totalScore: qualityPercentage,
      deductionsSum,
      finalScore: score,
      qualityTier
    });
    
    console.log('Feedback details:', {
      strengths: enhancedFeedback.strengths.length,
      improvements: enhancedFeedback.improvements.length,
      suggestions: enhancedFeedback.suggestions.length,
      examples: enhancedFeedback.examples.length
    });

    // Prepare evaluation response
    const evaluation = {
      score,
      qualityPercentage,
      qualityTier,
      criteriaScores: evaluationData.criteriaScores,
      deductions: evaluationData.deductions,
      feedback: enhancedFeedback,
      phase,
      usedMock: true
    };

    // Update progress after evaluation
    try {
      console.log('Triggering progress update after evaluation:', { phase, score });
      const userId = req.user ? req.user.id : null; // Pass null for offline mode
      
      const progressResponse = await axios.post(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/progress/update-after-evaluation`, {
        phase,
        score,
        userId
      });
      
      console.log('Progress updated successfully after evaluation:', progressResponse.data);
      
      // Check if a new phase was unlocked
      if (progressResponse.data.phaseUnlocked) {
        console.log(`New phase unlocked: ${progressResponse.data.phaseUnlocked}`);
      }
    } catch (progressError) {
      console.error('Error updating progress:', progressError.message);
      // Continue with the response even if progress update fails
    }

    res.json(evaluation);
  } catch (error) {
    console.error('Error in evaluatePrompt:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate prompt',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get evaluation history for a user
 * @route GET /api/evaluate/history
 * @access Private
 */
exports.getEvaluationHistory = async (req, res) => {
  try {
    const userId = 'test-user'; // Placeholder
    const evaluations = await Evaluation.find({ userId }).sort({ evaluatedAt: -1 });
    res.json(evaluations);
  } catch (error) {
    console.error('Error getting evaluation history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get a specific evaluation by ID
 * @route GET /api/evaluate/:id
 * @access Private
 */
exports.getEvaluationById = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = 'test-user'; // Placeholder
    const evaluation = await Evaluation.findOne({ _id: evaluationId, userId });
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    res.json(evaluation);
  } catch (error) {
    console.error('Error getting evaluation:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 