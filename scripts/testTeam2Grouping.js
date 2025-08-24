const mongoose = require('mongoose');
const Employee = require('../models/Employee');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testTeam2Grouping() {
  try {
    console.log('=== 2팀 조별 인원 분류 테스트 ===\n');
    
    // 2팀 직원 조회
    const team2Employees = await Employee.find({ 
      department: '보안2팀',
      status: '재직'
    }).sort({ name: 1 });
    
    console.log(`2팀 총 인원: ${team2Employees.length}명\n`);
    
    // 조별 인원 분류 로직 테스트
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
        teamWeekendGroup = '휴무조';
      } else if (index < membersPerGroup * 3) {
        teamGroup = '3조';
        teamWeekendGroup = '휴무조';
      } else {
        teamGroup = '4조';
        teamWeekendGroup = '휴무조';
      }
      
      console.log(`${emp.name.padEnd(15)} | ${teamGroup.padEnd(5)} | ${teamWeekendGroup.padEnd(8)} | ${emp.employeeNumber || '번호없음'}`);
    });
    
    console.log('\n=== 조별 인원 현황 ===');
    const membersPerGroup = Math.ceil(team2Employees.length / 4);
    console.log(`1조: ${Math.min(membersPerGroup, team2Employees.length)}명`);
    console.log(`2조: ${Math.min(membersPerGroup, Math.max(0, team2Employees.length - membersPerGroup))}명`);
    console.log(`3조: ${Math.min(membersPerGroup, Math.max(0, team2Employees.length - membersPerGroup * 2))}명`);
    console.log(`4조: ${Math.min(membersPerGroup, Math.max(0, team2Employees.length - membersPerGroup * 3))}명`);
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

testTeam2Grouping();
