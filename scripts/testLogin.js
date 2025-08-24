/**
 * 파일명: testLogin.js
 * 목적: 여러 계정으로 로그인 테스트
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

const testLogin = async () => {
  try {
    await connectDB();
    
    console.log('=== 로그인 테스트 ===\n');
    
    // 테스트할 계정들
    const testAccounts = [
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: '123456' },
      { username: 'admin', password: 'password' },
      { username: 'ooo', password: 'ooo' },
      { username: 'qqq', password: 'qqq' },
      { username: 'manager', password: 'manager' },
      { username: 'aaa', password: 'aaa' }
    ];
    
    for (const account of testAccounts) {
      try {
        const user = await User.findOne({ username: account.username });
        
        if (!user) {
          console.log(`❌ ${account.username}: 사용자를 찾을 수 없음`);
          continue;
        }
        
        const isMatch = await bcrypt.compare(account.password, user.password);
        
        if (isMatch) {
          console.log(`✅ ${account.username}:${account.password} - 로그인 성공!`);
          console.log(`   역할: ${user.role}`);
          console.log(`   이메일: ${user.email}`);
        } else {
          console.log(`❌ ${account.username}:${account.password} - 비밀번호 불일치`);
        }
        
      } catch (error) {
        console.log(`❌ ${account.username}:${account.password} - 오류: ${error.message}`);
      }
      
      console.log('   ---');
    }
    
  } catch (error) {
    console.error('로그인 테스트 오류:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB 연결 종료됨');
  }
};

testLogin();
