/**
 * 파일명: testWeekendSchedule.js
 * 목적: 주말 스케줄 저장 기능 테스트
 * 기능:
 * - 주말 스케줄 데이터 구조 검증
 * - 직원 weekendAssignment 업데이트 테스트
 * - 에러 처리 테스트
 */

const mongoose = require('mongoose');
const WorkSchedule = require('../models/WorkSchedule');
const Employee = require('../models/Employee');
const User = require('../models/User');

async function testWeekendSchedule() {
  try {
    // MongoDB 연결
    await mongoose.connect('mongodb://localhost:27017/hr_system');
    console.log('MongoDB 연결 성공');
    
    // 실제 admin 사용자 ID 가져오기
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      throw new Error('admin 사용자를 찾을 수 없습니다.');
    }
    const adminId = adminUser._id.toString();
    console.log('Admin 사용자 ID:', adminId);
    
    // 1. 테스트용 주말 스케줄 데이터 생성 (실제 직원 데이터 사용)
    console.log('\n=== 1. 테스트용 주말 스케줄 데이터 생성 ===');
    const testWeekendData = {
      team1: {
        aGroup: '전서준\n조현우\n윤재우',
        bGroup: '류우진\n황주원\n임준우',
        group1: '조재호\n조주원',
        group2: '신시우\n오하준',
        group3: '강재성\n최재성',
        group4: '권도훈\n박도현'
      },
      team2: {
        aGroup: '정재호\n황민재\n송지훈',
        bGroup: '신딸딸\n홍길동\n박수철',
        group1: '전서준\n조현우',
        group2: '윤재우\n류우진',
        group3: '황주원\n임준우',
        group4: '조재호\n조주원'
      },
      team3: {
        aGroup: '신시우\n오하준\n강재성',
        bGroup: '최재성\n권도훈\n박도현',
        group1: '정재호\n황민재',
        group2: '송지훈\n신딸딸',
        group3: '홍길동\n박수철',
        group4: '전서준\n조현우'
      }
    };
    
    console.log('테스트 데이터 생성 완료');
    
    // 2. 현재 주차 스케줄 생성 또는 조회
    console.log('\n=== 2. 현재 주차 스케줄 생성/조회 ===');
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 일요일
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 토요일
    
    let schedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    if (!schedule) {
      // 스케줄이 없으면 생성
      schedule = new WorkSchedule({
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        weekNumber: Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7),
        year: weekStart.getFullYear(),
        currentWeekSchedule: {
          team1: '출근(초)',
          team2: '출근(심)',
          team3: '출근(주)'
        },
        createdBy: adminId,
        status: 'active'
      });
      await schedule.save();
      console.log('새로운 주차 스케줄 생성됨');
    } else {
      console.log('기존 주차 스케줄 조회됨');
    }
    
    // 3. 주말 스케줄 저장 테스트
    console.log('\n=== 3. 주말 스케줄 저장 테스트 ===');
    schedule.weekendSchedule = {
      // 기존 구조 유지
      saturday: {
        dayShift: { team1Count: 0, team3Count: 0 },
        nightShift: { team2Count: 0, team3Count: 0 }
      },
      sunday: {
        dayShift: { team1Count: 0, team3Count: 0 },
        nightShift: { team2Count: 0, team3Count: 0 }
      },
      // 팀별 조별 편성 명단
      team1: testWeekendData.team1,
      team2: testWeekendData.team2,
      team3: testWeekendData.team3
    };
    
    await schedule.save();
    console.log('주말 스케줄 저장 완료');
    
    // 4. 직원 weekendAssignment 업데이트 테스트
    console.log('\n=== 4. 직원 weekendAssignment 업데이트 테스트 ===');
    await updateAssignmentCounts(testWeekendData);
    console.log('직원 weekendAssignment 업데이트 완료');
    
    // 5. 업데이트 결과 확인
    console.log('\n=== 5. 업데이트 결과 확인 ===');
    const updatedEmployees = await Employee.find({
      'weekendAssignment.group': { $ne: 'none' }
    }).select('name empNo department weekendAssignment');
    
    console.log(`업데이트된 직원 수: ${updatedEmployees.length}명`);
    updatedEmployees.forEach(emp => {
      console.log(`- ${emp.name} (${emp.empNo}): ${emp.weekendAssignment.group} / ${emp.weekendAssignment.sundayGroup}`);
    });
    
    console.log('\n=== 테스트 완료 ===');
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    // MongoDB 연결 종료
    await mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
}

// 편성 인원 현황 업데이트 함수 (workSchedule.js에서 복사)
async function updateAssignmentCounts(weekendData) {
  try {
    const teams = ['team1', 'team2', 'team3'];
    
    for (const team of teams) {
      const teamData = weekendData[team];
      if (!teamData) continue;
      
      // A조, B조 명단 파싱
      const aGroupMembers = teamData.aGroup ? teamData.aGroup.split('\n').filter(line => line.trim()) : [];
      const bGroupMembers = teamData.bGroup ? teamData.bGroup.split('\n').filter(line => line.trim()) : [];
      
      // 1조,2조,3조,4조 명단 파싱
      const group1Members = teamData.group1 ? teamData.group1.split('\n').filter(line => line.trim()) : [];
      const group2Members = teamData.group2 ? teamData.group2.split('\n').filter(line => line.trim()) : [];
      const group3Members = teamData.group3 ? teamData.group3.split('\n').filter(line => line.trim()) : [];
      const group4Members = teamData.group4 ? teamData.group4.split('\n').filter(line => line.trim()) : [];
      
      // 각 직원의 weekendAssignment 업데이트 (사번 우선, 이름으로 fallback)
      for (const member of aGroupMembers) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': 'none',
            'weekendAssignment.weekendGroup': 'A조',
            'weekendAssignment.sundayGroup': 'none'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`A조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
      
      for (const member of bGroupMembers) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': 'none',
            'weekendAssignment.weekendGroup': 'B조',
            'weekendAssignment.sundayGroup': 'none'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`B조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
      
      for (const member of group1Members) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': '1/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '1조'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`1조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
      
      for (const member of group2Members) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': '1/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '2조'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`2조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
      
      for (const member of group3Members) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': '3/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '3조'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`3조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
      
      for (const member of group4Members) {
        const memberName = member.trim();
        const result = await Employee.updateOne(
          { 
            $or: [
              { empNo: memberName },
              { name: memberName }
            ]
          },
          { 
            'weekendAssignment.group': '3/4',
            'weekendAssignment.weekendGroup': 'none',
            'weekendAssignment.sundayGroup': '4조'
          }
        );
        if (result.matchedCount === 0) {
          console.warn(`4조: 직원을 찾을 수 없음 - ${memberName}`);
        }
      }
    }
    
  } catch (error) {
    console.error('편성 인원 현황 업데이트 오류:', error);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  testWeekendSchedule();
}

module.exports = { testWeekendSchedule };
