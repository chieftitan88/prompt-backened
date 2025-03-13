const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PhaseSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  key: {
    type: String,
    required: true,
    unique: true,
    enum: ['detail', 'concise', 'creative']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  tips: {
    type: [String],
    required: true
  },
  examples: {
    type: [String],
    required: true
  },
  order: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('phase', PhaseSchema); 