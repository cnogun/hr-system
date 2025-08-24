const mongoose = require('mongoose');
const Employee = require('../models/Employee');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkTeam2Employees() {
  try {
    console.log('=== 2팀 직원 데이터 확인 ===\n');
    
    // 전체 직원 조회
    const allEmployees = await Employee.find({}).sort({ department: 1, name: 1 });
    
    console.log('=== 전체 직원 현황 ===');
    const departmentCounts = {};
    allEmployees.forEach(emp => {
      const dept = emp.department || '부서미정';
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    });
    
    Object.entries(departmentCounts).forEach(([dept, count]) => {
      console.log(`${dept}: ${count}명`);
    });
    
    console.log('\n=== 2팀 직원 상세 정보 ===');
    const team2Employees = allEmployees.filter(emp => emp.department === '보안2팀');
    
    if (team2Employees.length === 0) {
      console.log('보안2팀 직원이 없습니다.');
      
      // 보안2팀과 유사한 부서명이 있는지 확인
      const similarDepartments = allEmployees
        .map(emp => emp.department)
        .filter(dept => dept && dept.includes('2') || dept && dept.includes('2팀'))
        .filter((dept, index, arr) => arr.indexOf(dept) === index);
      
      if (similarDepartments.length > 0) {
        console.log('\n2팀과 유사한 부서명:');
        similarDepartments.forEach(dept => console.log(`- ${dept}`));
      }
    } else {
      team2Employees.forEach(emp => {
        console.log(`${emp.name} | ${emp.employeeNumber || '번호없음'} | ${emp.status || '상태없음'}`);
      });
    }
    
  } catch (error) {
    console.error('확인 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkTeam2Employees();
