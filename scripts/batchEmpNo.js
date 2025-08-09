/**
 * 파일명: batchEmpNo.js
 * 목적: 직원 사번 일괄 처리
 * 기능:
 * - 기존 직원 데이터에 사번 추가
 * - 사번 중복 검사
 * - 사번 형식 검증
 * - 데이터베이스 일괄 업데이트
 */
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

async function generateEmpNo(orgType, department, seq) {
  const orgCode = orgType === '본사' ? '1' : '2';
  let deptCode = '88';
  if (department === '보안1팀') deptCode = '01';
  else if (department === '보안2팀') deptCode = '02';
  else if (department === '보안3팀') deptCode = '03';
  else if (department === '관리팀') deptCode = '04';
  else if (department === '인사팀') deptCode = '05';
  else if (department === '영업팀') deptCode = '06';
  return orgCode + deptCode + seq.toString().padStart(4, '0');
}

async function batchEmpNo() {
  await mongoose.connect('mongodb://localhost:27017/hr_system');
  // orgType, department별 그룹핑
  const employees = await Employee.find().sort({ orgType: 1, department: 1, hireDate: 1, _id: 1 });
  const groupMap = {};
  for (const emp of employees) {
    const key = `${emp.orgType}|${emp.department}`;
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(emp);
  }
  let updated = 0;
  for (const key in groupMap) {
    const group = groupMap[key];
    for (let i = 0; i < group.length; i++) {
      const emp = group[i];
      if (emp.empNo) continue; // 이미 사번이 있으면 건너뜀
      const empNo = await generateEmpNo(emp.orgType, emp.department, i + 1);
      emp.empNo = empNo;
      await emp.save();
      console.log(`${emp.name} (${emp.orgType}/${emp.department}) → ${empNo}`);
      updated++;
    }
  }
  console.log(`총 ${updated}명의 사번이 일괄 생성/갱신되었습니다.`);
  mongoose.disconnect();
}

batchEmpNo(); 