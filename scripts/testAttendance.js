const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const Employee = require('../models/Employee');

async function testAttendance() {
  try {
    console.log('근태 데이터 테스트 시작...');
    
    // 직원 조회
    const employees = await Employee.find().limit(3);
    if (employees.length === 0) {
      console.log('직원이 없습니다. 먼저 직원을 생성해주세요.');
      return;
    }
    
    console.log(`테스트할 직원 수: ${employees.length}`);
    
    // 테스트 날짜
    const testDate = '2025-01-27';
    
    // 각 직원에 대해 다양한 근태 데이터 추가
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const attendanceData = {};
      
      // 다양한 근태 상태 테스트
      switch (i) {
        case 0: // 첫 번째 직원: 출근(주)
          attendanceData[testDate] = {
            status: '출근(주)',
            checkIn: '06:00',
            checkOut: '14:00',
            basic: '8',
            overtime: '2',
            special: '0',
            specialOvertime: '0',
            night: '0',
            totalTime: '11.0',
            note: '정상 출근',
            updatedAt: new Date()
          };
          break;
          
        case 1: // 두 번째 직원: 월차휴가
          attendanceData[testDate] = {
            status: '월차휴가',
            checkIn: '',
            checkOut: '',
            basic: '8',
            overtime: '',
            special: '',
            specialOvertime: '',
            night: '',
            totalTime: '8.0',
            note: '월차 사용',
            updatedAt: new Date()
          };
          break;
          
        case 2: // 세 번째 직원: 반차
          attendanceData[testDate] = {
            status: '반차',
            checkIn: '09:00',
            checkOut: '13:00',
            basic: '4',
            overtime: '',
            special: '',
            specialOvertime: '',
            night: '',
            totalTime: '4.0',
            note: '오후 반차',
            updatedAt: new Date()
          };
          break;
      }
      
      // 근태 데이터 업데이트
      await Employee.findByIdAndUpdate(employee._id, {
        $set: { attendance: attendanceData }
      });
      
      console.log(`${employee.name}의 ${testDate} 근태 데이터 추가 완료: ${attendanceData[testDate].status}`);
    }
    
    console.log('\n=== 테스트 데이터 추가 완료 ===');
    console.log(`테스트 날짜: ${testDate}`);
    
    // 추가된 데이터 확인
    console.log('\n=== 저장된 데이터 확인 ===');
    const updatedEmployees = await Employee.find({}, {
      name: 1,
      [`attendance.${testDate}`]: 1
    });
    
    updatedEmployees.forEach(emp => {
      if (emp.attendance && emp.attendance[testDate]) {
        const data = emp.attendance[testDate];
        console.log(`${emp.name}: ${data.status} - 기본:${data.basic}, 총시간:${data.totalTime}, 비고:${data.note}`);
      }
    });
    
    console.log('\n테스트 완료! 이제 브라우저에서 근태관리페이지를 열고 해당 날짜를 조회해보세요.');
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAttendance();
