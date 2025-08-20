/**
 * 파일명: checkWeekendSchedule.js
 * 목적: 8월 23일 토요일에 대한 주말 근무 스케줄 확인
 * 기능: 토요일 주간/야간 근무팀과 지원조 정보 파악
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 모델 import
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
    
    console.log('=== 8월 23일 토요일 근무 스케줄 확인 ===');
    console.log('날짜:', targetDate.toISOString().split('T')[0]);
    console.log('요일:', dayOfWeek === 6 ? '토요일' : '기타');
    
    // 현재 주차 계산
    const weekStart = new Date(targetDate);
    const diff = targetDate.getDay() - 1;
    weekStart.setDate(targetDate.getDate() - diff);
    const weekNumber = Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const cycleWeek = (weekNumber - 1) % 3; // 3주 주기
    
    console.log('주차:', weekNumber);
    console.log('사이클 주차:', cycleWeek);
    
    // 해당 주차의 근무 스케줄 조회
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    console.log('\n=== 주차 정보 ===');
    console.log('주차 시작:', weekStart.toISOString().split('T')[0]);
    console.log('주차 종료:', weekEnd.toISOString().split('T')[0]);
    
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
      
      // 주말 스케줄 정보
      if (workSchedule.weekendSchedule) {
        console.log('\n=== 주말 근무 스케줄 ===');
        
        // 토요일 근무 정보
        if (workSchedule.weekendSchedule.saturday) {
          console.log('\n--- 토요일 근무 ---');
          const saturday = workSchedule.weekendSchedule.saturday;
          
          if (saturday.dayShift) {
            console.log('주간근무:');
            console.log('  - 1팀 인원:', saturday.dayShift.team1Count || 0);
            console.log('  - 3팀 휴무조:', saturday.dayShift.team3Count || 0);
          }
          
          if (saturday.nightShift) {
            console.log('야간근무:');
            console.log('  - 2팀 인원:', saturday.nightShift.team2Count || 0);
            console.log('  - 3팀 휴무조:', saturday.nightShift.team3Count || 0);
          }
        }
        
        // 일요일 근무 정보
        if (workSchedule.weekendSchedule.sunday) {
          console.log('\n--- 일요일 근무 ---');
          const sunday = workSchedule.weekendSchedule.sunday;
          
          if (sunday.dayShift) {
            console.log('주간근무:');
            console.log('  - 1팀 인원:', sunday.dayShift.team1Count || 0);
            console.log('  - 3팀 휴무조:', sunday.dayShift.team3Count || 0);
          }
          
          if (sunday.nightShift) {
            console.log('야간근무:');
            console.log('  - 2팀 인원:', sunday.nightShift.team2Count || 0);
            console.log('  - 3팀 휴무조:', sunday.nightShift.team3Count || 0);
          }
        }
        
        // 각 팀의 조별 편성 명단
        if (workSchedule.weekendSchedule.team1) {
          console.log('\n--- 보안1팀 조별 편성 ---');
          const team1 = workSchedule.weekendSchedule.team1;
          
          if (team1.aGroup) {
            const aGroupMembers = team1.aGroup.split('\n').filter(line => line.trim());
            console.log('A조 (일요일 주간근무):', aGroupMembers.length, '명');
            console.log('  - 명단:', aGroupMembers.slice(0, 5).join(', '), aGroupMembers.length > 5 ? '...' : '');
          }
          
          if (team1.group1) {
            const group1Members = team1.group1.split('\n').filter(line => line.trim());
            console.log('1조 (일요일 지원근무):', group1Members.length, '명');
            console.log('  - 명단:', group1Members.slice(0, 5).join(', '), group1Members.length > 5 ? '...' : '');
          }
        }
        
        if (workSchedule.weekendSchedule.team2) {
          console.log('\n--- 보안2팀 조별 편성 ---');
          const team2 = workSchedule.weekendSchedule.team2;
          
          if (team2.aGroup) {
            const aGroupMembers = team2.aGroup.split('\n').filter(line => line.trim());
            console.log('A조 (일요일 주간근무):', aGroupMembers.length, '명');
            console.log('  - 명단:', aGroupMembers.slice(0, 5).join(', '), aGroupMembers.length > 5 ? '...' : '');
          }
          
          if (team2.group1) {
            const group1Members = team2.group1.split('\n').filter(line => line.trim());
            console.log('1조 (일요일 지원근무):', group1Members.length, '명');
            console.log('  - 명단:', group1Members.slice(0, 5).join(', '), group1Members.length > 5 ? '...' : '');
          }
        }
        
        if (workSchedule.weekendSchedule.team3) {
          console.log('\n--- 보안3팀 조별 편성 ---');
          const team3 = workSchedule.weekendSchedule.team3;
          
          if (team3.aGroup) {
            const aGroupMembers = team3.aGroup.split('\n').filter(line => line.trim());
            console.log('A조 (일요일 주간근무):', aGroupMembers.length, '명');
            console.log('  - 명단:', aGroupMembers.slice(0, 5).join(', '), aGroupMembers.length > 5 ? '...' : '');
          }
          
          if (team3.group1) {
            const group1Members = team3.group1.split('\n').filter(line => line.trim());
            console.log('1조 (일요일 지원근무):', group1Members.length, '명');
            console.log('  - 명단:', group1Members.slice(0, 5).join(', '), group1Members.length > 5 ? '...' : '');
          }
        }
      }
      
      // 이번주 평일 근무 형태
      if (workSchedule.currentWeekSchedule) {
        console.log('\n=== 이번주 평일 근무 형태 ===');
        console.log('1팀:', workSchedule.currentWeekSchedule.team1);
        console.log('2팀:', workSchedule.currentWeekSchedule.team2);
        console.log('3팀:', workSchedule.currentWeekSchedule.team3);
      }
      
    } else {
      console.log('해당 주차의 근무 스케줄이 없습니다.');
      
      // 스케줄이 없는 경우 기본 규칙으로 예측
      console.log('\n=== 기본 규칙으로 예측 ===');
      console.log('8월 23일은 8월 19일 주차에 속합니다.');
      console.log('사이클 주차:', cycleWeek);
      
      if (cycleWeek === 0) { // 1주차: 1팀 주간, 2팀 초야, 3팀 심야
        console.log('\n--- 토요일 근무 예측 ---');
        console.log('주간근무: 보안2팀 (초야조에서)');
        console.log('야간근무: 보안3팀 (심야조에서)');
        console.log('휴무: 보안1팀 (주간조에서)');
        
        console.log('\n--- 지원조 예측 ---');
        console.log('주간근무 지원조: 보안2팀 1조 (10명)');
        console.log('야간근무 지원조: 보안3팀 1조 (10명)');
      }
    }
    
  } catch (error) {
    console.error('조회 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
