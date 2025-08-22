/**
 * 파일명: testWorkSchedule.js
 * 목적: 근무 스케줄 시스템 테스트
 * 기능:
 * - 근무 스케줄 모델 테스트
 * - 자동 스케줄 설정 테스트
 * - 주말/공휴일 근무 설정 테스트
 */

const mongoose = require('mongoose');
const WorkSchedule = require('../models/WorkSchedule');
const WorkScheduleService = require('../services/workScheduleService');

async function testWorkSchedule() {
  try {
    // MongoDB 연결
    await mongoose.connect('mongodb://localhost:27017/hr_system');
    console.log('MongoDB 연결 성공');
    
    // 실제 admin 사용자 ID 가져오기
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      throw new Error('admin 사용자를 찾을 수 없습니다.');
    }
    const adminId = adminUser._id.toString();
    console.log('Admin 사용자 ID:', adminId);
    
    // 1. 현재 주차 스케줄 생성 테스트
    console.log('\n=== 1. 현재 주차 스케줄 생성 테스트 ===');
    const schedule = await WorkScheduleService.createCurrentWeekSchedule(adminId);
    console.log('생성된 스케줄:', {
      weekStartDate: schedule.weekStartDate,
      weekEndDate: schedule.weekEndDate,
      weekNumber: schedule.weekNumber,
      year: schedule.year,
      currentWeekSchedule: schedule.currentWeekSchedule
    });
    
    // 2. 평일 근무 스케줄 자동 설정 테스트
    console.log('\n=== 2. 평일 근무 스케줄 자동 설정 테스트 ===');
    const weekdayDate = new Date('2025-01-27'); // 월요일
    const weekdaySchedule = await WorkScheduleService.autoSetWorkSchedule(weekdayDate, 'testUserId');
    console.log('평일 스케줄 데이터:', Object.keys(weekdaySchedule).length + '명의 직원');
    
    // 3. 주말 근무 스케줄 자동 설정 테스트
    console.log('\n=== 3. 주말 근무 스케줄 자동 설정 테스트 ===');
    const weekendDate = new Date('2025-01-25'); // 토요일
    const weekendSchedule = await WorkScheduleService.autoSetWorkSchedule(weekendDate, 'testUserId');
    console.log('주말 스케줄 데이터:', Object.keys(weekendSchedule).length + '명의 직원');
    
    // 4. 공휴일 근무 스케줄 자동 설정 테스트
    console.log('\n=== 4. 공휴일 근무 스케줄 자동 설정 테스트 ===');
    const holidayDate = new Date('2025-01-01'); // 신정
    const holidaySchedule = await WorkScheduleService.autoSetWorkSchedule(holidayDate, 'testUserId');
    console.log('공휴일 스케줄 데이터:', Object.keys(holidaySchedule).length + '명의 직원');
    
    // 5. 야간시간 계산 테스트
    console.log('\n=== 5. 야간시간 계산 테스트 ===');
    const nightTime1 = WorkScheduleService.calculateNightTime('22:00', '06:00');
    const nightTime2 = WorkScheduleService.calculateNightTime('06:00', '14:00');
    const nightTime3 = WorkScheduleService.calculateNightTime('14:00', '22:00');
    console.log('야간시간 계산 결과:');
    console.log('- 22:00~06:00:', nightTime1, '시간');
    console.log('- 06:00~14:00:', nightTime2, '시간');
    console.log('- 14:00~22:00:', nightTime3, '시간');
    
    // 6. 총시간 계산 테스트
    console.log('\n=== 6. 총시간 계산 테스트 ===');
    const totalTime1 = WorkScheduleService.calculateTotalTime('8', '2', '0', '0', '8');
    const totalTime2 = WorkScheduleService.calculateTotalTime('8', '0', '8', '4', '0');
    console.log('총시간 계산 결과:');
    console.log('- 기본8 + 연장2 + 야간8:', totalTime1, '시간');
    console.log('- 기본8 + 특근8 + 특연4:', totalTime2, '시간');
    
    // 7. 주차 계산 테스트
    console.log('\n=== 7. 주차 계산 테스트 ===');
    const testDate = new Date('2025-01-27');
    const weekStart = WorkScheduleService.getWeekStart(testDate);
    const weekEnd = WorkScheduleService.getWeekEnd(testDate);
    console.log('주차 계산 결과:');
    console.log('- 테스트 날짜:', testDate.toLocaleDateString('ko-KR'));
    console.log('- 주차 시작:', weekStart.toLocaleDateString('ko-KR'));
    console.log('- 주차 종료:', weekEnd.toLocaleDateString('ko-KR'));
    
    console.log('\n=== 테스트 완료 ===');
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    // MongoDB 연결 종료
    await mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  testWorkSchedule();
}

module.exports = { testWorkSchedule };
