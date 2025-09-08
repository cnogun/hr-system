const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB 연결 성공');
  
  // 9월 6일 데이터 삭제
  console.log('9월 6일 근태 데이터 삭제 중...');
  
  const employees = await Employee.find({ status: '재직' });
  let deletedCount = 0;
  
  for (const emp of employees) {
    if (emp.attendance && emp.attendance.has('2025-09-06')) {
      emp.attendance.delete('2025-09-06');
      await emp.save();
      deletedCount++;
      console.log(`${emp.name}의 9월 6일 데이터 삭제됨`);
    }
  }
  
  console.log(`총 ${deletedCount}명의 9월 6일 데이터가 삭제되었습니다.`);
  console.log('이제 근태관리 페이지에서 9월 6일을 선택하고 "근태 자동 입력" 버튼을 클릭하세요.');
  
  process.exit(0);
}).catch(err => {
  console.error('MongoDB 연결 오류:', err);
  process.exit(1);
});
