/**
 * 목적: 개발용 테스트 데이터 정리(삭제) 스크립트
 * 실행: node scripts/cleanTestData.js
 * 동작: 
 *  - 직원(Employee) 전체 삭제 (관리자 계정 보존)
 *  - 일반 사용자(User) 삭제 (관리자 제외)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('에러: MONGODB_URI 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    const employeeResult = await Employee.deleteMany({});
    console.log(`Employee 삭제: ${employeeResult.deletedCount}건.`);

    const userResult = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`User(관리자 제외) 삭제: ${userResult.deletedCount}건.`);

  } catch (err) {
    console.error('정리 중 오류:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();



