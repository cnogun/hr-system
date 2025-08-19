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
  
  // 주말 근무 인원 배정
  weekendSchedule: {
    saturday: {
      dayShift: {
        team1Count: { type: Number, default: 0 }, // 1팀 인원 중 3/4
        team3Count: { type: Number, default: 0 }  // 3팀 휴무조 1/2
      },
      nightShift: {
        team2Count: { type: Number, default: 0 }, // 2팀 인원 중 3/4
        team3Count: { type: Number, default: 0 }  // 3팀 휴무조 1/2
      }
    },
    sunday: {
      dayShift: {
        team1Count: { type: Number, default: 0 }, // 1팀 인원 중 1/4
        team3Count: { type: Number, default: 0 }  // 3팀 휴무조 1/2
      },
      nightShift: {
        team2Count: { type: Number, default: 0 }, // 2팀 인원 중 1/4
        team3Count: { type: Number, default: 0 }  // 3팀 휴무조 1/2
      }
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

module.exports = mongoose.model('WorkSchedule', workScheduleSchema);
