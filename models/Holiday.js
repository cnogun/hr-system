const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  isWeekday: {
    type: Boolean,
    required: true
  },
  specialWorkType: {
    type: String,
    enum: ['평일특근', '다음날특근'],
    default: '평일특근'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema);
