/**
 * 파일명: employee.js
 * 목적: 직원 정보 관련 유틸리티 함수
 * 기능:
 * - 직원 정보 검증
 * - 직원 데이터 처리
 * - 엑셀 파일 처리
 * - 데이터 변환 및 포맷팅
 */
const Employee = require('../models/Employee');

// 사번 생성 함수
async function generateEmpNo(orgType, department) {
  const orgCode = orgType === '본사' ? '1' : '2';
  let deptCode = '88';
  
  if (department === '보안1팀') deptCode = '01';
  else if (department === '보안2팀') deptCode = '02';
  else if (department === '보안3팀') deptCode = '03';
  else if (department === '관리팀') deptCode = '04';
  else if (department === '인사팀') deptCode = '05';
  else if (department === '영업팀') deptCode = '06';
  
  // 입사순
  const count = await Employee.countDocuments({ orgType, department });
  const seq = (count + 1).toString().padStart(4, '0');
  return orgCode + deptCode + seq;
}

// 이메일 중복 검사
async function checkEmailDuplicate(email, excludeId = null) {
  const query = { email: email };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await Employee.findOne(query);
}

// 주민등록번호 중복 검사
async function checkResidentNumberDuplicate(residentNumber, excludeId = null) {
  if (!residentNumber || residentNumber.trim() === '') {
    return null; // 빈 값은 중복 검사하지 않음
  }
  
  const query = { residentNumber: residentNumber };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await Employee.findOne(query);
}

// 사용자 ID 중복 검사
async function checkUserIdDuplicate(userId, excludeId = null) {
  const query = { userId: userId };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return await Employee.findOne(query);
}

// 직원 검색 쿼리 생성
function createEmployeeSearchQuery(search, department, position) {
  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
      { position: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (department) query.department = department;
  if (position) query.position = position;
  
  return query;
}

// 정렬 옵션 생성
function createSortOption(sort, order) {
  if (!sort) return {};
  
  const sortOption = {};
  sortOption[sort] = order === 'desc' ? -1 : 1;
  return sortOption;
}

module.exports = {
  generateEmpNo,
  checkEmailDuplicate,
  checkResidentNumberDuplicate,
  checkUserIdDuplicate,
  createEmployeeSearchQuery,
  createSortOption
}; 