const mongoose = require('mongoose');
const Employee = require('./models/Employee');

mongoose.connect('mongodb://localhost:27017/security_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB 연결 성공');
  
  // 9월 6일 토요일 데이터 조회
  const employees = await Employee.find({ status: '재직' }).limit(5);
  
  console.log('=== 9월 6일 토요일 근태 데이터 ===');
  
  for (const emp of employees) {
    const attendance = emp.attendance?.get('2025-09-06');
    if (attendance && attendance.status) {
      console.log(`\n${emp.name} (${emp.department}):`);
      console.log('  상태:', attendance.status);
      console.log('  출근:', attendance.checkIn);
      console.log('  퇴근:', attendance.checkOut);
      console.log('  기본:', attendance.basic);
      console.log('  연장:', attendance.overtime);
      console.log('  특근:', attendance.special);
      console.log('  특연:', attendance.specialOvertime);
      console.log('  야간:', attendance.night);
      console.log('  총시간:', attendance.totalTime);
      console.log('  비고:', attendance.note);
      
      // 총시간 계산 확인
      const basic = parseFloat(attendance.basic) || 0;
      const overtime = parseFloat(attendance.overtime) || 0;
      const special = parseFloat(attendance.special) || 0;
      const specialOvertime = parseFloat(attendance.specialOvertime) || 0;
      const night = parseFloat(attendance.night) || 0;
      const calculatedTotal = basic + overtime + special + specialOvertime + night;
      
      console.log('  계산된 총시간:', calculatedTotal);
      console.log('  저장된 총시간:', attendance.totalTime);
      console.log('  차이:', Math.abs(calculatedTotal - (parseFloat(attendance.totalTime) || 0)));
    }
  }
  
  process.exit(0);
}).catch(err => {
  console.error('MongoDB 연결 오류:', err);
  process.exit(1);
});
