const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createSimpleAdmin() {
  try {
    console.log('=== 간단한 관리자 계정 생성 ===\n');
    
    // 기존 관리자 계정 확인
    let admin = await User.findOne({ role: 'admin' });
    if (admin) {
      console.log(`관리자 계정이 이미 존재합니다: ${admin.username} (${admin.email})`);
      return admin;
    }
    
    // 새 관리자 계정 생성
    const plainPassword = 'admin123!';
    const hash = await bcrypt.hash(plainPassword, 10);
    
    admin = await User.create({
      username: 'admin',
      password: hash,
      email: 'admin@test.com',
      role: 'admin',
      profileImage: '',
      name: '테스트관리자'
    });
    
    console.log('관리자 계정 생성 완료:');
    console.log(`- username: ${admin.username}`);
    console.log(`- email: ${admin.email}`);
    console.log(`- password: ${plainPassword}`);
    console.log(`- role: ${admin.role}`);
    
    return admin;
    
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
    return null;
  }
}

// 스크립트 실행
createSimpleAdmin().then(() => {
  mongoose.connection.close();
});
