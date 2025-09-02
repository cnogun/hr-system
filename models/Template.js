/**
 * 파일명: Template.js
 * 목적: 양식 템플릿 데이터 모델
 * 기능:
 * - 일일/주간/월간 근무 명령서 양식 관리
 * - 부서별 양식 분류
 * - 기본 양식 설정
 * - 파일 업로드 및 다운로드
 */
const mongoose = require('mongoose');
const fs = require('fs');

const templateSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    required: true,
    enum: ['보안1팀', '보안2팀', '보안3팀', '전체']
  },
  templateType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'special'],
    default: 'daily'
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 인덱스 설정
templateSchema.index({ department: 1, templateType: 1 });
templateSchema.index({ isDefault: 1, department: 1 });
templateSchema.index({ isActive: 1 });

// 가상 필드: 파일 확장자
templateSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// 가상 필드: 파일 크기 (읽기 쉬운 형태)
templateSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// 가상 필드: 템플릿 타입 한글명
templateSchema.virtual('templateTypeKorean').get(function() {
  const types = {
    'daily': '일일 근무 명령서',
    'weekly': '주간 근무 명령서',
    'monthly': '월간 근무 명령서',
    'special': '특별 지시사항'
  };
  return types[this.templateType] || this.templateType;
});

// 기본 양식 설정 시 다른 기본 양식들 해제
templateSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { 
        department: this.department, 
        templateType: this.templateType,
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    );
  }
  next();
});

// 파일 삭제 시 실제 파일도 삭제
templateSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  } catch (error) {
    console.error('파일 삭제 오류:', error);
  }
  next();
});

module.exports = mongoose.model('Template', templateSchema);
