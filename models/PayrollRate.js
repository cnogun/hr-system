const mongoose = require('mongoose');

const payrollRateSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  effectiveFrom: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  basicMonthly: { type: Number, default: 0, min: 0 },
  basicHourly: { type: Number, default: 0, min: 0 },
  overtimeHourly: { type: Number, default: 0, min: 0 },
  specialHourly: { type: Number, default: 0, min: 0 },
  specialOvertimeHourly: { type: Number, default: 0, min: 0 },
  nightHourly: { type: Number, default: 0, min: 0 },
  fixedAllowance: { type: Number, default: 0, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

payrollRateSchema.index({ employee: 1, effectiveFrom: 1 }, { unique: true });

module.exports = mongoose.models.PayrollRate || mongoose.model('PayrollRate', payrollRateSchema);
