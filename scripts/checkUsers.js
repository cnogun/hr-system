const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkUsers() {
  try {
    console.log('=== 사용자 계정 확인 ===\n');
    
    // 전체 사용자 조회
    const users = await User.find({}).select('username email role createdAt');
    
    if (users.length === 0) {
      console.log('사용자 계정이 없습니다.');
    } else {
      console.log(`총 ${users.length}명의 사용자가 있습니다.\n`);
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} | ${user.email} | ${user.role} | ${user.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('사용자 확인 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkUsers();
