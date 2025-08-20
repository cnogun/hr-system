/**
 * 파일명: testSaturdayLogic.js
 * 목적: 8월 30일 토요일에 대한 토요일 근무 로직 테스트
 * 기능: 수정된 토요일 근무 로직이 올바르게 작동하는지 확인
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 모델 import
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
    // 8월 23일 (토요일) 테스트
    const targetDate = new Date('2025-08-23');
    const dayOfWeek = targetDate.getDay(); // 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    console.log('=== 8월 23일 토요일 테스트 ===');
    console.log('날짜:', targetDate.toISOString().split('T')[0]);
    console.log('요일:', dayOfWeek === 6 ? '토요일' : '기타');
    console.log('주말여부:', isWeekend);
    
    // 현재 주차 계산
    const weekStart = new Date(targetDate);
    const diff = targetDate.getDay() - 1;
    weekStart.setDate(targetDate.getDate() - diff);
    const weekNumber = Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const cycleWeek = (weekNumber - 1) % 3;
    
    console.log('주차:', weekNumber);
    console.log('사이클 주차:', cycleWeek);
    
    // 해당 주차의 근무 스케줄 조회 (1조 명단 확인용)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const workSchedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekStart },
      weekEndDate: { $gte: weekStart },
      status: 'active'
    });
    
    console.log('\n=== 근무 스케줄 조회 결과 ===');
    if (workSchedule) {
      console.log('스케줄 ID:', workSchedule._id);
      console.log('주차 시작:', workSchedule.weekStartDate);
      console.log('주차 종료:', workSchedule.weekEndDate);
      
      // 각 팀의 1조 명단 추출
      const team1Group1Members = workSchedule?.weekendSchedule?.team1?.group1?.split('\n').filter(line => line.trim()) || [];
      const team2Group1Members = workSchedule?.weekendSchedule?.team2?.group1?.split('\n').filter(line => line.trim()) || [];
      const team3Group1Members = workSchedule?.weekendSchedule?.team3?.group1?.split('\n').filter(line => line.trim()) || [];
      
      console.log('\n=== 근무 스케줄 1조 명단 ===');
      console.log('보안1팀 1조:', team1Group1Members);
      console.log('보안2팀 1조:', team2Group1Members);
      console.log('보안3팀 1조:', team3Group1Members);
    } else {
      console.log('해당 주차의 근무 스케줄이 없습니다.');
    }
    
    // 보안팀 직원들의 현재 weekendAssignment 확인
    const securityEmployees = await Employee.find({ 
      department: { $regex: /^보안/ }, 
      status: '재직' 
    }).limit(20);
    
    console.log('\n=== 보안팀 직원들의 현재 weekendAssignment ===');
    securityEmployees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.name} (${emp.department})`);
      if (emp.weekendAssignment) {
        console.log(`   - group: ${emp.weekendAssignment.group}`);
        console.log(`   - weekendGroup: ${emp.weekendAssignment.weekendGroup}`);
        console.log(`   - sundayGroup: ${emp.weekendAssignment.sundayGroup}`);
      } else {
        console.log('   - weekendAssignment: 없음');
      }
      console.log('');
    });
    
    // 토요일 근무 로직 시뮬레이션
    console.log('\n=== 토요일 근무 로직 시뮬레이션 ===');
    
    if (workSchedule) {
      const team1Group1Members = workSchedule?.weekendSchedule?.team1?.group1?.split('\n').filter(line => line.trim()) || [];
      const team2Group1Members = workSchedule?.weekendSchedule?.team2?.group1?.split('\n').filter(line => line.trim()) || [];
      const team3Group1Members = workSchedule?.weekendSchedule?.team3?.group1?.split('\n').filter(line => line.trim()) || [];
      
      // 보안1팀
      const team1Employees = securityEmployees.filter(emp => emp.department === '보안1팀');
      console.log('\n--- 보안1팀 (40명) ---');
      team1Employees.forEach(emp => {
        const isGroup1Member = team1Group1Members.includes(emp.name);
        if (isGroup1Member) {
          console.log(`${emp.name}: 휴무 (1조 - 일요일 지원근무)`);
        } else {
          console.log(`${emp.name}: 휴무 (토요일 휴무)`);
        }
      });
      
      // 보안2팀
      const team2Employees = securityEmployees.filter(emp => emp.department === '보안2팀');
      console.log('\n--- 보안2팀 (40명) ---');
      team2Employees.forEach(emp => {
        const isGroup1Member = team2Group1Members.includes(emp.name);
        if (isGroup1Member) {
          console.log(`${emp.name}: 휴무 (1조 - 일요일 지원근무)`);
        } else {
          console.log(`${emp.name}: 출근(주특) (토요일 주간특근)`);
        }
      });
      
      // 보안3팀
      const team3Employees = securityEmployees.filter(emp => emp.department === '보안3팀');
      console.log('\n--- 보안3팀 (40명) ---');
      team3Employees.forEach(emp => {
        const isGroup1Member = team3Group1Members.includes(emp.name);
        if (isGroup1Member) {
          console.log(`${emp.name}: 휴무 (1조 - 일요일 지원근무)`);
        } else {
          console.log(`${emp.name}: 출근(야특) (토요일 야간특근)`);
        }
      });
    }
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
