const mongoose = require('mongoose');
const Employee = require('../models/Employee');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testTeam2Attendance() {
  try {
    console.log('=== 2팀 근무 로직 테스트 ===\n');
    
    // 2팀 직원 조회
    const team2Employees = await Employee.find({ 
      department: '보안2팀',
      status: '재직'
    }).sort({ name: 1 });
    
    console.log(`2팀 총 인원: ${team2Employees.length}명\n`);
    
    // 각 직원별 조 분류 및 근무 로직 테스트
    team2Employees.forEach((emp, index) => {
      const totalMembers = team2Employees.length;
      const membersPerGroup = Math.ceil(totalMembers / 4);
      
      let teamGroup = '';
      let teamWeekendGroup = '';
      
      if (index < membersPerGroup) {
        teamGroup = '1조';
        teamWeekendGroup = '1조';
      } else if (index < membersPerGroup * 2) {
        teamGroup = '2조';
        teamWeekendGroup = 'none';
      } else if (index < membersPerGroup * 3) {
        teamGroup = '3조';
        teamWeekendGroup = 'none';
      } else {
        teamGroup = '4조';
        teamWeekendGroup = 'none';
      }
      
      // 토요일 근무 로직 테스트 (평일 근무형태에 따라)
      let saturdayStatus = '';
      let saturdayNote = '';
      
      // 39주차 기준: 보안2팀은 주간팀
      const team2Schedule = '주간';
      
      if (team2Schedule === '주간') {
        // 주간팀일 때: 정기휴무
        saturdayStatus = '정기휴무';
        saturdayNote = '토요일 정기휴무';
      } else if (team2Schedule === '초야') {
        // 초야팀일 때: 1~30번 주간특근, 31~40번 정기휴무
        if (index < 30) {
          saturdayStatus = '출근(주특)';
          saturdayNote = '토요일 주간특근';
        } else {
          saturdayStatus = '정기휴무';
          saturdayNote = '토요일 정기휴무';
        }
      } else if (team2Schedule === '심야') {
        // 심야팀일 때: 1~30번 야간특근, 31~40번 정기휴무
        if (index < 30) {
          saturdayStatus = '출근(야특)';
          saturdayNote = '토요일 야간특근';
        } else {
          saturdayStatus = '정기휴무';
          saturdayNote = '토요일 정기휴무';
        }
      }
      
      // 일요일 근무 로직 테스트
      let sundayStatus = '';
      let sundayNote = '';
      
      if (teamWeekendGroup === '1조') {
        sundayStatus = '출근(야특)';
        sundayNote = '일요일 야간특근';
      } else {
        sundayStatus = '정기휴무';
        sundayNote = '정기 휴무';
      }
      
      console.log(`${emp.name.padEnd(15)} | ${teamGroup.padEnd(5)} | ${teamWeekendGroup.padEnd(8)} | 토요일: ${saturdayStatus.padEnd(12)} | 일요일: ${sundayStatus.padEnd(12)}`);
    });
    
    console.log('\n=== 주말 근무 요약 ===');
    console.log('39주차 보안2팀 (주간팀): 토요일 전체 정기휴무');
    console.log('- 평일 주간근무 후 토요일 정기휴무 규칙 적용');
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

testTeam2Attendance();
