const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeductionSchema = new Schema({
  reason: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
});

const FeedbackSchema = new Schema({
  strengths: {
    type: [String],
    required: true
  },
  improvements: {
    type: [String],
    required: true
  },
  suggestions: {
    type: [String],
    required: true
  },
  examples: {
    type: [String],
    default: []
  }
});

const EvaluationSchema = new Schema({
  userId: {
    type: String,
    required: true
  },
  promptId: {
    type: Schema.Types.ObjectId,
    ref: 'prompt',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  qualityPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  qualityTier: {
    type: String,
    enum: ['Low', 'Mid', 'High'],
    required: true
  },
  criteriaScores: {
    taskClarity: {
      type: Number,
      required: true,
      min: 0,
      max: 25
    },
    subjectSpecificity: {
      type: Number,
      required: true,
      min: 0,
      max: 25
    },
    completeness: {
      type: Number,
      required: true,
      min: 0,
      max: 25
    },
    context: {
      type: Number,
      required: true,
      min: 0,
      max: 25
    }
  },
  deductions: {
    type: [DeductionSchema],
    default: []
  },
  feedback: {
    type: FeedbackSchema,
    required: true
  },
  phase: {
    type: String,
    enum: ['detail', 'concise', 'creative'],
    required: true
  },
  evaluatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('evaluation', EvaluationSchema); 