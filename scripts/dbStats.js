/**
 * 목적: 간단한 DB 통계 출력 스크립트
 * 실행: node scripts/dbStats.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('에러: MONGODB_URI 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    const employeeCount = await Employee.countDocuments();
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });

    console.log('=== DB 통계 ===');
    console.log(`- Employees: ${employeeCount}`);
    console.log(`- Users:     ${userCount} (admins: ${adminCount})`);

    const departmentAgg = await Employee.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n부서별 인원:');
    departmentAgg.forEach(row => {
      console.log(`- ${row._id || '(미지정)'}: ${row.count}`);
    });

  } catch (err) {
    console.error('통계 중 오류:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();



