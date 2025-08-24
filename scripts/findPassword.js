/**
 * 파일명: findPassword.js
 * 목적: 일반적인 비밀번호들로 로그인 시도
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

const findPassword = async () => {
  try {
    await connectDB();
    
    console.log('=== 비밀번호 찾기 테스트 ===\n');
    
    // 일반적으로 사용되는 비밀번호들
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      '12345', '1234', '111111', '1234567', 'dragon',
      '123123', 'baseball', 'abc123', 'football', 'monkey',
      'letmein', 'shadow', 'master', '666666', 'qwertyuiop',
      '123321', 'mustang', '1234567890', 'michael', '654321',
      'superman', '1qaz2wsx', '7777777', '121212', '000000',
      'qazwsx', '123qwe', 'killer', 'trustno1', 'jordan',
      'jennifer', 'zxcvbnm', 'asdfgh', 'hunter', 'buster',
      'soccer', 'harley', 'batman', 'andrew', 'tigger',
      'sunshine', 'iloveyou', 'fuckme', '2000', 'charlie',
      'robert', 'thomas', 'hockey', 'ranger', 'daniel',
      'starwars', 'klaster', '112233', 'george', 'computer',
      'michelle', 'jessica', 'pepper', '1111', 'zxcvbn',
      '555555', '11111111', '131313', 'freedom', '777777',
      'pass', 'maggie', '159753', 'aaaaaa', 'ginger',
      'princess', 'joshua', 'cheese', 'amanda', 'summer',
      'love', 'ashley', 'nicole', 'chelsea', 'biteme',
      'matthew', 'access', 'yankees', '987654321', 'dallas',
      'austin', 'thunder', 'taylor', 'matrix', 'mobile',
      'admin', 'admin123', 'root', 'toor', 'test',
      'guest', 'user', 'demo', 'sample', 'temp'
    ];
    
    // 테스트할 계정들
    const testAccounts = [
      'admin', 'ooo', 'qqq', 'manager', 'aaa'
    ];
    
    for (const username of testAccounts) {
      console.log(`\n🔍 ${username} 계정 비밀번호 찾는 중...`);
      
      const user = await User.findOne({ username });
      if (!user) {
        console.log(`   ❌ 사용자를 찾을 수 없음`);
        continue;
      }
      
      let found = false;
      
      for (const password of commonPasswords) {
        try {
          const isMatch = await bcrypt.compare(password, user.password);
          
          if (isMatch) {
            console.log(`   ✅ 비밀번호 발견: ${password}`);
            console.log(`      역할: ${user.role}`);
            console.log(`      이메일: ${user.email}`);
            found = true;
            break;
          }
        } catch (error) {
          // 오류 무시하고 계속 진행
        }
      }
      
      if (!found) {
        console.log(`   ❌ 일반적인 비밀번호로는 찾을 수 없음`);
      }
    }
    
  } catch (error) {
    console.error('비밀번호 찾기 오류:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB 연결 종료됨');
  }
};

findPassword();
