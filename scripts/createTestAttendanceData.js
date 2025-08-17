/**
 * 파일명: createTestAttendanceData.js
 * 목적: 테스트용 근태 데이터 생성
 * 기능: MongoDB에 가상의 근태 데이터를 생성하여 월간 근태현황 테스트
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/curTest', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Employee = require('../models/Employee');

// 테스트용 근태 데이터 생성 함수
async function createTestAttendanceData() {
  try {
    console.log('테스트용 근태 데이터 생성을 시작합니다...');

    // 재직 중인 직원 조회
    const employees = await Employee.find({ status: '재직' });
    
    if (employees.length === 0) {
      console.log('재직 중인 직원이 없습니다. 먼저 직원을 생성해주세요.');
      return;
    }

    console.log(`총 ${employees.length}명의 직원을 찾았습니다.`);

    // 2025년 7월과 8월에 대한 테스트 데이터 생성
    const testMonths = [
      { year: 2025, month: 7, daysInMonth: 31 },
      { year: 2025, month: 8, daysInMonth: 31 }
    ];

    for (const testMonth of testMonths) {
      console.log(`\n${testMonth.year}년 ${testMonth.month}월 테스트 데이터 생성 중...`);

      for (const employee of employees) {
        const attendance = employee.attendance || new Map();

        for (let day = 1; day <= testMonth.daysInMonth; day++) {
          const dateStr = `${testMonth.year}-${testMonth.month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          // 주말(토,일)은 휴가로 설정
          const date = new Date(dateStr);
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          if (isWeekend) {
            // 주말 데이터
            attendance.set(dateStr, {
              status: '휴가',
              checkIn: '',
              checkOut: '',
              basic: '0',
              overtime: '0',
              special: '0',
              specialOvertime: '0',
              night: '0',
              totalTime: '0',
              note: '주말 휴가'
            });
          } else {
            // 평일 데이터 - 랜덤하게 생성
            const randomStatus = ['출근주', '출근심', '출근초', '반차'][Math.floor(Math.random() * 4)];
            const randomBasic = (Math.random() * 2 + 7).toFixed(1); // 7-9시간
            const randomOvertime = (Math.random() * 2).toFixed(1); // 0-2시간
            const randomSpecial = (Math.random() * 1).toFixed(1); // 0-1시간
            const randomSpecialOvertime = (Math.random() * 1).toFixed(1); // 0-1시간
            const randomNight = (Math.random() * 1).toFixed(1); // 0-1시간
            const totalTime = (parseFloat(randomBasic) + parseFloat(randomOvertime) + parseFloat(randomSpecial) + parseFloat(randomSpecialOvertime) + parseFloat(randomNight)).toFixed(1);

            attendance.set(dateStr, {
              status: randomStatus,
              checkIn: `09:${Math.floor(Math.random() * 10)}`,
              checkOut: `18:${Math.floor(Math.random() * 10)}`,
              basic: randomBasic,
              overtime: randomOvertime,
              special: randomSpecial,
              specialOvertime: randomSpecialOvertime,
              night: randomNight,
              totalTime: totalTime,
              note: `테스트 데이터 - ${randomStatus}`
            });
          }
        }

        // 직원 데이터 업데이트
        employee.attendance = attendance;
        await employee.save();
        
        console.log(`  - ${employee.name}: ${testMonth.daysInMonth}일치 데이터 생성 완료`);
      }
    }

    console.log('\n✅ 모든 테스트 데이터 생성이 완료되었습니다!');
    console.log('\n생성된 데이터:');
    console.log('- 2025년 7월: 31일치');
    console.log('- 2025년 8월: 31일치');
    console.log('- 각 직원별로 평일/주말 구분하여 데이터 생성');
    console.log('- 평일: 출근주/출근심/출근초/반차 중 랜덤 선택');
    console.log('- 주말: 휴가로 설정');

  } catch (error) {
    console.error('테스트 데이터 생성 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결을 종료합니다.');
  }
}

// 스크립트 실행
createTestAttendanceData();
