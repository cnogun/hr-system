/**
 * 파일명: resetAndCreateAdmin.js
 * 목적: 기존 사용자 데이터 삭제 후 새로운 관리자 계정 생성
 * 작성자: AI Assistant
 * 작성일: 2025-01-27
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// MongoDB 연결
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/hr_system');
    console.log('MongoDB 연결 성공!');
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

const resetAndCreateAdmin = async () => {
  try {
    await connectDB();
    
    console.log('=== 사용자 데이터 초기화 및 관리자 계정 생성 ===\n');
    
    // 1단계: 기존 사용자 데이터 삭제
    console.log('1️⃣ 기존 사용자 데이터 삭제 중...');
    const deleteResult = await User.deleteMany({});
    console.log(`   삭제된 사용자 수: ${deleteResult.deletedCount}명`);
    
    // 2단계: 새로운 관리자 계정 생성
    console.log('\n2️⃣ 새로운 관리자 계정 생성 중...');
    const adminPassword = 'admin123';
    const hash = await bcrypt.hash(adminPassword, 10);
    
    const admin = await User.create({
      username: 'admin',
      password: hash,
      email: 'admin@company.com',
      role: 'admin',
      profileImage: ''
    });
    
    console.log('   ✅ 관리자 계정 생성 완료!');
    console.log(`   사용자명: ${admin.username}`);
    console.log(`   이메일: ${admin.email}`);
    console.log(`   역할: ${admin.role}`);
    console.log(`   비밀번호: ${adminPassword}`);
    
    // 3단계: 테스트용 일반 사용자 계정 생성
    console.log('\n3️⃣ 테스트용 일반 사용자 계정 생성 중...');
    const userPassword = 'user123';
    const userHash = await bcrypt.hash(userPassword, 10);
    
    const user = await User.create({
      username: 'user',
      password: userHash,
      email: 'user@company.com',
      role: 'user',
      profileImage: ''
    });
    
    console.log('   ✅ 일반 사용자 계정 생성 완료!');
    console.log(`   사용자명: ${user.username}`);
    console.log(`   비밀번호: ${userPassword}`);
    
    // 4단계: 최종 확인
    console.log('\n4️⃣ 최종 확인...');
    const totalUsers = await User.countDocuments();
    console.log(`   총 사용자 수: ${totalUsers}명`);
    
    console.log('\n🎉 초기화 완료!');
    console.log('\n📋 로그인 정보:');
    console.log('   관리자: admin / admin123');
    console.log('   일반사용자: user / user123');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB 연결 종료됨');
  }
};

resetAndCreateAdmin();
