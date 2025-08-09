/**
 * 파일명: fixAdminPassword.js
 * 목적: 관리자 계정 비밀번호를 admin123으로 재설정
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 관리자 계정 찾기
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      // 관리자 계정이 없으면 새로 생성
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = await User.create({
        username: 'admin',
        email: 'admin@company.com',
        password: hashedPassword,
        role: 'admin',
        name: '관리자'
      });
      console.log('관리자 계정 생성 완료');
    } else {
      // 기존 관리자 계정의 비밀번호를 admin123으로 변경
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser.password = hashedPassword;
      await adminUser.save();
      console.log('관리자 계정 비밀번호 변경 완료');
    }
    
    console.log('\n=== 관리자 계정 정보 ===');
    console.log('아이디:', adminUser.username);
    console.log('이메일:', adminUser.email);
    console.log('비밀번호: admin123');
    console.log('역할:', adminUser.role);
    console.log('이름:', adminUser.name);
    
    console.log('\n로그인 정보:');
    console.log('아이디: admin');
    console.log('비밀번호: admin123');
    
  } catch (error) {
    console.error('관리자 계정 수정 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('데이터베이스 연결 종료');
  }
}); 