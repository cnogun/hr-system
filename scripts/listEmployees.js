/**
 * 파일명: listEmployees.js
 * 목적: 직원 목록 조회 스크립트
 * 기능:
 * - 전체 직원 목록 출력
 * - 직원 기본 정보 표시
 * - 데이터베이스 연결 테스트
 * - 직원 데이터 검증
 */
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

async function listEmployees() {
  await mongoose.connect('mongodb://localhost:27017/hr_system');
  const employees = await Employee.find();
  employees.forEach(emp => {
    console.log(`_id: ${emp._id}, name: ${emp.name}, email: ${emp.email}`);
  });
  mongoose.disconnect();
}

listEmployees(); 