/**
 * 파일명: WorkOrder.js
 * 목적: 근무명령서 데이터 모델
 * 기능:
 * - 일일/주간/월간 근무 명령서 관리
 * - 부서별 근무 지시사항
 * - 진행률 및 상태 관리
 * - 첨부파일 관리
 * - 인원 현황 및 근무 편성 관리
 * - 직무 교육 내용 관리
 */
const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
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
    absentDetails: [String], // ["연차1", "성시경", "연차2", "김아름"] 형태의 문자열 배열
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
  
  return `${year}. ${month}. ${day}(${dayOfWeek}) ${team} ${shift}${timeInfo}`;
});

// 가상 필드: 결원 사유 요약
workOrderSchema.virtual('absentSummary').get(function() {
  if (!this.personnelStatus || !this.personnelStatus.absentDetails) return '';
  
  const summary = this.personnelStatus.absentDetails.map(detail => {
    return `${detail.type}${detail.days || ''}:${detail.employeeName}`;
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

module.exports = mongoose.model('WorkOrder', workOrderSchema);
