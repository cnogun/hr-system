/**
 * 파일명: testData.js
 * 목적: career와 specialNotes 데이터 확인
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 최근 5명의 직원 데이터 확인
    const employees = await Employee.find({}).limit(5).select('name career specialNotes profileImage');
    
    console.log('\n=== 직원 데이터 확인 ===');
    employees.forEach((emp, index) => {
      console.log(`\n${index + 1}. ${emp.name}:`);
      console.log(`   - career: "${emp.career}"`);
      console.log(`   - specialNotes: "${emp.specialNotes}"`);
      console.log(`   - profileImage: "${emp.profileImage}"`);
    });
    
    // career와 specialNotes가 있는 직원 수 확인
    const withCareer = await Employee.countDocuments({ career: { $exists: true, $ne: '' } });
    const withSpecialNotes = await Employee.countDocuments({ specialNotes: { $exists: true, $ne: '' } });
    
    console.log(`\n=== 통계 ===`);
    console.log(`- career가 있는 직원: ${withCareer}명`);
    console.log(`- specialNotes가 있는 직원: ${withSpecialNotes}명`);
    
  } catch (error) {
    console.error('데이터 확인 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('데이터베이스 연결 종료');
  }
});
