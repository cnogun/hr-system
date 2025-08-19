const mongoose = require('mongoose');
require('dotenv').config();

// 모델 import
const User = require('../models/User');
const Employee = require('../models/Employee');
const WorkSchedule = require('../models/WorkSchedule');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 관리자 사용자 찾기 (userId용)
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('관리자 사용자를 찾을 수 없습니다. 먼저 관리자를 생성해주세요.');
      process.exit(1);
    }

    // 기존 보안팀 직원 데이터 삭제 (선택사항)
    const deleteResult = await Employee.deleteMany({
      department: { $in: ['보안1팀', '보안2팀', '보안3팀'] }
    });
    console.log(`기존 보안팀 직원 ${deleteResult.deletedCount}명 삭제 완료`);

    // 가상 직원 데이터 생성
    const virtualEmployees = [];
    
    // 보안1팀 40명 생성
    for (let i = 1; i <= 40; i++) {
      const employee = {
        userId: adminUser._id, // 관리자 사용자 ID 사용
        employeeNumber: `S001${String(i).padStart(2, '0')}`,
        name: `보안1팀원${i}`,
        position: '보안원',
        department: '보안1팀',
        phone: `010-1000-${String(i).padStart(4, '0')}`,
        email: `security1_${i}@company.com`,
        hireDate: new Date('2024-01-01'),
        status: '재직',
        // 새로운 주말 근무 할당 시스템
        weekendAssignment: {
          group: i <= 10 ? (i <= 3 ? '1/4' : '3/4') : 'none',
          weekendGroup: 'none', // 1팀은 토요일 휴무 아님
          sundayGroup: i <= 10 ? (i <= 3 ? '1조' : '2조') : 'none'
        }
      };
      virtualEmployees.push(employee);
    }

    // 보안2팀 40명 생성
    for (let i = 1; i <= 40; i++) {
      const employee = {
        userId: adminUser._id, // 관리자 사용자 ID 사용
        employeeNumber: `S002${String(i).padStart(2, '0')}`,
        name: `보안2팀원${i}`,
        position: '보안원',
        department: '보안2팀',
        phone: `010-2000-${String(i).padStart(4, '0')}`,
        email: `security2_${i}@company.com`,
        hireDate: new Date('2024-01-01'),
        status: '재직',
        // 새로운 주말 근무 할당 시스템
        weekendAssignment: {
          group: i <= 10 ? (i <= 3 ? '1/4' : '3/4') : 'none',
          weekendGroup: 'none', // 2팀은 토요일 휴무 아님
          sundayGroup: i <= 10 ? (i <= 3 ? '3조' : '4조') : 'none'
        }
      };
      virtualEmployees.push(employee);
    }

    // 보안3팀 40명 생성 (토요일 전체 휴무, A조/B조로 구분)
    for (let i = 1; i <= 40; i++) {
      const employee = {
        userId: adminUser._id, // 관리자 사용자 ID 사용
        employeeNumber: `S003${String(i).padStart(2, '0')}`,
        name: `보안3팀원${i}`,
        position: '보안원',
        department: '보안3팀',
        phone: `010-3000-${String(i).padStart(4, '0')}`,
        email: `security3_${i}@company.com`,
        hireDate: new Date('2024-01-01'),
        status: '재직',
        // 새로운 주말 근무 할당 시스템
        weekendAssignment: {
          group: 'none', // 3팀은 기본 그룹 없음
          weekendGroup: i <= 20 ? 'A조' : 'B조', // A조(1-20번), B조(21-40번)
          sundayGroup: 'none' // 3팀은 일요일 근무 없음
        }
      };
      virtualEmployees.push(employee);
    }

    // 직원 데이터 저장
    const savedEmployees = [];
    for (const employeeData of virtualEmployees) {
      const employee = new Employee(employeeData);
      const savedEmployee = await employee.save();
      savedEmployees.push(savedEmployee);
    }
    console.log(`총 ${savedEmployees.length}명의 가상 직원 데이터 생성 완료`);

    // 팀별 통계 출력
    const team1Count = savedEmployees.filter(emp => emp.department === '보안1팀').length;
    const team2Count = savedEmployees.filter(emp => emp.department === '보안2팀').length;
    const team3Count = savedEmployees.filter(emp => emp.department === '보안3팀').length;
    
    console.log('\n=== 팀별 직원 현황 ===');
    console.log(`보안1팀: ${team1Count}명 (1/4: 3명, 3/4: 7명)`);
    console.log(`보안2팀: ${team2Count}명 (1/4: 3명, 3/4: 7명)`);
    console.log(`보안3팀: ${team3Count}명 (1/4: 3명, 3/4: 7명)`);
    console.log(`총 인원: ${team1Count + team2Count + team3Count}명`);

    // 주말 근무 할당 현황 출력
    console.log('\n=== 주말 근무 할당 현황 ===');
    const oneFourthCount = savedEmployees.filter(emp => emp.weekendAssignment.group === '1/4').length;
    const threeFourthCount = savedEmployees.filter(emp => emp.weekendAssignment.group === '3/4').length;
    const noAssignmentCount = savedEmployees.filter(emp => emp.weekendAssignment.group === 'none').length;
    
    const aGroupCount = savedEmployees.filter(emp => emp.weekendAssignment.weekendGroup === 'A조').length;
    const bGroupCount = savedEmployees.filter(emp => emp.weekendAssignment.weekendGroup === 'B조').length;
    
    const sunday1GroupCount = savedEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '1조').length;
    const sunday2GroupCount = savedEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '2조').length;
    const sunday3GroupCount = savedEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '3조').length;
    const sunday4GroupCount = savedEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '4조').length;
    
    console.log(`1/4 할당: ${oneFourthCount}명 (각 팀 3명씩)`);
    console.log(`3/4 할당: ${threeFourthCount}명 (각 팀 7명씩)`);
    console.log(`할당 없음: ${noAssignmentCount}명 (각 팀 30명씩)`);
    console.log(`\n=== 주말 그룹별 현황 ===`);
    console.log(`A조 (토요일 휴무): ${aGroupCount}명 (3팀 1-20번)`);
    console.log(`B조 (토요일 휴무): ${bGroupCount}명 (3팀 21-40번)`);
    console.log(`\n=== 일요일 근무 그룹별 현황 ===`);
    console.log(`1조: ${sunday1GroupCount}명 (1팀 1-3번)`);
    console.log(`2조: ${sunday2GroupCount}명 (1팀 4-10번)`);
    console.log(`3조: ${sunday3GroupCount}명 (2팀 1-3번)`);
    console.log(`4조: ${sunday4GroupCount}명 (2팀 4-10번)`);

    // 현재 주차의 근무 스케줄 생성 (선택사항)
    try {
      const currentWeekSchedule = await createCurrentWeekSchedule(adminUser._id);
      console.log('\n=== 현재 주차 근무 스케줄 생성 완료 ===');
      console.log(`주차: ${currentWeekSchedule.weekNumber}주차`);
      console.log(`기간: ${currentWeekSchedule.weekStartDate.toLocaleDateString()} ~ ${currentWeekSchedule.weekEndDate.toLocaleDateString()}`);
    } catch (scheduleError) {
      console.log('\n⚠️ 근무 스케줄 생성 중 오류 발생:', scheduleError.message);
    }

    console.log('\n🎉 가상 직원 데이터 생성이 완료되었습니다!');
    console.log('이제 근무 스케줄 관리 페이지에서 주말 근무 할당을 확인할 수 있습니다.');

  } catch (error) {
    console.error('데이터 생성 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
});

// 현재 주차 근무 스케줄 생성 함수
async function createCurrentWeekSchedule(adminUserId) {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  
  // 기존 스케줄이 있는지 확인
  const existingSchedule = await WorkSchedule.findOne({
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    status: 'active'
  });

  if (existingSchedule) {
    console.log('이미 현재 주차 스케줄이 존재합니다.');
    return existingSchedule;
  }

  // 새 스케줄 생성
  const scheduleData = {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    currentWeekSchedule: {
      team1: '출근(초)',
      team2: '출근(심)',
      team3: '출근(주)'
    },
    weekendSchedule: {
      saturday: {
        dayShift: { team1Count: 30, team3Count: 0 }, // 1팀 3/4 (30명) 주간
        nightShift: { team2Count: 30, team3Count: 0 }, // 2팀 3/4 (30명) 야간
        offDuty: { team3Count: 40 } // 3팀 전체 휴무 (A조/B조로 구분)
      },
      sunday: {
        dayShift: { team1Count: 10, team3Count: 10 }, // 1팀 1/4 (10명) + 3팀 A조 1/2 (10명)
        nightShift: { team2Count: 10, team3Count: 10 }  // 2팀 1/4 (10명) + 3팀 B조 1/2 (10명)
      }
    },
    holidays: [],
    createdBy: adminUserId, // 관리자 사용자 ID 사용
    status: 'active'
  };

  const newSchedule = new WorkSchedule(scheduleData);
  return await newSchedule.save();
}

// 주차 시작일 계산 (월요일)
function getWeekStart(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 월요일이 1, 일요일이 0
  return new Date(date.setDate(diff));
}

// 주차 종료일 계산 (일요일)
function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}
