/**
 * 파일명: fixResidentNumberIndex.js
 * 목적: 주민등록번호 인덱스 문제 해결
 * 기능:
 * - 중복된 주민등록번호 인덱스 삭제
 * - null 값 처리
 * - 데이터베이스 인덱스 정리
 * - 데이터 무결성 보장
 */
const mongoose = require('mongoose');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // employees 컬렉션에서 residentNumber 인덱스 삭제
    await db.collection('employees').dropIndex('residentNumber_1');
    console.log('✅ residentNumber 인덱스 삭제 완료');
    
    // null 값들을 정리
    const result = await db.collection('employees').updateMany(
      { residentNumber: null },
      { $unset: { residentNumber: "" } }
    );
    console.log(`✅ ${result.modifiedCount}개의 null 값 정리 완료`);
    
    console.log('🎉 인덱스 문제 해결 완료!');
    
  } catch (error) {
    if (error.code === 27) {
      console.log('ℹ️ residentNumber 인덱스가 이미 존재하지 않습니다.');
    } else {
      console.error('❌ 오류 발생:', error.message);
    }
  } finally {
    mongoose.connection.close();
    console.log('🔌 데이터베이스 연결 종료');
  }
});

db.on('error', console.error.bind(console, 'MongoDB 연결 에러:')); 