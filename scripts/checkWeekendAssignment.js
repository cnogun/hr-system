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
    // 보안팀 직원들만 조회
    const securityEmployees = await Employee.find({
      department: { $in: ['보안1팀', '보안2팀', '보안3팀'] }
    }).sort({ department: 1, employeeNumber: 1 });

    console.log(`총 ${securityEmployees.length}명의 보안팀 직원 조회 완료\n`);

    // 팀별로 그룹화
    const team1 = securityEmployees.filter(emp => emp.department === '보안1팀');
    const team2 = securityEmployees.filter(emp => emp.department === '보안2팀');
    const team3 = securityEmployees.filter(emp => emp.department === '보안3팀');

    console.log('=== 보안1팀 주말 근무 할당 현황 ===');
    team1.forEach((emp, index) => {
      const assignment = emp.weekendAssignment;
      console.log(`${emp.name}: 그룹=${assignment.group}, 일요일그룹=${assignment.sundayGroup}`);
    });

    console.log('\n=== 보안2팀 주말 근무 할당 현황 ===');
    team2.forEach((emp, index) => {
      const assignment = emp.weekendAssignment;
      console.log(`${emp.name}: 그룹=${assignment.group}, 일요일그룹=${assignment.sundayGroup}`);
    });

    console.log('\n=== 보안3팀 주말 근무 할당 현황 ===');
    team3.forEach((emp, index) => {
      const assignment = emp.weekendAssignment;
      console.log(`${emp.name}: 주말그룹=${assignment.weekendGroup}`);
    });

    // 통계 요약
    console.log('\n=== 주말 근무 할당 통계 ===');
    
    const oneFourthCount = securityEmployees.filter(emp => emp.weekendAssignment.group === '1/4').length;
    const threeFourthCount = securityEmployees.filter(emp => emp.weekendAssignment.group === '3/4').length;
    const noAssignmentCount = securityEmployees.filter(emp => emp.weekendAssignment.group === 'none').length;
    
    const aGroupCount = securityEmployees.filter(emp => emp.weekendAssignment.weekendGroup === 'A조').length;
    const bGroupCount = securityEmployees.filter(emp => emp.weekendAssignment.weekendGroup === 'B조').length;
    
    const sunday1GroupCount = securityEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '1조').length;
    const sunday2GroupCount = securityEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '2조').length;
    const sunday3GroupCount = securityEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '3조').length;
    const sunday4GroupCount = securityEmployees.filter(emp => emp.weekendAssignment.sundayGroup === '4조').length;
    
    console.log(`1/4 할당: ${oneFourthCount}명`);
    console.log(`3/4 할당: ${threeFourthCount}명`);
    console.log(`할당 없음: ${noAssignmentCount}명`);
    console.log(`A조 (토요일 휴무): ${aGroupCount}명`);
    console.log(`B조 (토요일 휴무): ${bGroupCount}명`);
    console.log(`1조: ${sunday1GroupCount}명`);
    console.log(`2조: ${sunday2GroupCount}명`);
    console.log(`3조: ${sunday3GroupCount}명`);
    console.log(`4조: ${sunday4GroupCount}명`);

  } catch (error) {
    console.error('데이터 조회 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
});
