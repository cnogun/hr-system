/**
 * 파일명: checkWorkScheduleStructure.js
 * 목적: WorkSchedule 컬렉션의 구조와 데이터 확인
 */

const mongoose = require('mongoose');
require('dotenv').config();

const WorkSchedule = require('../models/WorkSchedule');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 전체 WorkSchedule 데이터 확인
    const allSchedules = await WorkSchedule.find({}).limit(5);
    
    console.log('=== WorkSchedule 컬렉션 구조 확인 ===');
    console.log('총 스케줄 수:', allSchedules.length);
    
    if (allSchedules.length > 0) {
      const firstSchedule = allSchedules[0];
      console.log('\n=== 첫 번째 스케줄 구조 ===');
      console.log('ID:', firstSchedule._id);
      console.log('주차 시작:', firstSchedule.weekStartDate);
      console.log('주차 종료:', firstSchedule.weekEndDate);
      console.log('상태:', firstSchedule.status);
      
      if (firstSchedule.weekendSchedule) {
        console.log('\n--- 주말 스케줄 구조 ---');
        console.log('토요일:', Object.keys(firstSchedule.weekendSchedule.saturday || {}));
        console.log('일요일:', Object.keys(firstSchedule.weekendSchedule.sunday || {}));
        console.log('팀1:', Object.keys(firstSchedule.weekendSchedule.team1 || {}));
        console.log('팀2:', Object.keys(firstSchedule.weekendSchedule.team2 || {}));
        console.log('팀3:', Object.keys(firstSchedule.weekendSchedule.team3 || {}));
      }
      
      if (firstSchedule.currentWeekSchedule) {
        console.log('\n--- 평일 근무 형태 ---');
        console.log('1팀:', firstSchedule.currentWeekSchedule.team1);
        console.log('2팀:', firstSchedule.currentWeekSchedule.team2);
        console.log('3팀:', firstSchedule.currentWeekSchedule.team3);
      }
    }
    
    // 8월 23일이 속할 수 있는 주차의 스케줄 확인
    console.log('\n=== 8월 23일 관련 스케줄 확인 ===');
    const targetDate = new Date('2025-08-23');
    const weekStart = new Date(targetDate);
    const diff = targetDate.getDay() - 1;
    weekStart.setDate(targetDate.getDate() - diff);
    
    console.log('8월 23일이 속한 주차 시작:', weekStart.toISOString().split('T')[0]);
    
    const relevantSchedule = await WorkSchedule.findOne({
      weekStartDate: { $lte: weekStart },
      weekEndDate: { $gte: weekStart }
    });
    
    if (relevantSchedule) {
      console.log('해당 주차 스케줄 발견!');
      console.log('주차 시작:', relevantSchedule.weekStartDate);
      console.log('주차 종료:', relevantSchedule.weekEndDate);
    } else {
      console.log('8월 23일이 속한 주차의 스케줄이 없습니다.');
      
      // 가장 가까운 스케줄 찾기
      const nearestSchedule = await WorkSchedule.findOne({
        weekStartDate: { $lte: new Date() }
      }).sort({ weekStartDate: -1 });
      
      if (nearestSchedule) {
        console.log('\n가장 최근 스케줄:');
        console.log('주차 시작:', nearestSchedule.weekStartDate);
        console.log('주차 종료:', nearestSchedule.weekEndDate);
      }
    }
    
  } catch (error) {
    console.error('조회 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
