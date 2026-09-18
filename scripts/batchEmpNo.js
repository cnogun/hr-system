/** 기존 사번은 보존하고 사번이 없는 직원에게만 새 번호를 발급합니다. */
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const { generateEmpNo } = require('../utils/employee');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI가 설정되지 않았습니다.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const employees = await Employee.find({ $or: [{ empNo: { $exists: false } }, { empNo: null }, { empNo: '' }] })
      .sort({ hireDate: 1, _id: 1 });
    for (const employee of employees) {
      employee.empNo = await generateEmpNo();
      await employee.save();
      console.log(`${employee.name}: ${employee.empNo}`);
    }
    console.log(`사번 없는 직원 ${employees.length}명 처리 완료`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
