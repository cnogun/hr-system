const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const Employee = require('../models/Employee');

async function checkAttendance() {
  try {
    console.log('근태 데이터 확인 시작...');
    
    const testDate = '2025-01-27';
    
    // 해당 날짜의 근태 데이터 조회
    const employees = await Employee.find({}, {
      name: 1,
      department: 1,
      position: 1,
      attendance: 1
    });
    
    console.log(`\n=== ${testDate} 근태 데이터 현황 ===`);
    
    let hasData = false;
    employees.forEach(emp => {
      if (emp.attendance && emp.attendance[testDate]) {
        hasData = true;
        const data = emp.attendance[testDate];
        console.log(`\n${emp.name} (${emp.department || '부서미정'}/${emp.position || '직급미정'})`);
        console.log(`  상태: ${data.status}`);
        console.log(`  출근시간: ${data.checkIn || '없음'}`);
        console.log(`  퇴근시간: ${data.checkOut || '없음'}`);
        console.log(`  기본시간: ${data.basic || '없음'}`);
        console.log(`  연장시간: ${data.overtime || '없음'}`);
        console.log(`  특근시간: ${data.special || '없음'}`);
        console.log(`  특근연장: ${data.specialOvertime || '없음'}`);
        console.log(`  야간시간: ${data.night || '없음'}`);
        console.log(`  총시간: ${data.totalTime || '없음'}`);
        console.log(`  비고: ${data.note || '없음'}`);
      }
    });
    
    if (!hasData) {
      console.log('해당 날짜에 근태 데이터가 없습니다.');
    }
    
    console.log('\n=== 전체 직원 수 ===');
    console.log(`총 직원 수: ${employees.length}명`);
    
  } catch (error) {
    console.error('데이터 확인 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAttendance();
