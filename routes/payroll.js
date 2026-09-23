const express = require('express');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const PayrollRate = require('../models/PayrollRate');
const PayrollRun = require('../models/PayrollRun');

const router = express.Router();
router.use((req, res, next) => {
  if (!req.session?.userId) return res.redirect('/auth/login');
  if (req.session.userRole !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  next();
});

const monthOK = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '');
const amount = value => {
  if (value === '' || value === undefined || value === null) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000000) throw new Error('금액은 0 이상의 숫자로 입력하세요.');
  return number;
};
const hours = value => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0 || number > 24) throw new Error('근태시간 값이 올바르지 않습니다.');
  return number;
};
const money = value => Math.round(value);
const redirect = (res, month, notice) => res.redirect(`/payroll?month=${encodeURIComponent(month)}&notice=${encodeURIComponent(notice)}`);
const fields = ['basicMonthly', 'basicHourly', 'overtimeHourly', 'specialHourly', 'specialOvertimeHourly', 'nightHourly', 'fixedAllowance'];
const deductions = ['incomeTax', 'localTax', 'pension', 'health', 'longTermCare', 'employmentInsurance', 'extraDeduction'];

function totals(line) {
  line.gross = money(line.basePay + line.overtimePay + line.specialPay + line.specialOvertimePay + line.nightPay + Number(line.rates.fixedAllowance || 0) + Number(line.extraPay || 0));
  line.deductions = money(deductions.reduce((sum, key) => sum + Number(line[key] || 0), 0));
  line.net = line.gross - line.deductions;
  if (line.net < 0) throw new Error('공제액이 지급액보다 큽니다.');
}

router.get('/', async (req, res, next) => {
  try {
    const month = monthOK(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const [employees, rates, run] = await Promise.all([
      Employee.find({ status: '재직' }).select('name empNo department').sort({ department: 1, name: 1 }).lean(),
      PayrollRate.find({ effectiveFrom: { $lte: month } }).sort({ effectiveFrom: 1 }).lean(), PayrollRun.findOne({ month }).lean()
    ]);
    res.render('payroll', { session: req.session, month, tab: ['rates', 'ledger'].includes(req.query.tab) ? req.query.tab : 'monthly', employees, rates: Object.fromEntries(rates.map(rate => [String(rate.employee), rate])), run, notice: String(req.query.notice || '').slice(0, 200) });
  } catch (error) { next(error); }
});

router.post('/rates/:employeeId', async (req, res) => {
  const month = req.body.month;
  try {
    if (!monthOK(month) || !mongoose.isValidObjectId(req.params.employeeId)) throw new Error('월 또는 직원 정보가 올바르지 않습니다.');
    const employee = await Employee.exists({ _id: req.params.employeeId });
    if (!employee) throw new Error('직원을 찾을 수 없습니다.');
    const values = Object.fromEntries(fields.map(key => [key, amount(req.body[key])]));
    if (Number(Boolean(values.basicMonthly)) + Number(Boolean(values.basicHourly)) !== 1) throw new Error('월 기본급 또는 기본 시급 중 하나만 입력하세요.');
    await PayrollRate.findOneAndUpdate({ employee: req.params.employeeId, effectiveFrom: month }, { ...values, updatedBy: req.session.userId }, { upsert: true, runValidators: true });
    res.redirect(`/payroll?month=${encodeURIComponent(month)}&tab=rates&notice=${encodeURIComponent('급여 기준을 저장했습니다. 기존 시산은 다시 계산해야 반영됩니다.')}`);
  } catch (error) { res.redirect(`/payroll?month=${encodeURIComponent(monthOK(month) ? month : new Date().toISOString().slice(0, 7))}&tab=rates&notice=${encodeURIComponent(error.message)}`); }
});

router.post('/calculate', async (req, res) => {
  const month = req.body.month;
  try {
    if (!monthOK(month)) throw new Error('대상 월이 올바르지 않습니다.');
    const existing = await PayrollRun.findOne({ month });
    if (existing?.status === 'confirmed') throw new Error('확정된 급여는 다시 계산할 수 없습니다.');
    const employees = await Employee.find({ status: '재직' }).select('name empNo department attendance');
    const rates = await PayrollRate.find({ employee: { $in: employees.map(emp => emp._id) }, effectiveFrom: { $lte: month } }).sort({ effectiveFrom: 1 });
    const rateMap = new Map(rates.map(rate => [String(rate.employee), rate]));
    const missing = employees.filter(emp => !rateMap.has(String(emp._id)));
    if (missing.length) throw new Error(`${missing.length}명의 급여 기준이 없습니다. 기준 등록 후 다시 계산하세요.`);
    if (!employees.length) throw new Error('급여 대상 직원이 없습니다.');
    const lines = employees.map(emp => {
      const rate = rateMap.get(String(emp._id));
      const work = { basic: 0, overtime: 0, special: 0, specialOvertime: 0, night: 0 };
      let attendanceCount = 0;
      for (const [date, record] of (emp.attendance || new Map()).entries()) {
        if (!date.startsWith(`${month}-`) || !record?.status) continue;
        attendanceCount++;
        for (const key of Object.keys(work)) work[key] += hours(record[key]);
      }
      const line = {
        employee: emp._id, name: emp.name, empNo: emp.empNo || '', department: emp.department || '',
        hours: work, attendanceCount, rates: Object.fromEntries(fields.map(key => [key, rate[key] || 0])),
        basePay: money(rate.basicMonthly || work.basic * rate.basicHourly),
        overtimePay: money(work.overtime * rate.overtimeHourly),
        specialPay: money(work.special * rate.specialHourly),
        specialOvertimePay: money(work.specialOvertime * rate.specialOvertimeHourly),
        nightPay: money(work.night * rate.nightHourly),
        extraPay: 0, extraDeduction: 0, incomeTax: 0, localTax: 0, pension: 0,
        health: 0, longTermCare: 0, employmentInsurance: 0, deductionsReviewed: false, note: ''
      };
      totals(line);
      return line;
    });
    // 재계산 전에 입력한 일회성 지급 및 공제 내용은 유지한다.
    const previous = new Map((existing?.lines || []).map(line => [String(line.employee), line]));
    for (const line of lines) {
      const old = previous.get(String(line.employee));
      if (!old) continue;
      for (const key of [...deductions, 'extraPay', 'note']) line[key] = old[key];
      line.deductionsReviewed = old.deductionsReviewed;
      totals(line);
    }
    await PayrollRun.findOneAndUpdate({ month, status: 'draft' }, { $set: { lines, generatedAt: new Date(), generatedBy: req.session.userId } }, { upsert: true, runValidators: true });
    redirect(res, month, '월별 급여 시산을 저장했습니다. 근태시간·수당·공제를 검토하세요.');
  } catch (error) { redirect(res, monthOK(month) ? month : new Date().toISOString().slice(0, 7), error.message); }
});

router.post('/lines/:lineId', async (req, res) => {
  const month = req.body.month;
  try {
    if (!monthOK(month) || !mongoose.isValidObjectId(req.params.lineId)) throw new Error('대상 정보가 올바르지 않습니다.');
    const run = await PayrollRun.findOne({ month, status: 'draft' });
    if (!run) throw new Error('수정할 시산 내역이 없습니다.');
    const line = run.lines.id(req.params.lineId);
    if (!line) throw new Error('직원 급여 내역을 찾을 수 없습니다.');
    for (const key of [...deductions, 'extraPay']) line[key] = amount(req.body[key]);
    line.note = String(req.body.note || '').slice(0, 300);
    line.deductionsReviewed = req.body.deductionsReviewed === 'on';
    totals(line);
    await run.save();
    redirect(res, month, `${line.name} 급여 검토 내용을 저장했습니다.`);
  } catch (error) { redirect(res, monthOK(month) ? month : new Date().toISOString().slice(0, 7), error.message); }
});

router.post('/confirm', async (req, res) => {
  const month = req.body.month;
  try {
    if (!monthOK(month)) throw new Error('대상 월이 올바르지 않습니다.');
    const run = await PayrollRun.findOne({ month, status: 'draft' });
    if (!run?.lines.length) throw new Error('확정할 시산 내역이 없습니다.');
    if (run.lines.some(line => !line.deductionsReviewed || !line.attendanceCount)) throw new Error('근태 기록이 없거나 공제 검토가 완료되지 않은 직원이 있습니다.');
    const changed = await PayrollRun.updateOne({ _id: run._id, status: 'draft', updatedAt: run.updatedAt }, { $set: { status: 'confirmed', confirmedAt: new Date(), confirmedBy: req.session.userId } });
    if (!changed.modifiedCount) throw new Error('동시에 변경된 급여입니다. 다시 확인하세요.');
    redirect(res, month, '급여를 확정했습니다. 이후에는 수정할 수 없습니다.');
  } catch (error) { redirect(res, monthOK(month) ? month : new Date().toISOString().slice(0, 7), error.message); }
});

router.get('/payslip/:month/:employeeId', async (req, res, next) => {
  try {
    if (!monthOK(req.params.month) || !mongoose.isValidObjectId(req.params.employeeId)) return res.sendStatus(400);
    const run = await PayrollRun.findOne({ month: req.params.month, status: 'confirmed' }).lean();
    const line = run?.lines.find(item => String(item.employee) === req.params.employeeId);
    if (!line) return res.sendStatus(404);
    res.render('payrollPayslip', { session: req.session, run, line });
  } catch (error) { next(error); }
});

module.exports = router;
