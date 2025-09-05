/**
 * 파일명: Handover.js
 * 목적: 일일업무 인계장 데이터 모델
 * 기능:
 * - 일일 업무 인계사항 관리
 * - 작업 완료 보고 관리
 * - 팀별 인계사항 분류
 * - 시간대별 업무 구분 (주간/야간/심야)
 */
const mongoose = require('mongoose');

const handoverSchema = new mongoose.Schema({
  // 기본 정보
  title: {
    type: String,
    required: true,
    trim: true,
    default: '일일업무 인계장'
  },
  
  // 인계장 날짜
  handoverDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // 인계사항 목록
  handoverItems: [{
    // 작업 구분 (LED 옥외 전광판, 근무지 식수통 교체 등)
    taskType: {
      type: String,
      required: true
    },
    
    // 작업 상세 정보
    taskDetails: {
      // 일시
      dateTime: {
        date: String, // "8/29(금)"
        startTime: String, // "14:35"
        endTime: String   // "17:05"
      },
      
      // 인원 정보
      personnel: {
        company: String, // "엘지씨앤에스"
        name: String,    // "성희준"
        additionalCount: Number, // "외 2명"
        phone: String    // "010-3599-9666"
      },
      
      // 장소
      location: String, // "아산로 소공원 내"
      
      // 작업 내용
      content: String,  // "옥외 전광판 LMD패널 및 가드레일 1EA 보수 작업"
      
      // 추가 정보
      additionalInfo: String // "상기인은 외부인으로 울산시 건설본부 발주 내용"
    },
    
    // 보고 완료 여부
    reportCompleted: {
      type: Boolean,
      default: false
    },
    
    // 담당 팀
    assignedTeam: {
      type: String,
      enum: ['1반', '2반', '3반'],
      required: true
    },
    
    // 시간대 구분
    timeCategory: {
      type: String,
      enum: ['주간', '야간', '심야'],
      default: '주간'
    },
    
    // 작업 상태
    status: {
      type: String,
      enum: ['진행중', '완료', '보류'],
      default: '진행중'
    }
  }],
  
  // 기존 필드들 (호환성 유지)
  content: {
    type: String
  },
  type: {
    type: String,
    enum: ['urgent', 'normal', 'routine'],
    default: 'normal'
  },
  department: {
    type: String,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체'],
    default: '보안1팀'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  handoverFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  handoverTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  followUpActions: [{
    action: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },
    completedAt: Date
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// 인계사항 검색을 위한 인덱스
handoverSchema.index({ department: 1, status: 1 });
handoverSchema.index({ handoverDate: -1 });
handoverSchema.index({ type: 1, priority: 1 });
handoverSchema.index({ handoverFrom: 1, handoverTo: 1 });
handoverSchema.index({ 'handoverItems.assignedTeam': 1 });
handoverSchema.index({ 'handoverItems.timeCategory': 1 });

// 가상 필드: 완료된 보고 수
handoverSchema.virtual('completedReportsCount').get(function() {
  if (!this.handoverItems) return 0;
  return this.handoverItems.filter(item => item.reportCompleted).length;
});

// 가상 필드: 전체 인계사항 수
handoverSchema.virtual('totalItemsCount').get(function() {
  return this.handoverItems ? this.handoverItems.length : 0;
});

// 가상 필드: 팀별 인계사항 수
handoverSchema.virtual('teamItemsCount').get(function() {
  if (!this.handoverItems) return {};
  
  const teamCount = {};
  this.handoverItems.forEach(item => {
    const team = item.assignedTeam;
    teamCount[team] = (teamCount[team] || 0) + 1;
  });
  
  return teamCount;
});

// 가상 필드: 시간대별 인계사항 수
handoverSchema.virtual('timeCategoryCount').get(function() {
  if (!this.handoverItems) return {};
  
  const timeCount = {};
  this.handoverItems.forEach(item => {
    const timeCategory = item.timeCategory;
    timeCount[timeCategory] = (timeCount[timeCategory] || 0) + 1;
  });
  
  return timeCount;
});

// 가상 필드: 인계장 날짜 포맷팅
handoverSchema.virtual('formattedHandoverDate').get(function() {
  if (!this.handoverDate) return '';
  const date = new Date(this.handoverDate);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
});

module.exports = mongoose.model('Handover', handoverSchema);
