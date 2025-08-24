/**
 * 파일명: checkUserPassword.js
 * 목적: 사용자 비밀번호 해시 확인
 * 작성자: AI Assistant
 * 작성일: 2025-01-27
 */

const mongoose = require('mongoose');
const User = require('../models/User');

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

const checkUserPassword = async () => {
  try {
    await connectDB();
    
    console.log('=== 사용자 비밀번호 확인 ===\n');
    
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('사용자가 없습니다.');
      return;
    }
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. 사용자명: ${user.username}`);
      console.log(`   이메일: ${user.email}`);
      console.log(`   역할: ${user.role}`);
      console.log(`   비밀번호 해시: ${user.password}`);
      console.log(`   비밀번호 길이: ${user.password ? user.password.length : 0}`);
      console.log(`   생성일: ${user.createdAt}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('사용자 확인 오류:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB 연결 종료됨');
  }
};

checkUserPassword();
