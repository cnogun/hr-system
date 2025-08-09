/**
 * 파일명: clearEmpNo.js
 * 목적: 직원 사번 필드 초기화
 * 기능:
 * - 모든 직원의 사번 필드 삭제
 * - 데이터베이스 정리
 * - 사번 재설정을 위한 준비
 */
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

async function clearEmpNo() {
  await mongoose.connect('mongodb://localhost:27017/hr_system');
  const result = await Employee.updateMany({}, { $unset: { empNo: '' } });
  console.log(`empNo가 비워진 직원 수: ${result.modifiedCount}`);
  mongoose.disconnect();
}

clearEmpNo(); 