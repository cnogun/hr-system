/**
 * 파일명: PasswordReset.js
 * 목적: 비밀번호 재설정 토큰 관리 데이터 모델 정의
 * 기능:
 * - 비밀번호 재설정 토큰 생성 및 관리
 * - 토큰 만료 시간 설정
 * - 사용자 이메일 연결
 * - 토큰 검증 및 사용 여부 관리
 * - 데이터 검증 및 스키마 정의
 */

const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 3600 // 1시간 후 자동 삭제
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 토큰 생성 메서드
passwordResetSchema.statics.createToken = function(email) {
  const token = require('crypto').randomBytes(32).toString('hex');
  return this.create({
    email,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1시간
  });
};

// 토큰 검증 메서드
passwordResetSchema.statics.verifyToken = function(token) {
  return this.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('PasswordReset', passwordResetSchema); 