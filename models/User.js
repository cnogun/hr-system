/**
 * 파일명: User.js
 * 목적: 사용자 계정 정보 데이터 모델 정의
 * 기능:
 * - 사용자 인증 정보 (이메일, 비밀번호)
 * - 사용자 역할 및 권한 관리 (admin, user)
 * - 부서 및 직급 정보
 * - 계정 생성일 및 수정일 관리
 * - 데이터 검증 및 스키마 정의
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  profileImage: { type: String },
});

module.exports = mongoose.model('User', userSchema); 