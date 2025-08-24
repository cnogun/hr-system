const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createTestTeam2Employees() {
  try {
    console.log('=== 2팀 테스트 직원 데이터 생성 ===\n');
    
    // 기존 2팀 직원 삭제
    await Employee.deleteMany({ department: '보안2팀' });
    console.log('기존 2팀 직원 데이터 삭제 완료');
    
    // 테스트용 User 생성 (userId 필요)
    const testUser = await User.findOne({ role: 'admin' });
    if (!testUser) {
      console.log('관리자 사용자를 찾을 수 없습니다. 먼저 관리자 계정을 생성해주세요.');
      return;
    }
    
    // 2팀 테스트 직원 데이터 생성 (총 40명)
    const team2Employees = [];
    
    for (let i = 1; i <= 40; i++) {
      team2Employees.push({
        userId: testUser._id,
        name: `보안2팀원${i.toString().padStart(2, '0')}`,
        empNo: `2${i.toString().padStart(3, '0')}`,
        department: '보안2팀',
        position: '보안원',
        status: '재직',
        hireDate: new Date('2024-01-01'),
        phone: `010-2000-${i.toString().padStart(4, '0')}`,
        email: `team2emp${i}@company.com`,
        address: `서울시 강남구 테헤란로 ${i}길`,
        emergencyContact: `비상연락처${i} (가족) 010-9999-${i.toString().padStart(4, '0')}`,
        weekendAssignment: {
          group: i <= 10 ? '1/4' : '3/4',
          weekendGroup: i <= 20 ? 'A조' : 'B조',
          sundayGroup: i <= 10 ? '1조' : 'none'
        }
      });
    }
    
    // 데이터베이스에 저장
    const result = await Employee.insertMany(team2Employees);
    console.log(`${result.length}명의 2팀 직원 데이터 생성 완료`);
    
    // 생성된 데이터 확인
    const createdEmployees = await Employee.find({ department: '보안2팀' }).sort({ name: 1 });
    console.log('\n=== 생성된 2팀 직원 목록 ===');
    createdEmployees.forEach(emp => {
      console.log(`${emp.name} | ${emp.empNo} | ${emp.weekendAssignment?.saturdayGroup || 'N/A'} | ${emp.weekendAssignment?.sundayGroup || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('데이터 생성 오류:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestTeam2Employees();
