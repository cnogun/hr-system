const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
require('dotenv').config();

const testDateFormatting = async () => {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log('✅ MongoDB 연결 성공!');

    // 특정 WorkOrder 조회
    const workOrderId = '68b799da79663dbcc31afdef';
    const workOrder = await WorkOrder.findById(workOrderId);
    
    if (!workOrder) {
      console.log('❌ WorkOrder를 찾을 수 없습니다.');
      return;
    }

    console.log('📋 WorkOrder 정보:');
    console.log(`- ID: ${workOrder._id}`);
    console.log(`- 날짜: ${workOrder.workInfo?.date}`);
    console.log(`- 팀: ${workOrder.workInfo?.team}`);
    console.log(`- 조: ${workOrder.workInfo?.shift}`);

    // 날짜 포맷팅 테스트 (라우트와 동일한 로직)
    if (workOrder.workInfo?.date) {
      const { date, team, shift } = workOrder.workInfo;
      
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekday = weekdays[dateObj.getDay()];
      
      console.log('\n🗓️ 날짜 포맷팅 상세:');
      console.log(`- 원본 날짜: ${date}`);
      console.log(`- Date 객체: ${dateObj}`);
      console.log(`- getFullYear(): ${year} (타입: ${typeof year})`);
      console.log(`- getMonth() + 1: ${month} (타입: ${typeof month})`);
      console.log(`- getDate(): ${day} (타입: ${typeof day})`);
      console.log(`- 요일: ${weekday}`);
      
      // 시간 포맷팅
      const timeFormat = {
        'day': '주간조(06:00~18:00)',
        'night': '심야조(22:00~06:00)',
        'evening': '저녁조(18:00~22:00)'
      };
      
      const formatted = `${year}년 ${month}월 ${day}일(${weekday}) ${team} ${timeFormat[shift] || shift}`;
      console.log(`\n✨ 최종 포맷팅 결과: ${formatted}`);
      
      // 다양한 포맷팅 방법 테스트
      console.log('\n🧪 다양한 포맷팅 테스트:');
      console.log(`1. toString(): ${year.toString()}`);
      console.log(`2. padStart(4, '0'): ${year.toString().padStart(4, '0')}`);
      console.log(`3. 문자열 템플릿: ${year}년 ${month}월 ${day}일`);
      console.log(`4. toLocaleDateString('ko-KR'): ${dateObj.toLocaleDateString('ko-KR')}`);
      console.log(`5. toISOString(): ${dateObj.toISOString()}`);
      console.log(`6. getFullYear() 직접: ${dateObj.getFullYear()}`);
      
      // 브라우저에서 보이는 것과 비교
      const browserStyle = `${year.toString().slice(-2)}. ${String(month).padStart(2, '0')}. ${String(day).padStart(2, '0')}(${weekday})`;
      console.log(`7. 브라우저 스타일 (2자리): ${browserStyle}`);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB 연결 종료');
  }
};

testDateFormatting();
