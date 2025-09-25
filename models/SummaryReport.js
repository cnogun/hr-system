const mongoose = require('mongoose');

const summaryReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  reportType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'incident', 'security', 'maintenance'],
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체']
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  summary: {
    type: String,
    required: true
  },
  keyPoints: [{
    type: String,
    trim: true
  }],
  statistics: {
    totalIncidents: {
      type: Number,
      default: 0
    },
    resolvedIncidents: {
      type: Number,
      default: 0
    },
    securityBreaches: {
      type: Number,
      default: 0
    },
    maintenanceCompleted: {
      type: Number,
      default: 0
    },
    trainingCompleted: {
      type: Number,
      default: 0
    }
  },
  issues: [{
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    dueDate: Date,
    resolution: String
  }],
  recommendations: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
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
  }]
}, {
  timestamps: true
});

// 인덱스 설정
summaryReportSchema.index({ department: 1, reportType: 1 });
summaryReportSchema.index({ 'period.startDate': -1, 'period.endDate': -1 });
summaryReportSchema.index({ status: 1, priority: 1 });
summaryReportSchema.index({ createdBy: 1, createdAt: -1 });

// 가상 필드: 해결률 계산
summaryReportSchema.virtual('resolutionRate').get(function() {
  if (this.statistics.totalIncidents === 0) return 0;
  return Math.round((this.statistics.resolvedIncidents / this.statistics.totalIncidents) * 100);
});

// 가상 필드: 보고서 기간 (일수)
summaryReportSchema.virtual('periodDays').get(function() {
  const diffTime = Math.abs(this.period.endDate - this.period.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
});

// 가상 필드: 미해결 이슈 수
summaryReportSchema.virtual('openIssuesCount').get(function() {
  return this.issues.filter(issue => issue.status !== 'resolved' && issue.status !== 'closed').length;
});

// 가상 필드: 높은 우선순위 이슈 수
summaryReportSchema.virtual('highPriorityIssuesCount').get(function() {
  return this.issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical').length;
});

// 미들웨어: 기간 검증
summaryReportSchema.pre('save', function(next) {
  if (this.period.startDate >= this.period.endDate) {
    return next(new Error('종료 날짜는 시작 날짜보다 이후여야 합니다.'));
  }
  next();
});

// 미들웨어: 통계 자동 계산
summaryReportSchema.pre('save', function(next) {
  // 이슈 기반 통계 자동 계산
  if (this.issues && this.issues.length > 0) {
    this.statistics.totalIncidents = this.issues.length;
    this.statistics.resolvedIncidents = this.issues.filter(issue => 
      issue.status === 'resolved' || issue.status === 'closed'
    ).length;
  }
  next();
});

module.exports = mongoose.model('SummaryReport', summaryReportSchema);
