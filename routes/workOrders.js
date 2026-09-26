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
const mongoose = require('mongoose');
const multer = require('multer');
const { createHash } = require('crypto');
const { fillWorkOrderTemplate, getTemplateLocations, validateWorkOrderTemplate, assignmentName, templateBytes, hasLeader, shiftDisplay } = require('../services/workOrderExcel');

const templateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  content: { type: Buffer, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});
const WorkOrderTemplate = mongoose.models.WorkOrderTemplate || mongoose.model('WorkOrderTemplate', templateSchema);
const uploadTemplate = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }).single('template');
const locationAliases = {
  '교육원중문': '물류센터문', '선적중문': '선적문',
  '5의장중문': '5의장문', '시트1중문': '시트1주차장문',
  '엔진4부': '엔진4문'
};
const cleanAssignment = (value, region, location) => assignmentName(value, region, location);
const templateVersion = content => createHash('sha256').update(templateBytes(content)).digest('hex');
const uploadFileName = value => {
  const name = String(value || '');
  if (/[가-힣]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return /[가-힣]/.test(decoded) ? decoded : name;
};
const canonicalLocation = value => locationAliases[value] || value;
const lookupAssignment = (assignments, location) => (assignments || []).find(item => item.location === location) ||
  (assignments || []).find(item => canonicalLocation(item.location) === location);
async function currentTemplateLocations() {
  const template = await WorkOrderTemplate.findOne({ key: 'work-order' }).select('content').lean();
  if (!template) throw new Error('근무명령서 엑셀 양식을 먼저 업로드해주세요.');
  return getTemplateLocations(template.content);
}
async function orderTemplate(order) {
  if (order.templateContent) return order.templateContent;
  const template = await WorkOrderTemplate.findOne({ key: 'work-order' }).select('content').lean();
  if (!template) throw new Error('근무명령서 엑셀 양식을 먼저 업로드해주세요.');
  return template.content;
}
async function orderTemplateLocations(order) {
  return getTemplateLocations(await orderTemplate(order));
}


// WorkOrder 모델이 이미 존재하는지 확인하고 제거
if (mongoose.models.WorkOrder) {
  delete mongoose.models.WorkOrder;
}

// 스키마를 직접 정의하여 모델 생성
const workOrderSchema = new mongoose.Schema({
  // Keep the exact uploaded form used when this order was saved.
  templateContent: Buffer,
  // 기본 정보
  title: {
    type: String,
    required: true,
    trim: true,
    default: '근무명령서'
  },
  
  // 결재 정보
  approval: {
    supervisor: {
      type: String,
      required: true,
      default: '안종환'
    },
    department: {
      type: String,
      required: true,
      default: '소장'
    }
  },
  
  // 근무 정보
  workInfo: {
    date: {
      type: Date,
      required: true
    },
    team: {
      type: String,
      required: true,
      enum: ['보안1반', '보안2반', '보안3반']
    },
    shift: {
      type: String,
      required: true,
      enum: ['주간', '초야', '심야', '주간특근', '야간특근', '휴무', '주간조', '초야조', '심야조', '주간특근조', '야간특근조']
    },
    workTime: {
      display: String,
      start: String, // "22:00"
      end: String    // "06:00"
    }
  },
  
  // 인원 현황
  personnelStatus: {
    totalPersonnel: {
      type: Number,
      required: true,
      default: 40
    },
    absentPersonnel: {
      type: Number,
      default: 0
    },
    absentDetails: [{
      type: { type: String }, // "연차1", "병가", "산재" 등
      employeeName: String // "홍길동", "김철수" 등
    }], // [{type: "연차1", employeeName: "홍길동"}] 형태의 객체 배열
    currentPersonnel: {
      type: Number,
      required: true
    },
    accidentDetails: {
      type: String,
      default: ''
    }
  },
  
  // 근무 편성
  workAssignment: [{
    region: {
      type: String,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    assignment: {
      teamLeader: String,
      supervisor: String,
      members: [String]
    }
  }],
  
  // 직무 교육
  education: {
    weeklyFocus: [{
      type: String
    }],
    content: [{
      type: String
    }],
    generalEducation: [{
      type: String
    }]
  },
  
  // 기존 필드들
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
    default: 'medium'
  },
  department: {
    type: String,
    required: true,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체']
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  deadline: {
    type: Date
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attachments: [{
    fileName: String,
    originalName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  comments: [{
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// 인덱스 설정
workOrderSchema.index({ department: 1, status: 1 });
workOrderSchema.index({ priority: 1, status: 1 });
workOrderSchema.index({ createdBy: 1 });
workOrderSchema.index({ createdAt: -1 });
workOrderSchema.index({ 'workInfo.date': -1 });
workOrderSchema.index({ 'workInfo.team': 1, 'workInfo.shift': 1 });

// 가상 필드: 우선순위 한글명
workOrderSchema.virtual('priorityKorean').get(function() {
  const priorities = {
    'high': '긴급',
    'medium': '보통',
    'low': '낮음'
  };
  return priorities[this.priority] || this.priority;
});

// 가상 필드: 상태 한글명
workOrderSchema.virtual('statusKorean').get(function() {
  const statuses = {
    'pending': '대기중',
    'active': '진행중',
    'completed': '완료'
  };
  return statuses[this.status] || this.status;
});

// 가상 필드: 마감일 임박 여부
workOrderSchema.virtual('isDeadlineApproaching').get(function() {
  if (!this.deadline) return false;
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffDays = (deadline - now) / (1000 * 60 * 60 * 24);
  return diffDays <= 3 && diffDays > 0;
});

// 가상 필드: 마감일 지남 여부
workOrderSchema.virtual('isOverdue').get(function() {
  if (!this.deadline) return false;
  const now = new Date();
  const deadline = new Date(this.deadline);
  return deadline < now && this.status !== 'completed';
});

// 가상 필드: 근무 정보 포맷팅
workOrderSchema.virtual('formattedWorkInfo').get(function() {
  if (!this.workInfo) return '';
  const date = new Date(this.workInfo.date);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  
  const team = this.workInfo.team || '';
  const shift = this.workInfo.shift || '';
  const startTime = this.workInfo.workTime && this.workInfo.workTime.start ? this.workInfo.workTime.start : '';
  const endTime = this.workInfo.workTime && this.workInfo.workTime.end ? this.workInfo.workTime.end : '';
  
  const timeInfo = startTime && endTime ? `(${startTime}~${endTime})` : '';
  
  return `${year}. ${month}. ${day}(${dayOfWeek}) ${team} ${shiftDisplay(this.workInfo)}`;
});

// 가상 필드: 결원 사유 요약
workOrderSchema.virtual('absentSummary').get(function() {
  if (!this.personnelStatus || !this.personnelStatus.absentDetails) return '';
  
  const summary = this.personnelStatus.absentDetails.map(detail => {
    if (typeof detail === 'string') {
      // 기존 문자열 형태의 데이터 처리
      return detail;
    } else if (detail && detail.type && detail.employeeName) {
      // 새로운 객체 형태의 데이터 처리
      return `${detail.type}:${detail.employeeName}`;
    }
    return '';
  }).join(' ');
  
  return summary;
});

// 진행률 업데이트 시 상태 자동 변경
workOrderSchema.pre('save', function(next) {
  if (this.isModified('progress')) {
    if (this.progress === 100 && this.status !== 'completed') {
      this.status = 'completed';
    } else if (this.progress > 0 && this.status === 'pending') {
      this.status = 'active';
    }
  }
  
  // 현재 인원 자동 계산
  if (this.isModified('personnelStatus')) {
    if (this.personnelStatus.totalPersonnel && this.personnelStatus.absentPersonnel !== undefined) {
      this.personnelStatus.currentPersonnel = this.personnelStatus.totalPersonnel - this.personnelStatus.absentPersonnel;
    }
  }
  
  next();
});

// 완료된 명령서는 수정 불가
workOrderSchema.pre('save', function(next) {
  if (this.isModified() && this.status === 'completed') {
    const error = new Error('완료된 근무명령서는 수정할 수 없습니다.');
    return next(error);
  }
  next();
});

// 모델 생성
const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
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
  next();
});

// 근무명령서 목록 조회
router.get('/', isLoggedIn, async (req, res) => {
  try {
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
      workOrderMessages: { success: req.flash('success')[0], error: req.flash('error')[0] },
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
    const template = await WorkOrderTemplate.findOne({ key: 'work-order' }).select('content').lean();
    if (!template) throw new Error('근무명령서 엑셀 양식을 먼저 업로드해주세요.');
    const templateLocations = await getTemplateLocations(template.content);
    // findAssignmentData 함수 정의
    const findAssignmentData = (workAssignment, location, field) => {
      if (!workAssignment || !Array.isArray(workAssignment)) return '';
      const assignment = workAssignment.find(item => item.location === location);
      return assignment && assignment.assignment ? assignment.assignment[field] || '' : '';
    };

    res.render('workOrderForm_new', {
      templateLocations,
      templateVersion: templateVersion(template.content),
      hasLeader,
      workOrder: null,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session,
      findAssignmentData: findAssignmentData
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
    
    // workAssignment 데이터 구조 분석
    if (req.body.workAssignment) {
      if (Array.isArray(req.body.workAssignment)) {
        req.body.workAssignment.forEach((item, index) => {
        });
      }
    }
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
          display: req.body.workInfo['workTime.display'] || '',
          start: req.body.workInfo['workTime.start'] || '',
          end: req.body.workInfo['workTime.end'] || ''
        }
      };
    }
    
    if (req.body.personnelStatus) {
      // absentDetails 데이터 변환 및 처리
      let processedAbsentDetails = [];
      
      if (req.body.personnelStatus.absentDetails && Array.isArray(req.body.personnelStatus.absentDetails)) {
        req.body.personnelStatus.absentDetails.forEach(detail => {
          if (detail && detail.type && detail.employeeName) {
            // type과 employeeName이 배열인 경우 처리
            if (Array.isArray(detail.type) && Array.isArray(detail.employeeName)) {
              // 배열 길이가 같은지 확인하고 매칭
              const minLength = Math.min(detail.type.length, detail.employeeName.length);
              for (let i = 0; i < minLength; i++) {
                if (detail.type[i] && detail.employeeName[i] && 
                    typeof detail.type[i] === 'string' && typeof detail.employeeName[i] === 'string' &&
                    detail.type[i].trim() && detail.employeeName[i].trim()) {
                  processedAbsentDetails.push({
                    type: detail.type[i].trim(),
                    employeeName: detail.employeeName[i].trim()
                  });
                }
              }
            } else if (typeof detail.type === 'string' && typeof detail.employeeName === 'string') {
              // 단일 값인 경우
              if (detail.type.trim() && detail.employeeName.trim()) {
                processedAbsentDetails.push({
                  type: detail.type.trim(),
                  employeeName: detail.employeeName.trim()
                });
              }
            }
          }
        });
      }
      
      // 평일/휴일 판단하여 총원 자동 설정
      const workDate = new Date(workOrderData.workInfo.date);
      const dayOfWeek = workDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 토요일(6) 또는 일요일(0)
      
      // 평일이면 40명, 휴일이면 30명으로 자동 설정
      const autoTotalPersonnel = isWeekend ? 30 : 40;
      
      workOrderData.personnelStatus = {
        totalPersonnel: parseInt(req.body.personnelStatus.totalPersonnel) || autoTotalPersonnel,
        absentPersonnel: parseInt(req.body.personnelStatus.absentPersonnel),
        currentPersonnel: parseInt(req.body.personnelStatus.currentPersonnel),
        absentDetails: processedAbsentDetails,
        accidentDetails: req.body.personnelStatus.accidentDetails || ''
      };
    }
    
    // 새로운 간단한 name 속성 구조 처리
    const workAssignments = [];
    
    
    const template = await WorkOrderTemplate.findOne({ key: 'work-order' }).select('content').lean();
    if (!template) throw new Error('근무명령서 엑셀 양식을 먼저 업로드해주세요.');
    if (req.body.templateVersion !== templateVersion(template.content)) {
      throw new Error('작성 중 양식이 변경되었습니다. 작성 페이지를 새로 열고 명단을 확인해주세요.');
    }
    const locations = (await getTemplateLocations(template.content)).flat().map(item => ({
      key: item.location, region: item.region
    }));
    
    // workAssignment 객체에서 데이터 수집
    if (req.body.workAssignment) {
      locations.forEach(location => {
        const assignmentData = req.body.workAssignment[location.key];
        
        // 새로운 방식: assignment 객체가 있는 경우
        if (assignmentData && assignmentData.assignment) {
          const teamLeader = cleanAssignment(assignmentData.assignment.teamLeader, location.region, location.key);
          const supervisor = cleanAssignment(assignmentData.assignment.supervisor, location.region, location.key);
          const members = [];
          
          // 대원 데이터 수집 (members 배열)
          if (assignmentData.assignment.members) {
            for (let i = 0; i < 10; i++) { // 최대 10명까지
              const member = assignmentData.assignment.members[i];
              members[i] = cleanAssignment(member, location.region, location.key);
            }
          }
          
          // 데이터가 있는 경우만 추가
          if (teamLeader || supervisor || members.some(Boolean)) {
            workAssignments.push({
              region: location.region,
              location: location.key,
              assignment: {
                teamLeader: teamLeader,
                supervisor: supervisor,
                members: members
              }
            });
          }
        }
        // 이전 방식: 배열 형태로 전송되는 경우 (작성 페이지)
        else if (assignmentData && Array.isArray(assignmentData)) {
          const members = [];
          
          // 배열에서 대원 이름들 추출 (앞의 2개 요소가 대원 이름)
          for (let i = 0; i < assignmentData.length - 2; i++) {
            const member = assignmentData[i];
            members[i] = cleanAssignment(member, location.region, location.key);
          }
          
          // 데이터가 있는 경우만 추가
          if (members.some(Boolean)) {
            workAssignments.push({
              region: location.region,
              location: location.key,
              assignment: {
                teamLeader: '',
                supervisor: '',
                members: members
              }
            });
          }
        }
      });
    }
    
    // 기존 방식도 지원 (하위 호환성)
    locations.forEach(location => {
      const teamLeader = cleanAssignment(req.body[`teamLeader_${location.key}`], location.region, location.key);
      const supervisor = cleanAssignment(req.body[`supervisor_${location.key}`], location.region, location.key);
      const members = [];
      
      // 대원 데이터 수집 (member_위치명_0, member_위치명_1, ...)
      for (let i = 0; i < 10; i++) { // 최대 10명까지
        const member = req.body[`member_${location.key}_${i}`];
        members[i] = cleanAssignment(member, location.region, location.key);
      }
      
      // 기존 방식으로 데이터가 있고, 아직 추가되지 않은 경우만 추가
      if ((teamLeader || supervisor || members.some(Boolean)) &&
          !workAssignments.find(wa => wa.location === location.key)) {
        workAssignments.push({
          region: location.region,
          location: location.key,
          assignment: {
            teamLeader: teamLeader,
            supervisor: supervisor,
            members: members
          }
        });
      }
    });
    
    workOrderData.workAssignment = workAssignments;
    
    if (req.body.education) {
      workOrderData.education = {
        weeklyFocus: (req.body.education.weeklyFocus || []).filter(focus => focus && focus.trim()),
        content: (req.body.education.content || []).filter(content => content && content.trim()),
        generalEducation: (req.body.education.generalEducation || []).filter(education => education && education.trim())
      };
    }
    
    
    // 각 섹션별 데이터 확인
    
    // 필수 필드 검증
    if (!workOrderData.workInfo || !workOrderData.workInfo.date || !workOrderData.workInfo.team) {
      throw new Error('근무 정보가 올바르지 않습니다.');
    }
    
    if (!workOrderData.personnelStatus || !workOrderData.personnelStatus.totalPersonnel) {
      throw new Error('인원 현황이 올바르지 않습니다.');
    }
    
    workOrderData.templateContent = template.content;
    const workOrder = new WorkOrder(workOrderData);
    await workOrder.save();
    
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
    } else if (error.message.startsWith('작성 중 양식이 변경되었습니다.')) {
      errorMessage = error.message;
    }
    
    
    // 사용자가 입력한 데이터를 유지하기 위해 workOrder 객체 생성
    const workOrderWithData = {
      workInfo: {
        date: req.body.workInfo ? new Date(req.body.workInfo.date) : new Date(),
        team: req.body.workInfo ? req.body.workInfo.team : '',
        shift: req.body.workInfo ? req.body.workInfo.shift : '',
        workTime: {
          display: req.body.workInfo ? req.body.workInfo['workTime.display'] : '',
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
    
    // findAssignmentData 함수 정의
    const findAssignmentData = (workAssignment, location, field) => {
      if (!workAssignment || !Array.isArray(workAssignment)) return '';
      const assignment = workAssignment.find(item => item.location === location);
      return assignment && assignment.assignment ? assignment.assignment[field] || '' : '';
    };
    
    res.render('workOrderForm', {
      workOrder: workOrderWithData,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session,
      errors: [errorMessage],
      findAssignmentData: findAssignmentData
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
    const templateLocations = await orderTemplateLocations(workOrder);
    templateLocations.forEach(side => side.forEach(item => {
      const members = lookupAssignment(workOrder.workAssignment, item.location)?.assignment?.members || [];
      item.memberCount = Math.max(item.memberCount, members.findLastIndex(Boolean) + 1);
    }));
    
    // workAssignment 데이터 구조 디버깅
    
    // findAssignmentData 함수 정의
    const findAssignmentData = (workAssignment, location, field, index) => {
      if (!workAssignment || !Array.isArray(workAssignment)) return '';
      const assignment = lookupAssignment(workAssignment, location);
      if (!assignment || !assignment.assignment) return '';
      
      if (index !== undefined) {
        // members 배열의 특정 인덱스 접근
        if (field === 'members' && Array.isArray(assignment.assignment[field])) {
          return cleanAssignment(assignment.assignment[field][index], assignment.region, location);
        }
        return assignment.assignment[field] && assignment.assignment[field][index] ? assignment.assignment[field][index] : '';
      }
      
      return ['supervisor', 'teamLeader'].includes(field)
        ? cleanAssignment(assignment.assignment[field], assignment.region, location)
        : assignment.assignment[field] || '';
    };

    res.render('workOrder_edit', {
      workOrderMessages: { success: req.flash('success')[0], error: req.flash('error')[0] },
      templateLocations,
      hasLeader,
      workOrder,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session,
      findAssignmentData: findAssignmentData
    });
  } catch (error) {
    console.error('근무명령서 수정 폼 오류:', error);
    res.status(500).render('error', { 
      message: '근무명령서 수정 폼을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 관리자 지정 엑셀 양식 업로드. 최대 2MB의 .xlsx 파일만 저장합니다.
router.post('/template', isLoggedIn, adminOnly, (req, res) => {
  uploadTemplate(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).send(uploadError.code === 'LIMIT_FILE_SIZE' ? '엑셀 양식은 2MB 이하로 올려주세요.' : '엑셀 파일을 업로드할 수 없습니다.');
    }
    const file = req.file;
    if (!file || !/\.xlsx$/i.test(file.originalname) || file.buffer.subarray(0, 4).toString('hex') !== '504b0304') {
      return res.status(400).send('.xlsx 형식의 엑셀 양식을 선택해주세요.');
    }
    try {
      await getTemplateLocations(file.buffer);
      await validateWorkOrderTemplate(file.buffer);
      await WorkOrderTemplate.findOneAndUpdate(
        { key: 'work-order' },
        { $set: { originalName: uploadFileName(file.originalname), content: file.buffer, size: file.size, uploadedAt: new Date() } },
        { upsert: true, new: true, runValidators: true }
      );
      res.redirect('/excelManager?tab=security&uploaded=1');
    } catch (error) {
      console.error('근무명령서 엑셀 양식 저장 오류:', error);
      res.status(400).send(`엑셀 양식을 적용할 수 없습니다: ${error.message}`);
    }
  });
});

router.get('/template/info', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const template = await WorkOrderTemplate.findOne({ key: 'work-order' })
      .select('originalName size uploadedAt').lean();
    if (template) template.originalName = uploadFileName(template.originalName);
    res.json({ success: true, template });
  } catch (error) {
    console.error('근무명령서 엑셀 양식 조회 오류:', error);
    res.status(500).json({ success: false, message: '양식 정보를 불러오지 못했습니다.' });
  }
});

router.get('/template/download', isLoggedIn, async (req, res) => {
  try {
    const template = await WorkOrderTemplate.findOne({ key: 'work-order' });
    if (!template) return res.status(404).send('등록된 엑셀 양식이 없습니다.');
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="work-order-template.xlsx"');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(template.content);
  } catch (error) {
    console.error('근무명령서 엑셀 양식 다운로드 오류:', error);
    res.status(500).send('엑셀 양식을 내려받지 못했습니다.');
  }
});

// 저장된 명령서 내용을 업로드된 원본 엑셀 양식에 채워 인쇄용 파일로 전달합니다.
router.get('/:id/print', isLoggedIn, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).send('잘못된 근무명령서 번호입니다.');
  try {
    const order = await WorkOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).send('근무명령서를 찾을 수 없습니다.');
    const content = await fillWorkOrderTemplate(await orderTemplate(order), order);
    const date = order.workInfo && order.workInfo.date
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(order.workInfo.date))
        .filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => part.value).join('-')
      : 'undated';
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="work-order-${date}.xlsx"`);
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(content));
  } catch (error) {
    console.error('근무명령서 인쇄용 엑셀 생성 오류:', error);
    res.status(400).send(error.message.includes('편성 칸에는 최대')
      ? error.message : '인쇄용 근무명령서를 만들지 못했습니다. 업로드된 양식을 확인해주세요.');
  }
});

// 근무명령서 상세 조회
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    
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
      }
    }
    
    
    if (!workOrder) {
      return res.status(404).render('error', { 
        message: '근무명령서를 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    const templateLocations = await orderTemplateLocations(workOrder);
    templateLocations.forEach(side => side.forEach(item => {
      item.members = (lookupAssignment(workOrder.workAssignment, item.location)?.assignment?.members || [])
        .map(name => cleanAssignment(name, item.region, item.location)).filter(Boolean);
    }));
    
    // workAssignment 데이터 구조 디버깅
    
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
      
      return formatted;
    };
    
    // 포맷된 근무조 정보 추가
    workOrder.formattedWorkInfo = formatWorkInfo(workOrder);
    
    // findAssignmentData 함수 정의
    const findAssignmentData = (workAssignment, location, field, index) => {
      if (!workAssignment || !Array.isArray(workAssignment)) return '';
      const assignment = lookupAssignment(workAssignment, location);
      if (!assignment || !assignment.assignment) return '';
      
      
      if (index !== undefined) {
        // members 배열의 특정 인덱스 접근
        if (field === 'members' && Array.isArray(assignment.assignment[field])) {
          return assignment.assignment[field][index] || '';
        }
        return assignment.assignment[field] && assignment.assignment[field][index] ? assignment.assignment[field][index] : '';
      }
      
      return assignment.assignment[field] || '';
    };
    
    res.render('workOrder', {
      workOrderMessages: { success: req.flash('success')[0], error: req.flash('error')[0] },
      templateLocations,
      hasLeader,
      workOrder,
      findAssignmentData: findAssignmentData,
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
const updateWorkOrder = async (req, res) => {
  try {
    
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
          display: req.body.workInfo['workTime.display'] || '',
          start: req.body.workInfo['workTime.start'],
          end: req.body.workInfo['workTime.end']
        }
      };
    }
    
    if (req.body.personnelStatus) {
      // absentDetails 데이터 변환 및 처리
      let processedAbsentDetails = [];
      
      if (req.body.personnelStatus.absentDetails && Array.isArray(req.body.personnelStatus.absentDetails)) {
        req.body.personnelStatus.absentDetails.forEach(detail => {
          if (detail && detail.type && detail.employeeName) {
            // type과 employeeName이 배열인 경우 처리
            if (Array.isArray(detail.type) && Array.isArray(detail.employeeName)) {
              // 배열 길이가 같은지 확인하고 매칭
              const minLength = Math.min(detail.type.length, detail.employeeName.length);
              for (let i = 0; i < minLength; i++) {
                if (detail.type[i] && detail.employeeName[i] && 
                    typeof detail.type[i] === 'string' && typeof detail.employeeName[i] === 'string' &&
                    detail.type[i].trim() && detail.employeeName[i].trim()) {
                  processedAbsentDetails.push({
                    type: detail.type[i].trim(),
                    employeeName: detail.employeeName[i].trim()
                  });
                }
              }
            } else if (typeof detail.type === 'string' && typeof detail.employeeName === 'string') {
              // 단일 값인 경우
              if (detail.type.trim() && detail.employeeName.trim()) {
                processedAbsentDetails.push({
                  type: detail.type.trim(),
                  employeeName: detail.employeeName.trim()
                });
              }
            }
          }
        });
      }
      
      // 평일/휴일 판단하여 총원 자동 설정
      const workDate = new Date(updateData.workInfo.date);
      const dayOfWeek = workDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 토요일(6) 또는 일요일(0)
      
      // 평일이면 40명, 휴일이면 30명으로 자동 설정
      const autoTotalPersonnel = isWeekend ? 30 : 40;
      
      updateData.personnelStatus = {
        totalPersonnel: parseInt(req.body.personnelStatus.totalPersonnel) || autoTotalPersonnel,
        absentPersonnel: parseInt(req.body.personnelStatus.absentPersonnel),
        currentPersonnel: parseInt(req.body.personnelStatus.currentPersonnel),
        absentDetails: processedAbsentDetails,
        accidentDetails: req.body.personnelStatus.accidentDetails || ''
      };
    }
    
    // 새로운 간단한 name 속성 구조 처리 (작성페이지와 동일한 방식)
    const workAssignments = [];
    
    
    // 편집 화면과 같은 업로드 양식의 근무지만 저장합니다.
    const locations = (await orderTemplateLocations(workOrder)).flat().map(item => ({
      key: item.location, region: item.region
    }));

    // workAssignment 객체에서 데이터 수집 (새로운 방식)
    if (req.body.workAssignment) {
      locations.forEach(location => {
        const assignmentData = req.body.workAssignment[location.key];
        if (assignmentData && assignmentData.assignment) {
          const teamLeader = cleanAssignment(assignmentData.assignment.teamLeader, location.region, location.key);
          const supervisor = cleanAssignment(assignmentData.assignment.supervisor, location.region, location.key);
          const members = [];
          
          // 대원 데이터 수집 (members 배열)
          if (assignmentData.assignment.members) {
            for (let i = 0; i < 10; i++) { // 최대 10명까지
              const member = assignmentData.assignment.members[i];
              members[i] = cleanAssignment(member, location.region, location.key);
            }
          }
          
          // 데이터가 있는 경우만 추가
          if (teamLeader || supervisor || members.some(Boolean)) {
            workAssignments.push({
              region: location.region,
              location: location.key,
              assignment: {
                teamLeader: teamLeader,
                supervisor: supervisor,
                members: members
              }
            });
            
          }
        }
      });
    }
    
    // 기존 방식도 지원 (하위 호환성)
    const foundLocations = new Set();
    
    // req.body의 모든 키를 분석하여 위치명 추출
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('teamLeader_')) {
        const location = key.replace('teamLeader_', '');
        foundLocations.add(location);
      } else if (key.startsWith('supervisor_')) {
        const location = key.replace('supervisor_', '');
        foundLocations.add(location);
      } else if (key.startsWith('member_')) {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const location = parts.slice(1, -1).join('_'); // member_위치명_번호에서 위치명 추출
          foundLocations.add(location);
        }
      }
    });
    
    
    // 각 발견된 위치별로 데이터 수집
    foundLocations.forEach(locationKey => {
      const locationInfo = locations.find(loc => loc.key === locationKey);
      if (!locationInfo) return;
      const region = locationInfo.region;
      const teamLeader = cleanAssignment(req.body[`teamLeader_${locationKey}`], region, locationKey);
      const supervisor = cleanAssignment(req.body[`supervisor_${locationKey}`], region, locationKey);
      const members = [];
      
      
      // 대원 데이터 수집 (member_위치명_0, member_위치명_1, ...)
      for (let i = 0; i < 10; i++) { // 최대 10명까지
        const member = req.body[`member_${locationKey}_${i}`];
        members[i] = cleanAssignment(member, region, locationKey);
      }
      
      
      // 지역 정보 찾기 (기존 locations 배열에서)
      
      
      // 기존 방식으로 데이터가 있고, 아직 추가되지 않은 경우만 추가
      if ((teamLeader || supervisor || members.some(Boolean)) &&
          !workAssignments.find(wa => wa.location === locationKey)) {
        workAssignments.push({
          region: region,
          location: locationKey,
          assignment: {
            teamLeader: teamLeader,
            supervisor: supervisor,
            members: members
          }
        });
        
      } else {
      }
    });
    
    // 화면에 없는 과거 근무지는 수정만으로 삭제하지 않습니다.
    for (const previous of workOrder.workAssignment || []) {
      if (!locations.some(location => location.key === canonicalLocation(previous.location)) &&
          !workAssignments.some(item => item.location === canonicalLocation(previous.location))) workAssignments.push(previous);
    }
    updateData.workAssignment = workAssignments;
    
    if (req.body.education) {
      updateData.education = {
        weeklyFocus: (req.body.education.weeklyFocus || []).filter(focus => focus && focus.trim()),
        content: (req.body.education.content || []).filter(content => content && content.trim()),
        generalEducation: (req.body.education.generalEducation || []).filter(education => education && education.trim())
      };
    }
    
    if (!workOrder.templateContent) updateData.templateContent = await orderTemplate(workOrder);
    const updatedWorkOrder = await WorkOrder.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_WORK_ORDER',
      details: `근무명령서 수정: ${workOrder.workInfo.team} ${workOrder.workInfo.shift}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.flash('success', '근무명령서가 성공적으로 수정되었습니다.');
    res.redirect(`/work-orders/${req.params.id}/edit`);
  } catch (error) {
    console.error('근무명령서 수정 오류:', error);
    console.error('오류 상세:', error);
    req.flash('error', '근무명령서 수정 중 오류가 발생했습니다: ' + error.message);
    res.redirect(`/work-orders/${req.params.id}/edit`);
  }
};

// method-override가 적용되는 환경과 기존 HTML 폼의 POST 요청이 모두 같은 저장 로직을 사용합니다.
router.put('/:id', isLoggedIn, adminOnly, updateWorkOrder);
router.post('/:id', isLoggedIn, adminOnly, (req, res) => {
  if (req.body?._method !== 'PUT') return res.status(405).send('지원하지 않는 요청입니다.');
  return updateWorkOrder(req, res);
});

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
  return require('../services/workScheduleService').getWeekStart(date);
}

function getWeekEnd(date) {
  return require('../services/workScheduleService').getWeekEnd(date);
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



module.exports = router ;
