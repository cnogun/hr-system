const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
require('dotenv').config();

const checkDateFormat = async () => {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log('✅ MongoDB 연결 성공!');

    // 최근 WorkOrder 조회
    const workOrders = await WorkOrder.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .select('workInfo.date workInfo.team workInfo.shift');
    
    console.log('📋 최근 WorkOrder 3개:');
    workOrders.forEach((wo, index) => {
      console.log(`\n${index + 1}. WorkOrder ID: ${wo._id}`);
      console.log(`   - 날짜: ${wo.workInfo?.date} (타입: ${typeof wo.workInfo?.date})`);
      console.log(`   - 팀: ${wo.workInfo?.team}`);
      console.log(`   - 조: ${wo.workInfo?.shift}`);
      
      if (wo.workInfo?.date) {
        const dateObj = new Date(wo.workInfo.date);
        console.log(`   - Date 객체: ${dateObj}`);
        console.log(`   - getFullYear(): ${dateObj.getFullYear()}`);
        console.log(`   - toISOString(): ${dateObj.toISOString()}`);
        console.log(`   - toISOString().split('T')[0]: ${dateObj.toISOString().split('T')[0]}`);
        
        // 포맷팅 테스트
        const year = dateObj.getFullYear().toString().padStart(4, '0');
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[dateObj.getDay()];
        
        const formatted = `${year}년 ${month}월 ${day}일(${weekday}) ${wo.workInfo.team} 심야조(22:00~06:00)`;
        console.log(`   - 포맷된 결과: ${formatted}`);
      }
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB 연결 종료');
  }
};

checkDateFormat();
