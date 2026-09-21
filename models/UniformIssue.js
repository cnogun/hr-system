const mongoose = require('mongoose');

const uniformIssueItemSchema = new mongoose.Schema({
  item: { type: String, required: true, trim: true },
  size: { type: String, default: '', trim: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const uniformIssueSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  issueType: {
    type: String,
    enum: ['신규 지급', '추가 지급', '교환', '반납'],
    default: '신규 지급',
    required: true
  },
  items: {
    type: [uniformIssueItemSchema],
    validate: [items => Array.isArray(items) && items.length > 0, '지급 품목을 한 개 이상 입력하세요.']
  },
  issuedAt: { type: Date, required: true, default: Date.now, index: true },
  note: { type: String, default: '', trim: true, maxlength: 500 },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

uniformIssueSchema.index({ employee: 1, issuedAt: -1 });
uniformIssueSchema.index({ issueType: 1, issuedAt: -1 });

module.exports = mongoose.model('UniformIssue', uniformIssueSchema);
