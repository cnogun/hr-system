/**
 * 파일명: WorkSchedule.js
 * 목적: 근무 스케줄 관리 모델
 * 기능:
 * - 주차별 근무 스케줄 관리
 * - 팀별 근무 형태 관리
 * - 주말 근무 인원 배정 관리
 * - 공휴일 관리
 */
const mongoose = require('mongoose');

const workScheduleSchema = new mongoose.Schema({
  // 주차 정보
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  
  // 현재 주차 근무 형태
  currentWeekSchedule: {
    team1: {
      type: String,
      required: true,
      default: '출근(초)'
    },
    team2: {
      type: String,
      required: true,
      default: '출근(심)'
    },
    team3: {
      type: String,
      required: true,
      default: '출근(주)'
    }
  },
  
  // 주말 근무 스케줄
  weekendSchedule: {
    // 토요일 근무
    saturday: {
      dayShift: {
        team1Count: { type: Number, default: 0 },
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      },
      nightShift: {
        team1Count: { type: Number, default: 0 },
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      }
    },
    // 일요일 근무
    sunday: {
      dayShift: {
        team1Count: { type: Number, default: 0 },
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      },
      nightShift: {
        team1Count: { type: Number, default: 0 },
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      }
    },
    // 팀별 조별 편성 명단
    team1: {
      aGroup: { type: String, default: '' },
      bGroup: { type: String, default: '' },
      group1: { type: String, default: '' },
      group2: { type: String, default: '' },
      group3: { type: String, default: '' },
      group4: { type: String, default: '' }
    },
    team2: {
      aGroup: { type: String, default: '' },
      bGroup: { type: String, default: '' },
      group1: { type: String, default: '' },
      group2: { type: String, default: '' },
      group3: { type: String, default: '' },
      group4: { type: String, default: '' }
    },
    team3: {
      aGroup: { type: String, default: '' },
      bGroup: { type: String, default: '' },
      group1: { type: String, default: '' },
      group2: { type: String, default: '' },
      group3: { type: String, default: '' },
      group4: { type: String, default: '' }
    }
  },
  
  // 공휴일 정보
  holidays: [{
    date: {
      type: Date,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    isWeekday: {
      type: Boolean,
      default: false
    },
    specialWorkType: {
      type: String,
      enum: ['평일특근', '다음날특근'],
      default: '평일특근'
    }
  }],
  
  // 상태
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  },
  
  // 생성자
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// 주차 번호 계산 메서드
workScheduleSchema.methods.getWeekNumber = function() {
  const yearStart = new Date(2025, 0, 1, 6, 0, 0); // 2025년 1월 1일 06:00
  const weekStartDate = new Date(this.weekStartDate);
  
  // 월요일 06:00으로 조정
  const dayOfWeek = weekStartDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday6am = new Date(weekStartDate);
  monday6am.setDate(weekStartDate.getDate() - mondayOffset);
  monday6am.setHours(6, 0, 0, 0);
  
  const weekDiff = Math.floor((monday6am - yearStart) / (7 * 24 * 60 * 60 * 1000));
  return weekDiff + 2; // 1월 1일 수요일이 1주차, 1월 6일 월요일이 2주차
};

// 팀별 근무 형태 반환 메서드
workScheduleSchema.methods.getTeamSchedule = function(teamNumber) {
  const weekNumber = this.getWeekNumber();
  const cycle = (weekNumber - 1) % 3; // 0, 1, 2 반복
  
  if (teamNumber === 1) {
    // 1반: 초야(cycle 0) → 주간(cycle 1) → 심야(cycle 2)
    const schedules = ['초야', '주간', '심야'];
    return schedules[cycle];
  } else if (teamNumber === 2) {
    // 2반: 심야(cycle 0) → 초야(cycle 1) → 주간(cycle 2)
    const schedules = ['심야', '초야', '주간'];
    return schedules[cycle];
  } else if (teamNumber === 3) {
    // 3반: 주간(cycle 0) → 심야(cycle 1) → 초야(cycle 2)
    const schedules = ['주간', '심야', '초야'];
    return schedules[cycle];
  }
  
  return '주간';
};

// 근무 시간 반환 메서드
workScheduleSchema.methods.getWorkTime = function(schedule) {
  switch(schedule) {
    case '주간': return '06:00~14:00';
    case '심야': return '22:00~06:00';
    case '초야': return '14:00~22:00';
    default: return '00:00~00:00';
  }
};

module.exports = mongoose.model('WorkSchedule', workScheduleSchema);
