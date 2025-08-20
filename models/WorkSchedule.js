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
  
  // 이번주 근무 형태
  currentWeekSchedule: {
    team1: {
      type: String,
      enum: ['출근(초)', '출근(심)', '출근(주)'],
      required: true
    },
    team2: {
      type: String,
      enum: ['출근(초)', '출근(심)', '출근(주)'],
      required: true
    },
    team3: {
      type: String,
      enum: ['출근(초)', '출근(심)', '출근(주)'],
      required: true
    }
  },
  
  // 주말 근무 인원 배정 (팀별 조별 편성 명단)
  weekendSchedule: {
    // 토요일 근무 정보 (기존 구조 유지)
    saturday: {
      dayShift: {
        team1Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      },
      nightShift: {
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      }
    },
    // 일요일 근무 정보 (기존 구조 유지)
    sunday: {
      dayShift: {
        team1Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      },
      nightShift: {
        team2Count: { type: Number, default: 0 },
        team3Count: { type: Number, default: 0 }
      }
    },
    // 팀별 조별 편성 명단 (새로 추가)
    team1: {
      aGroup: { type: String, default: '' }, // A조 (일요일 주간근무)
      bGroup: { type: String, default: '' }, // B조 (일요일 야간근무)
      group1: { type: String, default: '' }, // 1조 (지원근무)
      group2: { type: String, default: '' }, // 2조 (지원근무)
      group3: { type: String, default: '' }, // 3조 (지원근무)
      group4: { type: String, default: '' }  // 4조 (지원근무)
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
  
  // 법정공휴일 정보
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
      required: true
    },
    specialWorkType: {
      type: String,
      enum: ['평일특근', '다음날특근'],
      default: '평일특근'
    }
  }],
  
  // 생성자
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 상태
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// 주차별 검색을 위한 인덱스
workScheduleSchema.index({ weekStartDate: 1, weekEndDate: 1 });
workScheduleSchema.index({ status: 1 });

// 가상 필드: 주차 번호
workScheduleSchema.virtual('weekNumber').get(function() {
  const start = new Date(this.weekStartDate);
  const firstDayOfYear = new Date(start.getFullYear(), 0, 1);
  const pastDaysOfYear = (start - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
});

// 가상 필드: 년도
workScheduleSchema.virtual('year').get(function() {
  return this.weekStartDate.getFullYear();
});

// 가상 필드: 주차 기간 표시
workScheduleSchema.virtual('weekPeriod').get(function() {
  const start = this.weekStartDate;
  const end = this.weekEndDate;
  return `${start.getMonth() + 1}월 ${start.getDate()}일 06:00 ~ ${end.getMonth() + 1}월 ${end.getDate()}일 06:00`;
});

module.exports = mongoose.model('WorkSchedule', workScheduleSchema);
