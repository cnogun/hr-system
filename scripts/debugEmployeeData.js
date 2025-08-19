const mongoose = require('mongoose');
require('dotenv').config();

// 모델 import
const Employee = require('../models/Employee');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 보안1팀 첫 번째 직원의 전체 데이터 구조 확인
    const firstEmployee = await Employee.findOne({ department: '보안1팀' });
    
    if (firstEmployee) {
      console.log('=== 첫 번째 보안1팀 직원 데이터 구조 ===');
      console.log('전체 객체:', JSON.stringify(firstEmployee, null, 2));
      console.log('\n=== 주요 필드들 ===');
      console.log('_id:', firstEmployee._id);
      console.log('name:', firstEmployee.name);
      console.log('department:', firstEmployee.department);
      console.log('employeeNumber:', firstEmployee.employeeNumber);
      console.log('empNo:', firstEmployee.empNo);
      console.log('weekendAssignment:', firstEmployee.weekendAssignment);
      
      // weekendAssignment의 구조 확인
      if (firstEmployee.weekendAssignment) {
        console.log('\n=== weekendAssignment 구조 ===');
        console.log('type:', typeof firstEmployee.weekendAssignment);
        console.log('keys:', Object.keys(firstEmployee.weekendAssignment));
        console.log('group:', firstEmployee.weekendAssignment.group);
        console.log('weekendGroup:', firstEmployee.weekendAssignment.weekendGroup);
        console.log('sundayGroup:', firstEmployee.weekendAssignment.sundayGroup);
      }
    } else {
      console.log('보안1팀 직원을 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('데이터 조회 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
