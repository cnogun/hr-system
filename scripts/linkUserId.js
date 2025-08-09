/**
 * 파일명: linkUserId.js
 * 목적: 직원과 사용자 계정 연결
 * 기능:
 * - 직원 정보와 사용자 계정 매핑
 * - 이메일 기반 연결
 * - 중복 연결 방지
 * - 데이터베이스 관계 설정
 */
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');

async function linkUserIds() {
  await mongoose.connect('mongodb://localhost:27017/hr_system', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const employees = await Employee.find();
  let updated = 0;
  for (const emp of employees) {
    if (!emp.userId && emp.email) {
      const user = await User.findOne({ email: emp.email });
      if (user) {
        emp.userId = user._id;
        await emp.save();
        updated++;
        console.log(`Linked: ${emp.name} (${emp.email}) → ${user._id}`);
      }
    }
  }
  console.log(`총 ${updated}명의 직원 userId가 연결되었습니다.`);
  mongoose.disconnect();
}

linkUserIds(); 