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
const EmployeeNumberCounter = require('../models/EmployeeNumberCounter');

function issuanceYear(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(date);
}

// 발급 연도별 다음 번호를 한 문서에서 증가시켜 동시 등록의 중복을 방지합니다.
async function generateEmpNo() {
  const year = issuanceYear();
  let counter = await EmployeeNumberCounter.findById(year);
  if (!counter) {
    // 이전에 YYYY-NNNN 사번이 등록돼 있으면 그 다음 번호부터 시작합니다.
    const latest = await Employee.findOne({ empNo: { $regex: `^${year}-\\d{4}$` } })
      .sort({ empNo: -1 }).select('empNo').lean();
    const initial = latest ? Number(latest.empNo.slice(5)) : 0;
    try {
      await EmployeeNumberCounter.create({ _id: year, sequence: initial });
    } catch (error) {
      // 동시에 처음 발급한 요청이 카운터를 먼저 생성한 경우입니다.
      if (error.code !== 11000) throw error;
    }
  }

  counter = await EmployeeNumberCounter.findOneAndUpdate(
    { _id: year }, { $inc: { sequence: 1 } }, { new: true }
  );
  if (!counter || counter.sequence > 9999) throw new Error(`${year}년 사번 발급 한도를 초과했습니다.`);
  return `${year}-${String(counter.sequence).padStart(4, '0')}`;
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
  issuanceYear,
  checkEmailDuplicate,
  checkResidentNumberDuplicate,
  checkUserIdDuplicate,
  createEmployeeSearchQuery,
  createSortOption
};
