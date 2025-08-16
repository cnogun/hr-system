const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const Employee = require('../models/Employee');

async function debugAttendance() {
  try {
    console.log('근태 데이터 디버그 시작...');
    
    // 전체 직원 조회
    const employees = await Employee.find({});
    console.log(`총 직원 수: ${employees.length}명`);
    
    // 첫 번째 직원의 전체 데이터 확인
    if (employees.length > 0) {
      const firstEmployee = employees[0];
      console.log('\n=== 첫 번째 직원 데이터 ===');
      console.log('ID:', firstEmployee._id);
      console.log('이름:', firstEmployee.name);
      console.log('attendance 필드:', firstEmployee.attendance);
      console.log('attendance 타입:', typeof firstEmployee.attendance);
      
      if (firstEmployee.attendance) {
        console.log('attendance 키들:', Object.keys(firstEmployee.attendance));
        
        // 2025-01-27 데이터 확인
        const testDate = '2025-01-27';
        if (firstEmployee.attendance[testDate]) {
          console.log(`\n${testDate} 데이터:`, firstEmployee.attendance[testDate]);
        } else {
          console.log(`\n${testDate} 데이터가 없습니다.`);
        }
      }
    }
    
    // attendance 필드가 있는 직원 찾기
    const employeesWithAttendance = await Employee.find({
      'attendance.2025-01-27': { $exists: true }
    });
    
    console.log(`\n=== 2025-01-27 데이터가 있는 직원 수 ===`);
    console.log(`${employeesWithAttendance.length}명`);
    
    if (employeesWithAttendance.length > 0) {
      employeesWithAttendance.forEach(emp => {
        console.log(`\n${emp.name}:`, emp.attendance['2025-01-27']);
      });
    }
    
  } catch (error) {
    console.error('디버그 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugAttendance();
