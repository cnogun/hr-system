/**
 * 파일명: testWorkScheduleSave.js
 * 목적: 근무 스케줄 저장 기능 테스트
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
    console.log('=== 근무 스케줄 저장 테스트 ===');
    
    // 1. 현재 주차 정보 확인
    const today = new Date();
    const weekStart = new Date(today);
    const diff = today.getDay() - 1;
    weekStart.setDate(today.getDate() - diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    console.log('현재 날짜:', today.toISOString().split('T')[0]);
    console.log('주차 시작:', weekStart.toISOString().split('T')[0]);
    console.log('주차 종료:', weekEnd.toISOString().split('T')[0]);
    
    // 2. 기존 스케줄 확인
    const existingSchedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd
    });
    
    if (existingSchedule) {
      console.log('\n기존 스케줄 발견:');
      console.log('ID:', existingSchedule._id);
      console.log('상태:', existingSchedule.status);
      console.log('주말 스케줄 존재:', !!existingSchedule.weekendSchedule);
    } else {
      console.log('\n기존 스케줄 없음');
    }
    
    // 3. 테스트용 주말 데이터 생성
    const testWeekendData = {
      team1: {
        aGroup: '보안1팀원1번\n보안1팀원2번\n보안1팀원3번',
        bGroup: '보안1팀원21번\n보안1팀원22번\n보안1팀원23번',
        group1: '보안1팀원1번\n보안1팀원2번\n보안1팀원3번',
        group2: '보안1팀원11번\n보안1팀원12번\n보안1팀원13번',
        group3: '보안1팀원21번\n보안1팀원22번\n보안1팀원23번',
        group4: '보안1팀원31번\n보안1팀원32번\n보안1팀원33번'
      },
      team2: {
        aGroup: '보안2팀원1번\n보안2팀원2번\n보안2팀원3번',
        bGroup: '보안2팀원21번\n보안2팀원22번\n보안2팀원23번',
        group1: '보안2팀원1번\n보안2팀원2번\n보안2팀원3번',
        group2: '보안2팀원11번\n보안2팀원12번\n보안2팀원13번',
        group3: '보안2팀원21번\n보안2팀원22번\n보안2팀원23번',
        group4: '보안2팀원31번\n보안2팀원32번\n보안2팀원33번'
      },
      team3: {
        aGroup: '보안3팀원1번\n보안3팀원2번\n보안3팀원3번',
        bGroup: '보안3팀원21번\n보안3팀원22번\n보안3팀원23번',
        group1: '보안3팀원1번\n보안3팀원2번\n보안3팀원3번',
        group2: '보안3팀원11번\n보안3팀원12번\n보안3팀원13번',
        group3: '보안3팀원21번\n보안3팀원22번\n보안3팀원23번',
        group4: '보안3팀원31번\n보안3팀원32번\n보안3팀원33번'
      }
    };
    
    // 4. 스케줄 생성 또는 업데이트
    let schedule;
    if (existingSchedule) {
      console.log('\n기존 스케줄 업데이트 중...');
      existingSchedule.weekendSchedule = testWeekendData;
      schedule = await existingSchedule.save();
      console.log('기존 스케줄 업데이트 완료');
    } else {
      console.log('\n새 스케줄 생성 중...');
      schedule = new WorkSchedule({
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: 'active',
        weekendSchedule: testWeekendData,
        currentWeekSchedule: {
          team1: '주간',
          team2: '초야',
          team3: '심야'
        },
        holidays: [],
        createdBy: 'test-script',
        createdAt: new Date()
      });
      schedule = await schedule.save();
      console.log('새 스케줄 생성 완료');
    }
    
    console.log('\n=== 저장 결과 ===');
    console.log('스케줄 ID:', schedule._id);
    console.log('주차 시작:', schedule.weekStartDate);
    console.log('주차 종료:', schedule.weekEndDate);
    console.log('상태:', schedule.status);
    console.log('주말 스케줄 존재:', !!schedule.weekendSchedule);
    
    if (schedule.weekendSchedule) {
      console.log('\n--- 팀별 편성 현황 ---');
      console.log('1팀 A조:', schedule.weekendSchedule.team1.aGroup.split('\n').length, '명');
      console.log('1팀 1조:', schedule.weekendSchedule.team1.group1.split('\n').length, '명');
      console.log('2팀 A조:', schedule.weekendSchedule.team2.aGroup.split('\n').length, '명');
      console.log('2팀 1조:', schedule.weekendSchedule.team2.group1.split('\n').length, '명');
      console.log('3팀 A조:', schedule.weekendSchedule.team3.aGroup.split('\n').length, '명');
      console.log('3팀 1조:', schedule.weekendSchedule.team3.group1.split('\n').length, '명');
    }
    
    // 5. 저장된 스케줄 재조회 확인
    const savedSchedule = await WorkSchedule.findById(schedule._id);
    if (savedSchedule) {
      console.log('\n=== 재조회 확인 ===');
      console.log('저장된 스케줄 재조회 성공');
      console.log('주말 스케줄 존재:', !!savedSchedule.weekendSchedule);
    } else {
      console.log('\n=== 재조회 실패 ===');
      console.log('저장된 스케줄을 찾을 수 없습니다.');
    }
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
    console.error('오류 상세:', error.stack);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
