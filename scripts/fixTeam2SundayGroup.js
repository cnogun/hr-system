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
    // 보안2팀 직원들의 sundayGroup 필드 수정
    const Employee = require('../models/Employee');
    
    // 2팀 1조 (1~10번)
    await Employee.updateMany(
      { 
        department: '보안2팀',
        name: { $in: [
          '보안2팀원1', '보안2팀원2', '보안2팀원3', '보안2팀원4', '보안2팀원5',
          '보안2팀원6', '보안2팀원7', '보안2팀원8', '보안2팀원9', '보안2팀원10'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '1조' }
    );
    console.log('2팀 1조 sundayGroup 수정 완료');
    
    // 2팀 2조 (11~20번)
    await Employee.updateMany(
      { 
        department: '보안2팀',
        name: { $in: [
          '보안2팀원11', '보안2팀원12', '보안2팀원13', '보안2팀원14', '보안2팀원15',
          '보안2팀원16', '보안2팀원17', '보안2팀원18', '보안2팀원19', '보안2팀원20'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '2조' }
    );
    console.log('2팀 2조 sundayGroup 수정 완료');
    
    // 2팀 3조 (21~30번)
    await Employee.updateMany(
      { 
        department: '보안2팀',
        name: { $in: [
          '보안2팀원21', '보안2팀원22', '보안2팀원23', '보안2팀원24', '보안2팀원25',
          '보안2팀원26', '보안2팀원27', '보안2팀원28', '보안2팀원29', '보안2팀원30'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '3조' }
    );
    console.log('2팀 3조 sundayGroup 수정 완료');
    
    // 2팀 4조 (31~40번)
    await Employee.updateMany(
      { 
        department: '보안2팀',
        name: { $in: [
          '보안2팀원31', '보안2팀원32', '보안2팀원33', '보안2팀원34', '보안2팀원35',
          '보안2팀원36', '보안2팀원37', '보안2팀원38', '보안2팀원39', '보안2팀원40'
        ]}
      },
      { 'weekendAssignment.sundayGroup': '4조' }
    );
    console.log('2팀 4조 sundayGroup 수정 완료');
    
    // 수정 결과 확인
    const updatedEmployees = await Employee.find({ department: '보안2팀' }).limit(10);
    console.log('\n=== 수정된 직원 데이터 확인 ===');
    updatedEmployees.forEach(emp => {
      console.log(`${emp.name}: sundayGroup = ${emp.weekendAssignment?.sundayGroup}`);
    });
    
    console.log('\n✅ 보안2팀 sundayGroup 필드 수정 완료!');
    
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
});
