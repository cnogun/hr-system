/**
 * 파일명: Notice.js
 * 목적: 시스템 알림(공지사항) 데이터 모델 정의
 * 기능:
 * - 시스템 알림 제목 및 내용 관리
 * - 작성자 정보 연결
 * - 생성일 및 수정일 관리
 * - 데이터 검증 및 스키마 정의
 */

const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notice', noticeSchema); 