/**
 * 파일명: WorkOrder.js
 * 목적: 근무명령서 데이터 모델
 * 기능:
 * - 일일/주간/월간 근무 명령서 관리
 * - 부서별 근무 지시사항
 * - 진행률 및 상태 관리
 * - 첨부파일 관리
 */
const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
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

// 진행률 업데이트 시 상태 자동 변경
workOrderSchema.pre('save', function(next) {
  if (this.isModified('progress')) {
    if (this.progress === 100 && this.status !== 'completed') {
      this.status = 'completed';
    } else if (this.progress > 0 && this.status === 'pending') {
      this.status = 'active';
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
