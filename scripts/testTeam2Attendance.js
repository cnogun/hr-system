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
      
      // 토요일 근무 로직 테스트 (1주차 기준)
      let saturdayStatus = '';
      let saturdayNote = '';
      
      if (teamGroup === '1조') {
        saturdayStatus = '정기휴무';
        saturdayNote = '토요일 휴무 (1조)';
      } else {
        saturdayStatus = '출근(야특)';
        saturdayNote = '토요일 야간특근';
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
    const membersPerGroup = Math.ceil(team2Employees.length / 4);
    const group1Members = team2Employees.slice(0, membersPerGroup);
    const otherGroupMembers = team2Employees.slice(membersPerGroup);
    
    console.log(`1조 (${group1Members.length}명): 토요일 휴무, 일요일 야간특근`);
    console.log(`2,3,4조 (${otherGroupMembers.length}명): 토요일 야간특근, 일요일 휴무`);
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

testTeam2Attendance();
