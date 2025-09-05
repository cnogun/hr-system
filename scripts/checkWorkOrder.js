const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
require('dotenv').config();

const checkWorkOrder = async () => {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log('✅ MongoDB 연결 성공!');

    const workOrderId = '68b78b647777810244e150ea';
    console.log(`🔍 WorkOrder ID 확인: ${workOrderId}`);

    // ObjectId 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(workOrderId)) {
      console.log('❌ 잘못된 ObjectId 형식입니다.');
      return;
    }

    // WorkOrder 조회
    const workOrder = await WorkOrder.findById(workOrderId);
    
    if (workOrder) {
      console.log('✅ WorkOrder 발견!');
      console.log(`- ID: ${workOrder._id}`);
      console.log(`- 상태: ${workOrder.status}`);
      console.log(`- 생성일: ${workOrder.createdAt}`);
      console.log(`- 팀: ${workOrder.workInfo?.team || 'N/A'}`);
    } else {
      console.log('❌ WorkOrder를 찾을 수 없습니다.');
      
      // 전체 WorkOrder 개수 확인
      const totalCount = await WorkOrder.countDocuments();
      console.log(`📊 전체 WorkOrder 개수: ${totalCount}`);
      
      // 최근 WorkOrder 5개 확인
      const recentWorkOrders = await WorkOrder.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id status createdAt workInfo.team');
      
      console.log('📋 최근 WorkOrder 5개:');
      recentWorkOrders.forEach((wo, index) => {
        console.log(`  ${index + 1}. ID: ${wo._id}, 상태: ${wo.status}, 팀: ${wo.workInfo?.team || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB 연결 종료');
  }
};

checkWorkOrder();
