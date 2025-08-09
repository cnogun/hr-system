/**
 * 파일명: checkAdmin.js
 * 목적: 데이터베이스에 있는 관리자 계정 확인
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 모든 사용자 계정 조회
    const users = await User.find({});
    console.log('\n=== 데이터베이스에 있는 사용자 계정 ===');
    
    if (users.length === 0) {
      console.log('사용자 계정이 없습니다.');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. 사용자명: ${user.username}`);
        console.log(`   이메일: ${user.email}`);
        console.log(`   역할: ${user.role}`);
        console.log(`   이름: ${user.name}`);
        console.log(`   비밀번호 해시: ${user.password}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('사용자 조회 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('데이터베이스 연결 종료');
  }
}); 