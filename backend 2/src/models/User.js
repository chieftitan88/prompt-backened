const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PhaseProgressSchema = new Schema({
  locked: {
    type: Boolean,
    default: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  bestScore: {
    type: Number,
    default: 0
  }
});

const UserSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
  },
  email: {
    type: String
  },
  password: {
    type: String
  },
  avatar: {
    type: String
  },
  currentPhase: {
    type: String,
    enum: ['detail', 'concise', 'creative'],
    default: 'detail'
  },
  phaseProgress: {
    detail: {
      type: PhaseProgressSchema,
      default: { locked: false } // First phase is unlocked by default
    },
    concise: {
      type: PhaseProgressSchema,
      default: {}
    },
    creative: {
      type: PhaseProgressSchema,
      default: {}
    }
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('user', UserSchema); 