const mongoose = require('mongoose');
require('dotenv').config();

// 모델 import
const DutyOrder = require('../models/DutyOrder');
const Handover = require('../models/Handover');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Employee = require('../models/Employee');

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 에러:'));
db.once('open', async () => {
  console.log('MongoDB 연결 성공!');
  
  try {
    // 기존 데이터 삭제
    await DutyOrder.deleteMany({});
    await Handover.deleteMany({});
    await Schedule.deleteMany({});
    console.log('기존 보안업무 데이터 삭제 완료');

    // 관리자 사용자 찾기
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('관리자 사용자를 찾을 수 없습니다. 먼저 관리자를 생성해주세요.');
      process.exit(1);
    }

    // 직원 데이터 찾기
    const employees = await Employee.find().limit(10);
    if (employees.length === 0) {
      console.log('직원 데이터를 찾을 수 없습니다. 먼저 직원 데이터를 생성해주세요.');
      process.exit(1);
    }

    // ===== 인사명령 샘플 데이터 =====
    const dutyOrders = [
      {
        title: '야간 순찰 강화',
        content: '야간 순찰 인원을 2배로 증가하고, 순찰 간격을 30분으로 단축하시오. 주요 구역별 순찰 경로를 재정비하고, CCTV 모니터링을 강화하시오.',
        priority: 'high',
        department: '보안1팀',
        status: 'active',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
        issuedBy: adminUser._id,
        progress: 65
      },
      {
        title: '출입통제 시스템 점검',
        content: '모든 출입문의 카드키 시스템을 점검하고, 이상 시 즉시 보고하시오. 비상구 보안장치도 함께 점검하고, 필요시 수리업체를 연락하시오.',
        priority: 'medium',
        department: '보안2팀',
        status: 'pending',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        issuedBy: adminUser._id,
        progress: 0
      },
      {
        title: 'CCTV 카메라 청소',
        content: '주요 구역 CCTV 카메라 렌즈를 청소하고, 화질을 점검하시오. 특히 야간 촬영 품질을 확인하고, 필요시 조명을 보완하시오.',
        priority: 'low',
        department: '보안3팀',
        status: 'completed',
        deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1일 전
        issuedBy: adminUser._id,
        progress: 100
      },
      {
        title: '보안 교육 실시',
        content: '전체 보안팀원을 대상으로 최신 보안 위협 및 대응 방법에 대한 교육을 실시하시오. 교육 자료는 사전에 준비하고, 참석자 명단을 관리하시오.',
        priority: 'medium',
        department: '전체',
        status: 'pending',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 후
        issuedBy: adminUser._id,
        progress: 0
      },
      {
        title: '비상 대응 훈련',
        content: '화재, 침입, 테러 등 다양한 비상 상황에 대한 대응 훈련을 실시하시오. 훈련 시나리오를 작성하고, 훈련 결과를 평가하여 개선점을 도출하시오.',
        priority: 'high',
        department: '보안1팀',
        status: 'pending',
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21일 후
        issuedBy: adminUser._id,
        progress: 0
      }
    ];

    // 인사명령 저장
    for (const orderData of dutyOrders) {
      const dutyOrder = new DutyOrder(orderData);
      await dutyOrder.save();
    }
    console.log('인사명령 샘플 데이터 생성 완료');

    // ===== 인계사항 샘플 데이터 =====
    const handovers = [
      {
        title: '야간 순찰 인계',
        content: '야간 순찰 중 발견된 의심 인물에 대한 인계사항입니다. 발견 시간: 23:45, 위치: 후문 주변, 상태: 경찰에 신고 완료. 추가 모니터링 필요.',
        type: 'urgent',
        department: '보안1팀',
        status: 'in-progress',
        handoverFrom: employees[0]._id,
        handoverTo: employees[1]._id,
        handoverDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2일 전
        priority: 'high',
        followUpActions: [
          {
            action: '의심 인물 추가 모니터링',
            assignedTo: employees[1]._id,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: 'in-progress'
          }
        ]
      },
      {
        title: '출입통제 시스템 점검 인계',
        content: '카드키 시스템 점검 결과 및 후속 조치사항입니다. 3개 문에서 이상 발견, 수리업체 연락 완료, 내일 오전 수리 예정.',
        type: 'normal',
        department: '보안2팀',
        status: 'pending',
        handoverFrom: employees[2]._id,
        handoverTo: employees[3]._id,
        handoverDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1일 전
        priority: 'normal',
        followUpActions: [
          {
            action: '수리 완료 확인 및 테스트',
            assignedTo: employees[3]._id,
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            status: 'pending'
          }
        ]
      },
      {
        title: 'CCTV 카메라 청소 인계',
        content: '주요 구역 CCTV 카메라 청소 완료 및 화질 점검 결과입니다. 15개 카메라 청소 완료, 화질 모두 정상, 특이사항 없음.',
        type: 'routine',
        department: '보안3팀',
        status: 'completed',
        handoverFrom: employees[4]._id,
        handoverTo: employees[5]._id,
        handoverDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3일 전
        priority: 'low',
        followUpActions: []
      }
    ];

    // 인계사항 저장
    for (const handoverData of handovers) {
      const handover = new Handover(handoverData);
      await handover.save();
    }
    console.log('인계사항 샘플 데이터 생성 완료');

    // ===== 일정 샘플 데이터 =====
    const schedules = [
      {
        title: '보안팀 주간 회의',
        content: '각 팀별 주간 업무 현황 및 이슈 공유. 다음 주 업무 계획 수립 및 보안 이슈 논의.',
        type: 'meeting',
        department: '전체',
        startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 내일
        startTime: '09:00',
        endTime: '10:00',
        location: '회의실 A',
        createdBy: adminUser._id,
        status: 'scheduled',
        priority: 'normal'
      },
      {
        title: '보안 시스템 사용법 교육',
        content: '신규 보안 시스템 도입에 따른 사용법 교육. 시스템 로그인, 기본 기능 사용법, 주의사항 등.',
        type: 'training',
        department: '보안2팀',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 모레
        startTime: '14:00',
        endTime: '16:00',
        location: '교육실',
        createdBy: adminUser._id,
        status: 'scheduled',
        priority: 'normal'
      },
      {
        title: 'CCTV 시스템 정기점검',
        content: '주요 구역 CCTV 카메라 정기 점검 및 유지보수. 렌즈 청소, 화질 점검, 녹화 기능 테스트.',
        type: 'maintenance',
        department: '보안3팀',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        startTime: '16:30',
        endTime: '17:30',
        location: '전체 구역',
        createdBy: adminUser._id,
        status: 'scheduled',
        priority: 'low'
      },
      {
        title: '보안 점검',
        content: '전체 보안 시설 점검 및 보안 취약점 파악. 개선사항 도출 및 조치 계획 수립.',
        type: 'inspection',
        department: '보안1팀',
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2일 전
        startTime: '10:00',
        endTime: '12:00',
        location: '전체 구역',
        createdBy: adminUser._id,
        status: 'completed',
        priority: 'normal'
      },
      {
        title: '팀 회의',
        content: '보안2팀 내부 업무 회의. 일일 업무 현황 점검 및 다음 날 업무 계획 수립.',
        type: 'meeting',
        department: '보안2팀',
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 어제
        startTime: '16:00',
        endTime: '17:00',
        location: '보안2팀 사무실',
        createdBy: adminUser._id,
        status: 'completed',
        priority: 'low'
      }
    ];

    // 일정 저장
    for (const scheduleData of schedules) {
      const schedule = new Schedule(scheduleData);
      await schedule.save();
    }
    console.log('일정 샘플 데이터 생성 완료');

    console.log('🎉 모든 보안업무 샘플 데이터 생성이 완료되었습니다!');
    console.log(`- 인사명령: ${dutyOrders.length}개`);
    console.log(`- 인계사항: ${handovers.length}개`);
    console.log(`- 일정: ${schedules.length}개`);

  } catch (error) {
    console.error('데이터 생성 중 오류 발생:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
});
