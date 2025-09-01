/**
 * 파일명: Log.js
 * 목적: 시스템 활동 로그 데이터 모델 정의
 * 기능:
 * - 사용자 활동 기록 (로그인, 로그아웃, 데이터 수정 등)
 * - 활동 상세 정보 및 IP 주소 기록
 * - 사용자 에이전트 정보 저장
 * - 활동 시간 기록
 * - 데이터 검증 및 스키마 정의
 */

const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // ex: login, logout, update, delete
  detail: { type: String }, // ex: '직원정보 수정', '비밀번호 변경' 등
  ip: { type: String },
  userAgent: { type: String },
  createdAt: { 
    type: Date, 
    default: function() {
      // 한국 시간대 (UTC+9)로 현재 시간 설정
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      return koreaTime;
    }
  }
});

module.exports = mongoose.model('Log', logSchema); 