const mongoose = require('mongoose');

const dutyOrderSchema = new mongoose.Schema({
  // 인사명령 기본 정보
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  
  // 인사명령 유형
  orderType: {
    type: String,
    required: true,
    enum: ['근무배정', '직급변경', '부서이동', '특별업무', '휴직/복직', '퇴직', '기타'],
    default: '근무배정'
  },
  
  // 우선순위
  priority: {
    type: String,
    enum: ['긴급', '높음', '보통', '낮음'],
    required: true,
    default: '보통'
  },
  
  // 대상 부서
  department: {
    type: String,
    required: true,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체']
  },
  
  // 명령 상태
  status: {
    type: String,
    enum: ['대기', '시행', '완료', '취소'],
    default: '대기'
  },
  
  // 시행일
  effectiveDate: {
    type: Date,
    required: true
  },
  
  // 마감일
  deadline: {
    type: Date
  },
  
  // 발령자
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 대상 직원들
  assignedEmployees: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    previousPosition: String,  // 이전 직급/부서
    newPosition: String,       // 새 직급/부서
    workType: String,          // 근무형태 (주간/야간/특근 등)
    workLocation: String,      // 근무지
    notes: String              // 특이사항
  }],
  
  // 첨부파일
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 승인 정보
  approval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    approvalNotes: String
  },
  
  // 코멘트/이력
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 진행률
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// 인사명령 검색을 위한 인덱스
// orderNumber는 unique: true로 자동 인덱스 생성되므로 제외
dutyOrderSchema.index({ orderType: 1, status: 1 });
dutyOrderSchema.index({ priority: 1, effectiveDate: -1 });
dutyOrderSchema.index({ department: 1, status: 1 });
dutyOrderSchema.index({ effectiveDate: 1 });
dutyOrderSchema.index({ 'assignedEmployees.employee': 1 });

module.exports = mongoose.model('DutyOrder', dutyOrderSchema);
