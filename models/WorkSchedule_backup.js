/**
 * 파일명: WorkSchedule.js
 * 목적: 근무형태와 근무시간 관리 모델
 * 기능:
 * - 근무팀별 근무형태 관리
 * - 평일/주말 근무시간 관리
 * - 근무스케줄 자동화
 */
const mongoose = require('mongoose');

const workScheduleSchema = new mongoose.Schema({
  // 근무팀
  team: {
    type: String,
    required: true,
    enum: ['보안1반', '보안2반', '보안3반'],
    unique: true
  },
  
  // 근무형태
  workType: {
    type: String,
    required: true,
    enum: ['주간근무', '야간근무', '주간특근', '야간특근']
  },
  
  // 평일 근무시간
  weekdaySchedule: {
    startTime: {
      type: String,
      required: true,
      default: '06:00'
    },
    endTime: {
      type: String,
      required: true,
      default: '18:00'
    }
  },
  
  // 주말 근무시간
  weekendSchedule: {
    startTime: {
      type: String,
      required: true,
      default: '06:00'
    },
    endTime: {
      type: String,
      required: true,
      default: '18:00'
    }
  },
  
  // 활성화 상태
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 생성일
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // 수정일
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 수정일 자동 업데이트
workScheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 근무시간 포맷팅 메서드
workScheduleSchema.methods.getWorkTime = function(isWeekend = false) {
  const schedule = isWeekend ? this.weekendSchedule : this.weekdaySchedule;
  return `${schedule.startTime}~${schedule.endTime}`;
};

// 근무형태 확인 메서드
workScheduleSchema.methods.isNightShift = function() {
  return this.workType.includes('야간');
};

// 근무형태 확인 메서드
workScheduleSchema.methods.isSpecialShift = function() {
  return this.workType.includes('특근');
};

module.exports = mongoose.model('WorkSchedule', workScheduleSchema);