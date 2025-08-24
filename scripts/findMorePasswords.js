/**
 * 파일명: findMorePasswords.js
 * 목적: 더 많은 비밀번호 패턴으로 시도
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

const findMorePasswords = async () => {
  try {
    await connectDB();
    
    console.log('=== 추가 비밀번호 찾기 테스트 ===\n');
    
    // 더 많은 비밀번호 패턴들
    const morePasswords = [
      // 사용자명 기반
      'ooo', 'qqq', 'manager', 'aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg',
      'lll', 'mmm', 'hong', '언양홍', 'employee1', 'employee2', 'employee3',
      'manager1', 'manager2', 'manager3',
      
      // 숫자 조합
      '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
      '00000', '11111', '22222', '33333', '44444', '55555', '66666', '77777', '88888', '99999',
      
      // 연도
      '2020', '2021', '2022', '2023', '2024', '2025',
      
      // 간단한 조합
      '123', '321', '456', '654', '789', '987',
      'abc', 'cba', 'def', 'fed', 'ghi', 'ihg',
      
      // 특수문자 포함
      '123!', '!123', '123@', '@123', '123#', '#123',
      'abc!', '!abc', 'abc@', '@abc', 'abc#', '#abc',
      
      // 대소문자
      'Admin', 'ADMIN', 'admin', 'Manager', 'MANAGER', 'manager',
      'User', 'USER', 'user', 'Employee', 'EMPLOYEE', 'employee',
      
      // 사용자명 + 숫자
      'ooo1', 'ooo2', 'ooo3', 'qqq1', 'qqq2', 'qqq3',
      'manager1', 'manager2', 'manager3', 'aaa1', 'aaa2', 'aaa3',
      
      // 사용자명 + 연도
      'ooo2024', 'ooo2025', 'qqq2024', 'qqq2025',
      'manager2024', 'manager2025', 'aaa2024', 'aaa2025',
      
      // 기타
      'password123', 'pass123', 'secret', 'test123', 'demo123',
      'welcome', 'hello', 'hi', 'bye', 'goodbye'
    ];
    
    // 아직 비밀번호를 찾지 못한 계정들
    const remainingAccounts = [
      'admin', 'qqq', 'manager', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg',
      'lll', 'mmm', 'hong', '언양홍', 'employee1', 'employee2', 'employee3',
      'manager1', 'manager2', 'manager3'
    ];
    
    for (const username of remainingAccounts) {
      console.log(`\n🔍 ${username} 계정 비밀번호 찾는 중...`);
      
      const user = await User.findOne({ username });
      if (!user) {
        console.log(`   ❌ 사용자를 찾을 수 없음`);
        continue;
      }
      
      let found = false;
      
      for (const password of morePasswords) {
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
        console.log(`   ❌ 추가 패턴으로도 찾을 수 없음`);
      }
    }
    
  } catch (error) {
    console.error('추가 비밀번호 찾기 오류:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB 연결 종료됨');
  }
};

findMorePasswords();
