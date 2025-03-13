const axios = require('axios');
const config = require('config');
const openaiApiKey = config.get('openaiApiKey');

/**
 * Evaluates a prompt using OpenAI's GPT model
 * @param {string} promptText - The prompt text to evaluate
 * @param {string} phase - The phase of the prompt (detail, concise, creative)
 * @returns {Object} Evaluation results
 */
const evaluatePrompt = async (promptText, phase) => {
  try {
    // Validation
    if (!promptText || !phase) {
      throw new Error('Prompt text and phase are required');
    }
    
    // Configure OpenAI API request
    const openaiConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      }
    };
    
    // Create evaluation criteria based on phase
    let evaluationCriteria;
    
    switch (phase) {
      case 'detail':
        evaluationCriteria = `
          1. Specificity (0-10): How specific and detailed is the prompt?
          2. Clarity (0-10): How clear and unambiguous are the instructions?
          3. Context (0-10): Does the prompt provide sufficient context?
          4. Structure (0-10): Is the prompt well-structured and organized?
          5. Completeness (0-10): Does the prompt cover all necessary aspects?
        `;
        break;
      case 'concise':
        evaluationCriteria = `
          1. Brevity (0-10): How concise is the prompt without losing meaning?
          2. Precision (0-10): How precise and focused is the language?
          3. Efficiency (0-10): Does the prompt communicate efficiently?
          4. Clarity (0-10): Despite brevity, is the prompt still clear?
          5. Essentials (0-10): Does the prompt include all essential information?
        `;
        break;
      case 'creative':
        evaluationCriteria = `
          1. Originality (0-10): How original and unique is the prompt approach?
          2. Engagement (0-10): How engaging and interesting is the prompt?
          3. Perspective (0-10): Does it offer a novel perspective or framing?
          4. Imagination (0-10): Does it encourage imaginative responses?
          5. Balance (0-10): Does it balance creativity with clarity?
        `;
        break;
      default:
        throw new Error('Invalid phase specified');
    }
    
    // Construct the system message for evaluation
    const systemMessage = `
      You are an expert prompt engineer evaluator. Evaluate the following prompt for the "${phase}" phase based on these criteria:
      
      ${evaluationCriteria}
      
      For each criterion, provide:
      1. A score (0-10)
      2. A brief explanation for the score
      3. A specific suggestion for improvement
      
      Then provide an overall score (0-50) and a summary of strengths and weaknesses.
      
      Format your response as a JSON object with the following structure:
      {
        "criteria": [
          {
            "name": "criterion name",
            "score": score,
            "explanation": "explanation",
            "suggestion": "suggestion"
          },
          ...
        ],
        "overallScore": overall score,
        "summary": {
          "strengths": ["strength1", "strength2", ...],
          "weaknesses": ["weakness1", "weakness2", ...],
          "improvement": "overall improvement suggestion"
        }
      }
    `;
    
    // Make request to OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: promptText }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      },
      openaiConfig
    );
    
    // Parse the response
    const content = response.data.choices[0].message.content;
    const evaluationResult = JSON.parse(content);
    
    return {
      ...evaluationResult,
      phase,
      promptText
    };
  } catch (error) {
    console.error('OpenAI evaluation error:', error);
    throw new Error(`Failed to evaluate prompt: ${error.message}`);
  }
};

module.exports = {
  evaluatePrompt
}; 