const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 성공!');
    return true;
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    return false;
  }
}

// WorkSchedule 모델 테스트
async function testWorkSchedule() {
  try {
    const WorkSchedule = require('../models/WorkSchedule');
    console.log('✅ WorkSchedule 모델 로드 성공');
    
    // 스키마 정보 확인
    console.log('📋 WorkSchedule 스키마 구조:');
    console.log('- weekendSchedule:', WorkSchedule.schema.paths.weekendSchedule);
    console.log('- team1:', WorkSchedule.schema.paths['weekendSchedule.team1']);
    console.log('- team2:', WorkSchedule.schema.paths['weekendSchedule.team2']);
    console.log('- team3:', WorkSchedule.schema.paths['weekendSchedule.team3']);
    
    return true;
  } catch (error) {
    console.error('❌ WorkSchedule 모델 로드 실패:', error.message);
    return false;
  }
}

// Employee 모델 테스트
async function testEmployee() {
  try {
    const Employee = require('../models/Employee');
    console.log('✅ Employee 모델 로드 성공');
    
    // 스키마 정보 확인
    console.log('📋 Employee 스키마 구조:');
    console.log('- weekendAssignment:', Employee.schema.paths.weekendAssignment);
    
    return true;
  } catch (error) {
    console.error('❌ Employee 모델 로드 실패:', error.message);
    return false;
  }
}

// 데이터베이스 컬렉션 상태 확인
async function checkCollections() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 데이터베이스 컬렉션 목록:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // WorkSchedule 컬렉션 문서 수 확인
    const WorkSchedule = require('../models/WorkSchedule');
    const count = await WorkSchedule.countDocuments();
    console.log(`📊 WorkSchedule 문서 수: ${count}`);
    
    // Employee 컬렉션 문서 수 확인
    const Employee = require('../models/Employee');
    const empCount = await Employee.countDocuments();
    console.log(`📊 Employee 문서 수: ${empCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ 컬렉션 확인 실패:', error.message);
    return false;
  }
}

// 메인 테스트 실행
async function runTests() {
  console.log('🔍 데이터베이스 진단 시작...\n');
  
  // 1. MongoDB 연결 테스트
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.log('❌ 데이터베이스 연결 실패로 테스트 중단');
    process.exit(1);
  }
  
  console.log('');
  
  // 2. 모델 로드 테스트
  const workScheduleOK = await testWorkSchedule();
  const employeeOK = await testEmployee();
  
  console.log('');
  
  // 3. 컬렉션 상태 확인
  const collectionsOK = await checkCollections();
  
  console.log('');
  
  // 4. 결과 요약
  console.log('📋 진단 결과 요약:');
  console.log(`  - MongoDB 연결: ${dbConnected ? '✅' : '❌'}`);
  console.log(`  - WorkSchedule 모델: ${workScheduleOK ? '✅' : '❌'}`);
  console.log(`  - Employee 모델: ${employeeOK ? '✅' : '❌'}`);
  console.log(`  - 컬렉션 상태: ${collectionsOK ? '✅' : '❌'}`);
  
  if (dbConnected && workScheduleOK && employeeOK && collectionsOK) {
    console.log('\n🎉 모든 테스트 통과! 데이터베이스 상태 정상');
  } else {
    console.log('\n⚠️ 일부 테스트 실패. 문제가 있을 수 있습니다.');
  }
  
  // 연결 종료
  await mongoose.connection.close();
  console.log('\n🔌 MongoDB 연결 종료');
}

// 에러 핸들링
process.on('unhandledRejection', (error) => {
  console.error('❌ 처리되지 않은 Promise 거부:', error);
  process.exit(1);
});

// 테스트 실행
runTests().catch(console.error);
