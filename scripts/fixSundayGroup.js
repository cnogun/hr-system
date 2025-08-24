const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB 연결 오류:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 보안1팀 직원들의 sundayGroup 필드 수정
    const Employee = require('../models/Employee');
    
    // 1팀 1조 (1~10번)
    await Employee.updateMany(
      { 
        department: '보안1팀',
        name: { $in: [
          '보안1팀원1', '보안1팀원2', '보안1팀원3', '보안1팀원4', '보안1팀원5',
          '보안1팀원6', '보안1팀원7', '보안1팀원8', '보안1팀원9', '보안1팀원10'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '1조' }
    );
    console.log('1팀 1조 sundayGroup 수정 완료');
    
    // 1팀 2조 (11~20번)
    await Employee.updateMany(
      { 
        department: '보안1팀',
        name: { $in: [
          '보안1팀원11', '보안1팀원12', '보안1팀원13', '보안1팀원14', '보안1팀원15',
          '보안1팀원16', '보안1팀원17', '보안1팀원18', '보안1팀원19', '보안1팀원20'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '2조' }
    );
    console.log('1팀 2조 sundayGroup 수정 완료');
    
    // 1팀 3조 (21~30번)
    await Employee.updateMany(
      { 
        department: '보안1팀',
        name: { $in: [
          '보안1팀원21', '보안1팀원22', '보안1팀원23', '보안1팀원24', '보안1팀원25',
          '보안1팀원26', '보안1팀원27', '보안1팀원28', '보안1팀원29', '보안1팀원30'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '3조' }
    );
    console.log('1팀 3조 sundayGroup 수정 완료');
    
    // 1팀 4조 (31~40번)
    await Employee.updateMany(
      { 
        department: '보안1팀',
        name: { $in: [
          '보안1팀원31', '보안1팀원32', '보안1팀원33', '보안1팀원34', '보안1팀원35',
          '보안1팀원36', '보안1팀원37', '보안1팀원38', '보안1팀원39', '보안1팀원40'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '4조' }
    );
    console.log('1팀 4조 sundayGroup 수정 완료');
    
    // 수정 결과 확인
    const updatedEmployees = await Employee.find({ department: '보안1팀' }).limit(10);
    console.log('\n=== 수정된 직원 데이터 확인 ===');
    updatedEmployees.forEach(emp => {
      console.log(`${emp.name}: sundayGroup = ${emp.weekendAssignment?.sundayGroup}`);
    });
    
    console.log('\n✅ sundayGroup 필드 수정 완료!');
    
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
});
