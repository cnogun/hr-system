/**
 * 파일명: workOrders.js
 * 목적: 근무명령서 관리 라우트
 * 기능:
 * - 근무명령서 목록 조회
 * - 근무명령서 작성/수정/삭제
 * - 근무명령서 상세 조회
 * - 인원 현황 및 근무 편성 관리
 * - 직무 교육 내용 관리
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Log = require('../models/Log');

// 로그인 체크 미들웨어
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
}

// 관리자 권한 체크
function adminOnly(req, res, next) {
  if (req.session.userRole === 'admin') {
    next();
  } else {
    res.status(403).send('관리자만 접근 가능합니다.');
  }
}

// 모든 라우트에 로깅 미들웨어 추가
router.use((req, res, next) => {
  console.log(`🔍 Work Orders 라우트 요청: ${req.method} ${req.path}`);
  console.log(`🔍 원본 URL: ${req.originalUrl}`);
  console.log(`🔍 쿼리: ${JSON.stringify(req.query)}`);
  console.log(`🔍 바디 _method: ${req.body ? req.body._method : 'N/A'}`);
  console.log(`🔍 요청 헤더: ${JSON.stringify(req.headers)}`);
  next();
});

// 근무명령서 목록 조회
router.get('/', isLoggedIn, async (req, res) => {
  try {
    console.log('📋 GET 요청 수신 (목록)');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // 검색 조건
    const filter = {};
    if (req.query.team) {
      filter['workInfo.team'] = req.query.team;
    }
    if (req.query.shift) {
      filter['workInfo.shift'] = req.query.shift;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.date) {
      const date = new Date(req.query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter['workInfo.date'] = {
        $gte: date,
        $lt: nextDay
      };
    }
    
    // 먼저 기본 데이터를 가져온 후 populate 처리
    let workOrders = await WorkOrder.find(filter)
      .sort({ 'workInfo.date': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // populate를 안전하게 처리
    try {
      workOrders = await WorkOrder.find(filter)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ 'workInfo.date': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)

    } catch (populateError) {
      console.log('⚠️ Populate 오류 발생, 기본 데이터로 진행:', populateError.message);
      // populate 실패 시 기본 데이터 사용
    }
    
    // 가상 필드 수동 추가
    workOrders = workOrders.map(workOrder => {
      if (workOrder.workInfo && workOrder.workInfo.date) {
        const date = new Date(workOrder.workInfo.date);
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
        
        const team = workOrder.workInfo.team || '';
        const shift = workOrder.workInfo.shift || '';
        const startTime = workOrder.workInfo.workTime && workOrder.workInfo.workTime.start ? workOrder.workInfo.workTime.start : '';
        const endTime = workOrder.workInfo.workTime && workOrder.workInfo.workTime.end ? workOrder.workInfo.workTime.end : '';
        
        const timeInfo = startTime && endTime ? `(${startTime}~${endTime})` : '';
        
        workOrder.formattedWorkInfo = `${year}. ${month}. ${day}(${dayOfWeek}) ${team} ${shift}${timeInfo}`;
      }
      return workOrder;
    });
    
    const total = await WorkOrder.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.render('workOrderList', {
      workOrders,
      currentPage: page,
      totalPages,
      total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      user: req.session.user,
      session: req.session,
      userRole: req.session.userRole
    });
  } catch (error) {
    console.error('근무명령서 목록 조회 오류:', error);
    res.status(500).render('error', { 
      message: '근무명령서 목록을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 근무명령서 작성 폼
router.get('/new', isLoggedIn, adminOnly, async (req, res) => {
  try {
    res.render('workOrderForm', {
      workOrder: null,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('근무명령서 작성 폼 오류:', error);
    res.status(500).render('error', { 
      message: '근무명령서 작성 폼을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 근무명령서 작성 처리
router.post('/', isLoggedIn, adminOnly, async (req, res) => {
  try {
    console.log('📝 POST 요청 수신 (생성)');
    console.log('📝 요청 바디:', JSON.stringify(req.body, null, 2));
    console.log('📝 결원상세 데이터:', JSON.stringify(req.body.personnelStatus, null, 2));
    console.log('📝 인원편성 데이터:', JSON.stringify(req.body.workAssignment, null, 2));
    console.log('📝 workAssignment 타입:', typeof req.body.workAssignment);
    console.log('📝 workAssignment 배열 여부:', Array.isArray(req.body.workAssignment));
    console.log('📝 workAssignment 길이:', req.body.workAssignment ? req.body.workAssignment.length : 0);
    console.log('📝 workAssignment 처음 10개 요소:', req.body.workAssignment ? req.body.workAssignment.slice(0, 10) : []);
    const workOrderData = {
      ...req.body,
      createdBy: req.session.userId,
      status: 'pending',
      // department 필드를 workInfo.team에서 자동 설정 (반 -> 팀으로 변환)
      department: req.body.workInfo && req.body.workInfo.team ? 
        req.body.workInfo.team.replace('반', '팀') : '전체'
    };
    
    // 중첩된 객체 구조 처리
    if (req.body.workInfo) {
      workOrderData.workInfo = {
        date: new Date(req.body.workInfo.date),
        team: req.body.workInfo.team,
        shift: req.body.workInfo.shift,
        workTime: {
          start: req.body.workInfo['workTime.start'] || '',
          end: req.body.workInfo['workTime.end'] || ''
        }
      };
    }
    
    if (req.body.personnelStatus) {
      workOrderData.personnelStatus = {
        totalPersonnel: parseInt(req.body.personnelStatus.totalPersonnel),
        absentPersonnel: parseInt(req.body.personnelStatus.absentPersonnel),
        currentPersonnel: parseInt(req.body.personnelStatus.currentPersonnel),
        absentDetails: (req.body.personnelStatus.absentDetails || []).filter(detail => 
          detail && detail.type && detail.employeeName && detail.employeeName.trim()
        ).map(detail => [detail.type, detail.employeeName]).flat(),
        accidentDetails: req.body.personnelStatus.accidentDetails || ''
      };
    }
    
    if (req.body.workAssignment) {
      // workAssignment 배열 처리 - 폼에서 전송된 객체 배열을 구조화된 객체로 변환
      const workAssignments = [];
      
      if (Array.isArray(req.body.workAssignment)) {
        // 폼에서 전송된 배열을 순회하며 처리
        req.body.workAssignment.forEach((assignment, index) => {
          if (assignment && assignment.region && assignment.location) {
            // members 배열 처리
            const members = [];
            if (assignment.assignment && assignment.assignment.members) {
              if (Array.isArray(assignment.assignment.members)) {
                members.push(...assignment.assignment.members.filter(member => member && member.trim()));
              } else {
                Object.keys(assignment.assignment.members).forEach(memberKey => {
                  const member = assignment.assignment.members[memberKey];
                  if (member && member.trim()) {
                    members.push(member.trim());
                  }
                });
              }
            }
            
            workAssignments.push({
              region: assignment.region,
              location: assignment.location,
              assignment: {
                teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                members: members
              }
            });
          }
        });
      } else {
        // 객체인 경우 (기존 로직)
        Object.keys(req.body.workAssignment).forEach(key => {
          const assignment = req.body.workAssignment[key];
          if (assignment && assignment.region && assignment.location) {
            // members 배열 처리
            const members = [];
            if (assignment.assignment && assignment.assignment.members) {
              if (Array.isArray(assignment.assignment.members)) {
                members.push(...assignment.assignment.members);
              } else {
                Object.keys(assignment.assignment.members).forEach(memberKey => {
                  const member = assignment.assignment.members[memberKey];
                  if (member && member.trim()) {
                    members.push(member.trim());
                  }
                });
              }
            }
            
            workAssignments.push({
              region: assignment.region,
              location: assignment.location,
              assignment: {
                teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                members: members
              }
            });
          }
        });
      }
      
      workOrderData.workAssignment = workAssignments;
      console.log('📝 처리된 workAssignments:', JSON.stringify(workAssignments, null, 2));
    }
    
    if (req.body.education) {
      workOrderData.education = {
        weeklyFocus: (req.body.education.weeklyFocus || []).filter(focus => focus && focus.trim()),
        generalEducation: (req.body.education.generalEducation || []).filter(education => education && education.trim())
      };
    }
    
    console.log('📝 저장할 데이터:', JSON.stringify(workOrderData, null, 2));
    const workOrder = new WorkOrder(workOrderData);
    await workOrder.save();
    console.log('✅ 근무명령서 저장 완료:', workOrder._id);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'CREATE_WORK_ORDER',
      details: `근무명령서 생성: ${workOrder.workInfo.team} ${workOrder.workInfo.shift}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.flash('success', '근무명령서가 성공적으로 생성되었습니다.');
    res.redirect('/work-orders');
  } catch (error) {
    console.error('근무명령서 생성 오류:', error);
    console.error('오류 상세:', error);
    
    let errorMessage = '근무명령서 생성 중 오류가 발생했습니다.';
    
    // 구체적인 오류 메시지 제공
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      errorMessage = '입력 데이터 검증 오류: ' + validationErrors.join(', ');
    } else if (error.name === 'CastError') {
      errorMessage = '데이터 타입 오류: ' + error.message;
    } else if (error.code === 11000) {
      errorMessage = '중복된 데이터가 있습니다.';
    }
    
    req.flash('error', errorMessage);
    
    // 사용자가 입력한 데이터를 유지하기 위해 workOrder 객체 생성
    const workOrderWithData = {
      workInfo: {
        date: req.body.workInfo ? new Date(req.body.workInfo.date) : new Date(),
        team: req.body.workInfo ? req.body.workInfo.team : '',
        shift: req.body.workInfo ? req.body.workInfo.shift : '',
        workTime: {
          start: req.body.workInfo ? req.body.workInfo['workTime.start'] : '',
          end: req.body.workInfo ? req.body.workInfo['workTime.end'] : ''
        }
      },
      personnelStatus: {
        totalPersonnel: req.body.personnelStatus ? parseInt(req.body.personnelStatus.totalPersonnel) : 40,
        absentPersonnel: req.body.personnelStatus ? parseInt(req.body.personnelStatus.absentPersonnel) : 0,
        currentPersonnel: req.body.personnelStatus ? parseInt(req.body.personnelStatus.currentPersonnel) : 40,
        absentDetails: req.body.personnelStatus ? req.body.personnelStatus.absentDetails : [],
        accidentDetails: req.body.personnelStatus ? req.body.personnelStatus.accidentDetails : ''
      },
      workAssignment: req.body.workAssignment || [],
      education: {
        weeklyFocus: req.body.education ? req.body.education.weeklyFocus : [],
        generalEducation: req.body.education ? req.body.education.generalEducation : []
      }
    };
    
    res.render('workOrderForm', {
      workOrder: workOrderWithData,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session,
      errors: [errorMessage]
    });
  }
});

// 근무명령서 수정 폼
router.get('/:id/edit', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).render('error', { 
        message: '근무명령서를 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    res.render('workOrderForm', {
      workOrder,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('근무명령서 수정 폼 오류:', error);
    res.status(500).render('error', { 
      message: '근무명령서 수정 폼을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 근무명령서 상세 조회
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    console.log('🔍 WorkOrder 조회 요청:', req.params.id);
    
    // 먼저 populate 없이 조회
    let workOrder = await WorkOrder.findById(req.params.id);
    
    // populate는 별도로 처리 (오류 방지)
    if (workOrder) {
      try {
        if (workOrder.createdBy) {
          await workOrder.populate('createdBy', 'name email');
        }
        if (workOrder.updatedBy) {
          await workOrder.populate('updatedBy', 'name email');
        }
      } catch (populateError) {
        console.log('⚠️ Populate 오류 (무시됨):', populateError.message);
      }
    }
    
    console.log('📋 WorkOrder 조회 결과:', workOrder ? '발견됨' : '없음');
    
    if (!workOrder) {
      console.log('❌ WorkOrder를 찾을 수 없습니다.');
      return res.status(404).render('error', { 
        message: '근무명령서를 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    // 근무조 정보 포맷팅
    const formatWorkInfo = (workOrder) => {
      if (!workOrder.workInfo) return '';
      
      const { date, team, shift } = workOrder.workInfo;
      if (!date || !team || !shift) return '';
      
      // 날짜 포맷팅 (YYYY-MM-DD -> YYYY년 M월 D일(요일))
      const dateObj = new Date(date);
      const year = dateObj.getFullYear(); // 이미 4자리 숫자
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekday = weekdays[dateObj.getDay()];
      
      // 디버깅 로그 추가
      console.log('🗓️ 날짜 포맷팅:', {
        originalDate: date,
        dateObj: dateObj,
        year: year,
        month: month,
        day: day,
        weekday: weekday
      });
      
      // 시간 포맷팅
      const timeFormat = {
        'day': '주간조(06:00~18:00)',
        'night': '심야조(22:00~06:00)',
        'evening': '저녁조(18:00~22:00)',
        '주간조': '주간조(06:00~14:00)',
        '초야조': '초야조(14:00~22:00)',
        '심야조': '심야조(22:00~06:00)',
        '주간특근조': '주간특근조(06:00~18:00)',
        '야간특근조': '야간특근조(18:00~06:00)'
      };
      
      const formatted = `${year}년 ${month}월 ${day}일(${weekday}) ${team} ${timeFormat[shift] || shift}`;
      console.log('🗓️ 최종 포맷팅 결과:', formatted);
      
      return formatted;
    };
    
    // 포맷된 근무조 정보 추가
    workOrder.formattedWorkInfo = formatWorkInfo(workOrder);
    
    console.log('✅ WorkOrder 렌더링 시작');
    res.render('workOrder', {
      workOrder,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('❌ 근무명령서 상세 조회 오류:', error);
    res.status(500).render('error', { 
      message: '근무명령서를 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 근무명령서 수정 처리
router.put('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    console.log('🔧 PUT 요청 수신:', req.params.id);
    console.log('🔧 요청 메서드:', req.method);
    console.log('🔧 원본 메서드:', req.originalMethod);
    console.log('🔧 요청 URL:', req.url);
    console.log('🔧 요청 경로:', req.path);
    console.log('🔧 사용자 정보:', req.session.user);
    
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).render('error', { 
        message: '근무명령서를 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    // 완료된 명령서는 수정 불가
    if (workOrder.status === 'completed') {
      req.flash('error', '완료된 근무명령서는 수정할 수 없습니다.');
      return res.redirect(`/work-orders/${workOrder._id}`);
    }
    
    const updateData = {
      ...req.body,
      updatedBy: req.session.userId,
      // department 필드를 workInfo.team에서 자동 설정 (반 -> 팀으로 변환)
      department: req.body.workInfo && req.body.workInfo.team ? 
        req.body.workInfo.team.replace('반', '팀') : '전체'
    };
    
    // 중첩된 객체 구조 처리
    if (req.body.workInfo) {
      updateData.workInfo = {
        date: new Date(req.body.workInfo.date),
        team: req.body.workInfo.team,
        shift: req.body.workInfo.shift,
        workTime: {
          start: req.body.workInfo['workTime.start'],
          end: req.body.workInfo['workTime.end']
        }
      };
    }
    
    if (req.body.personnelStatus) {
      updateData.personnelStatus = {
        totalPersonnel: parseInt(req.body.personnelStatus.totalPersonnel),
        absentPersonnel: parseInt(req.body.personnelStatus.absentPersonnel),
        currentPersonnel: parseInt(req.body.personnelStatus.currentPersonnel),
        absentDetails: (req.body.personnelStatus.absentDetails || []).filter(detail => 
          detail && detail.type && detail.employeeName && detail.employeeName.trim()
        ).map(detail => [detail.type, detail.employeeName]).flat(),
        accidentDetails: req.body.personnelStatus.accidentDetails || ''
      };
    }
    
    if (req.body.workAssignment) {
      // workAssignment 배열 처리 - 폼에서 전송된 객체 배열을 구조화된 객체로 변환
      const workAssignments = [];
      
      if (Array.isArray(req.body.workAssignment)) {
        // 폼에서 전송된 배열을 순회하며 처리
        req.body.workAssignment.forEach((assignment, index) => {
          if (assignment && assignment.region && assignment.location) {
            // members 배열 처리
            const members = [];
            if (assignment.assignment && assignment.assignment.members) {
              if (Array.isArray(assignment.assignment.members)) {
                members.push(...assignment.assignment.members.filter(member => member && member.trim()));
              } else {
                Object.keys(assignment.assignment.members).forEach(memberKey => {
                  const member = assignment.assignment.members[memberKey];
                  if (member && member.trim()) {
                    members.push(member.trim());
                  }
                });
              }
            }
            
            workAssignments.push({
              region: assignment.region,
              location: assignment.location,
              assignment: {
                teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                members: members
              }
            });
          }
        });
      } else {
        // 객체인 경우 (기존 로직)
        Object.keys(req.body.workAssignment).forEach(key => {
          const assignment = req.body.workAssignment[key];
          if (assignment && assignment.region && assignment.location) {
            // members 배열 처리
            const members = [];
            if (assignment.assignment && assignment.assignment.members) {
              if (Array.isArray(assignment.assignment.members)) {
                members.push(...assignment.assignment.members);
              } else {
                Object.keys(assignment.assignment.members).forEach(memberKey => {
                  const member = assignment.assignment.members[memberKey];
                  if (member && member.trim()) {
                    members.push(member.trim());
                  }
                });
              }
            }
            
            workAssignments.push({
              region: assignment.region,
              location: assignment.location,
              assignment: {
                teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                members: members
              }
            });
          }
        });
      }
      
      updateData.workAssignment = workAssignments;
      console.log('📝 처리된 workAssignments (PUT):', JSON.stringify(workAssignments, null, 2));
    }
    
    if (req.body.education) {
      updateData.education = {
        weeklyFocus: (req.body.education.weeklyFocus || []).filter(focus => focus && focus.trim()),
        generalEducation: (req.body.education.generalEducation || []).filter(education => education && education.trim())
      };
    }
    
    await WorkOrder.findByIdAndUpdate(req.params.id, updateData);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_WORK_ORDER',
      details: `근무명령서 수정: ${workOrder.workInfo.team} ${workOrder.workInfo.shift}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.flash('success', '근무명령서가 성공적으로 수정되었습니다.');
    res.redirect(`/work-orders/${req.params.id}`);
  } catch (error) {
    console.error('근무명령서 수정 오류:', error);
    console.error('오류 상세:', error);
    req.flash('error', '근무명령서 수정 중 오류가 발생했습니다: ' + error.message);
    res.redirect(`/work-orders/${req.params.id}/edit`);
  }
});

// POST 요청을 PUT으로 처리 (method-override 대체)
router.post('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    console.log('🔄 POST 요청을 PUT으로 처리:', req.params.id);
    console.log('🔄 _method:', req.body._method);
    
    // _method가 PUT인 경우 PUT 로직 실행
    if (req.body._method === 'PUT') {
      console.log('🔧 PUT 로직 실행 시작');
      
      const workOrder = await WorkOrder.findById(req.params.id);
      
      if (!workOrder) {
        return res.status(404).render('error', { 
          message: '근무명령서를 찾을 수 없습니다.',
          error: { status: 404 }
        });
      }
      
      // 완료된 명령서는 수정 불가
      if (workOrder.status === 'completed') {
        req.flash('error', '완료된 근무명령서는 수정할 수 없습니다.');
        return res.redirect(`/work-orders/${workOrder._id}`);
      }
      
      const updateData = {
        ...req.body,
        updatedBy: req.session.userId,
        // department 필드를 workInfo.team에서 자동 설정 (반 -> 팀으로 변환)
        department: req.body.workInfo && req.body.workInfo.team ? 
          req.body.workInfo.team.replace('반', '팀') : '전체'
      };
      
      // 중첩된 객체 구조 처리
      if (req.body.workInfo) {
        updateData.workInfo = {
          date: new Date(req.body.workInfo.date),
          team: req.body.workInfo.team,
          shift: req.body.workInfo.shift,
          workTime: {
            start: req.body.workInfo['workTime.start'] || '',
            end: req.body.workInfo['workTime.end'] || ''
          }
        };
      }
      
      if (req.body.personnelStatus) {
        updateData.personnelStatus = {
          totalPersonnel: parseInt(req.body.personnelStatus.totalPersonnel),
          absentPersonnel: parseInt(req.body.personnelStatus.absentPersonnel),
          currentPersonnel: parseInt(req.body.personnelStatus.currentPersonnel),
          absentDetails: (req.body.personnelStatus.absentDetails || []).filter(detail => 
            detail && detail.type && detail.employeeName && detail.employeeName.trim()
          ).map(detail => [detail.type, detail.employeeName]).flat(),
          accidentDetails: req.body.personnelStatus.accidentDetails || ''
        };
      }
      
      if (req.body.workAssignment) {
        // workAssignment 배열 처리 - 폼에서 전송된 객체 배열을 구조화된 객체로 변환
        const workAssignments = [];
        
        if (Array.isArray(req.body.workAssignment)) {
          // 폼에서 전송된 배열을 순회하며 처리
          req.body.workAssignment.forEach((assignment, index) => {
            if (assignment && assignment.region && assignment.location) {
              // members 배열 처리
              const members = [];
              if (assignment.assignment && assignment.assignment.members) {
                if (Array.isArray(assignment.assignment.members)) {
                  members.push(...assignment.assignment.members.filter(member => member && member.trim()));
                } else {
                  Object.keys(assignment.assignment.members).forEach(memberKey => {
                    const member = assignment.assignment.members[memberKey];
                    if (member && member.trim()) {
                      members.push(member.trim());
                    }
                  });
                }
              }
              
              workAssignments.push({
                region: assignment.region,
                location: assignment.location,
                assignment: {
                  teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                  supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                  members: members
                }
              });
            }
          });
        } else {
          // 객체인 경우 (기존 로직)
          Object.keys(req.body.workAssignment).forEach(key => {
            const assignment = req.body.workAssignment[key];
            if (assignment && assignment.region && assignment.location) {
              // members 배열 처리
              const members = [];
              if (assignment.assignment && assignment.assignment.members) {
                if (Array.isArray(assignment.assignment.members)) {
                  members.push(...assignment.assignment.members);
                } else {
                  Object.keys(assignment.assignment.members).forEach(memberKey => {
                    const member = assignment.assignment.members[memberKey];
                    if (member && member.trim()) {
                      members.push(member.trim());
                    }
                  });
                }
              }
              
              workAssignments.push({
                region: assignment.region,
                location: assignment.location,
                assignment: {
                  teamLeader: assignment.assignment && assignment.assignment.teamLeader ? assignment.assignment.teamLeader : '',
                  supervisor: assignment.assignment && assignment.assignment.supervisor ? assignment.assignment.supervisor : '',
                  members: members
                }
              });
            }
          });
        }
        
        updateData.workAssignment = workAssignments;
        console.log('📝 처리된 workAssignments (POST-to-PUT):', JSON.stringify(workAssignments, null, 2));
      }
      
      if (req.body.education) {
        updateData.education = {
          weeklyFocus: (req.body.education.weeklyFocus || []).filter(focus => focus && focus.trim()),
          generalEducation: (req.body.education.generalEducation || []).filter(education => education && education.trim())
        };
      }
      
      await WorkOrder.findByIdAndUpdate(req.params.id, updateData);
      
      // 로그 기록
      await Log.create({
        userId: req.session.userId,
        action: 'UPDATE_WORK_ORDER',
        details: `근무명령서 수정: ${workOrder.workInfo.team} ${workOrder.workInfo.shift}`,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      req.flash('success', '근무명령서가 성공적으로 수정되었습니다.');
      res.redirect(`/work-orders/${req.params.id}`);
      return;
    }
    
    // 그 외의 경우 404 오류
    res.status(404).json({ error: 'POST 요청은 지원되지 않습니다. PUT을 사용하세요.' });
  } catch (error) {
    console.error('POST to PUT 처리 오류:', error);
    console.error('오류 상세:', error);
    req.flash('error', '근무명령서 수정 중 오류가 발생했습니다: ' + error.message);
    res.redirect(`/work-orders/${req.params.id}/edit`);
  }
});

// 근무명령서 삭제
router.delete('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ 
        success: false,
        message: '근무명령서를 찾을 수 없습니다.'
      });
    }
    
    await WorkOrder.findByIdAndDelete(req.params.id);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'DELETE_WORK_ORDER',
      details: `근무명령서 삭제: ${workOrder.workInfo.team} ${workOrder.workInfo.shift}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true,
      message: '근무명령서가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('근무명령서 삭제 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '근무명령서 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 근무명령서 상태 변경
router.patch('/:id/status', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return res.status(404).json({ 
        success: false,
        message: '근무명령서를 찾을 수 없습니다.'
      });
    }
    
    workOrder.status = status;
    workOrder.updatedBy = req.session.userId;
    await workOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_WORK_ORDER_STATUS',
      details: `근무명령서 상태 변경: ${workOrder.workInfo.team} ${workOrder.workInfo.shift} -> ${status}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true,
      message: '근무명령서 상태가 성공적으로 변경되었습니다.',
      status: status
    });
  } catch (error) {
    console.error('근무명령서 상태 변경 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '근무명령서 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// 근무 스케줄 자동 설정 API
router.get('/api/schedule/:date/:team', isLoggedIn, async (req, res) => {
  try {
    const { date, team } = req.params;
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 현재 주차의 스케줄 정보 가져오기
    const WorkSchedule = require('../models/WorkSchedule');
    const weekStart = getWeekStart(selectedDate);
    const weekEnd = getWeekEnd(selectedDate);
    
    const currentSchedule = await WorkSchedule.findOne({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: 'active'
    });
    
    let shift, startTime, endTime;
    
    // 주차별 스케줄이 있는 경우 해당 스케줄 사용
    if (currentSchedule) {
      const teamSchedule = getTeamScheduleFromWorkSchedule(team, currentSchedule);
      shift = teamSchedule.shift;
      startTime = teamSchedule.startTime;
      endTime = teamSchedule.endTime;
    } else {
      // 기본 스케줄 사용 (이번주는 1반이 심야조)
      const defaultSchedule = getDefaultSchedule(team, dayOfWeek);
      shift = defaultSchedule.shift;
      startTime = defaultSchedule.startTime;
      endTime = defaultSchedule.endTime;
    }
    
    res.json({
      success: true,
      data: {
        shift,
        startTime,
        endTime,
        dayOfWeek: dayOfWeek,
        dayName: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][dayOfWeek]
      }
    });
    
  } catch (error) {
    console.error('근무 스케줄 자동 설정 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '근무 스케줄 자동 설정 중 오류가 발생했습니다.' 
    });
  }
});

// 주차 시작일 계산 (월요일 06:00)
function getWeekStart(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(date.setDate(diff));
  weekStart.setHours(6, 0, 0, 0);
  return weekStart;
}

// 주차 종료일 계산 (다음주 월요일 06:00)
function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(6, 0, 0, 0);
  return weekEnd;
}

// WorkSchedule에서 팀별 스케줄 추출
function getTeamScheduleFromWorkSchedule(team, schedule) {
  const teamMap = {
    '보안1반': 'team1',
    '보안2반': 'team2', 
    '보안3반': 'team3'
  };
  
  const teamKey = teamMap[team];
  if (!teamKey || !schedule.currentWeekSchedule[teamKey]) {
    return { shift: '', startTime: '', endTime: '' };
  }
  
  const teamSchedule = schedule.currentWeekSchedule[teamKey];
  
  // 스케줄 매핑
  const scheduleMap = {
    '출근(초)': { shift: '심야조', startTime: '14:00', endTime: '22:00' },
    '출근(심)': { shift: '야간조', startTime: '22:00', endTime: '06:00' },
    '출근(주)': { shift: '주간조', startTime: '06:00', endTime: '14:00' }
  };
  
  return scheduleMap[teamSchedule] || { shift: '', startTime: '', endTime: '' };
}

// 기본 스케줄 (이번주는 1반이 심야조)
function getDefaultSchedule(team, dayOfWeek) {
  // 평일 스케줄 (월~금) - 9월 3일 기준
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    switch (team) {
      case '보안1반':
        return { shift: '심야조', startTime: '22:00', endTime: '06:00' };
      case '보안2반':
        return { shift: '주간조', startTime: '06:00', endTime: '14:00' };
      case '보안3반':
        return { shift: '초야조', startTime: '14:00', endTime: '22:00' };
    }
  }
  
  // 주말 스케줄 (토요일, 일요일)
  if (dayOfWeek === 6) { // 토요일
    switch (team) {
      case '보안1반':
        return { shift: '휴무', startTime: '', endTime: '' };
      case '보안2반':
        return { shift: '주간조', startTime: '06:00', endTime: '18:00' };
      case '보안3반':
        return { shift: '야간조', startTime: '18:00', endTime: '06:00' };
    }
  } else { // 일요일
    switch (team) {
      case '보안1반':
        return { shift: '주간조', startTime: '06:00', endTime: '18:00' };
      case '보안2반':
        return { shift: '야간조', startTime: '18:00', endTime: '06:00' };
      case '보안3반':
        return { shift: '휴무', startTime: '', endTime: '' };
    }
  }
  
  return { shift: '', startTime: '', endTime: '' };
}

module.exports = router;
