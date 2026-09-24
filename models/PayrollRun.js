const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  name: String, empNo: String, department: String,
  hours: { basic: Number, overtime: Number, special: Number, specialOvertime: Number, night: Number },
  rates: { basicMonthly: Number, basicHourly: Number, overtimeHourly: Number, specialHourly: Number, specialOvertimeHourly: Number, nightHourly: Number, fixedAllowance: Number },
  attendanceCount: Number,
  basePay: Number, overtimePay: Number, specialPay: Number, specialOvertimePay: Number, nightPay: Number,
  extraPay: { type: Number, default: 0 },
  extraDeduction: { type: Number, default: 0 },
  incomeTax: { type: Number, default: 0 },
  localTax: { type: Number, default: 0 },
  pension: { type: Number, default: 0 },
  health: { type: Number, default: 0 },
  longTermCare: { type: Number, default: 0 },
  employmentInsurance: { type: Number, default: 0 },
  deductionsReviewed: { type: Boolean, default: false },
  note: { type: String, default: '', maxlength: 300 },
  gross: Number, deductions: Number, net: Number
}, { _id: true });

const payrollRunSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
  lines: [lineSchema],
  generatedAt: Date,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: Date,
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.models.PayrollRun || mongoose.model('PayrollRun', payrollRunSchema);
