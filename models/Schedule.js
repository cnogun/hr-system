const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['meeting', 'training', 'maintenance', 'inspection', 'routine'],
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체']
  },
  startDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endDate: {
    type: Date
  },
  endTime: {
    type: String
  },
  location: {
    type: String,
    trim: true
  },
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  recurring: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      default: 1
    },
    endAfter: {
      type: Number // 반복 횟수
    },
    endDate: Date
  },
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
  reminder: {
    enabled: {
      type: Boolean,
      default: false
    },
    time: {
      type: Number, // 분 단위 (예: 15 = 15분 전)
      default: 15
    }
  }
}, {
  timestamps: true
});

// 일정 검색 및 정렬을 위한 인덱스
scheduleSchema.index({ startDate: 1, startTime: 1 });
scheduleSchema.index({ department: 1, type: 1 });
scheduleSchema.index({ status: 1, priority: 1 });
scheduleSchema.index({ createdBy: 1, startDate: -1 });

// 가상 필드: 전체 일정 시간
scheduleSchema.virtual('fullStartDateTime').get(function() {
  if (this.startDate && this.startTime) {
    const date = new Date(this.startDate);
    const [hours, minutes] = this.startTime.split(':');
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  }
  return null;
});

scheduleSchema.virtual('fullEndDateTime').get(function() {
  if (this.endDate && this.endTime) {
    const date = new Date(this.endDate);
    const [hours, minutes] = this.endTime.split(':');
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  }
  return null;
});

module.exports = mongoose.model('Schedule', scheduleSchema);
