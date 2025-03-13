const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PromptSchema = new Schema({
  userId: {
    type: String,
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  phase: {
    type: String,
    enum: ['detail', 'concise', 'creative'],
    required: true
  },
  evaluationId: {
    type: Schema.Types.ObjectId,
    ref: 'evaluation'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('prompt', PromptSchema); 