/**
 * 파일명: Board.js
 * 목적: 게시판 시스템 데이터 모델 정의
 * 기능:
 * - 게시판 정보 (이름, 타입, 부서별 설정)
 * - 게시글 및 댓글 관리
 * - 권한 설정 (읽기/쓰기 권한)
 * - 첨부파일 관리
 * - 좋아요/싫어요 기능
 * - 신고 기능
 * - 데이터 검증 및 스키마 정의
 */
const mongoose = require('mongoose');

// 게시판 스키마
const boardSchema = new mongoose.Schema({
  name: { type: String, required: true }, // 게시판 이름
  type: { type: String, enum: ['notice', 'free', 'department'], required: true }, // 게시판 타입
  department: { type: String }, // 부서별 게시판인 경우 부서명
  description: { type: String }, // 게시판 설명
  writePermission: { type: String, enum: ['admin', 'all', 'department'], default: 'admin' }, // 글쓰기 권한
  readPermission: { type: String, enum: ['all', 'department'], default: 'all' }, // 읽기 권한
  isActive: { type: Boolean, default: true }, // 활성화 여부
  order: { type: Number, default: 0 } // 정렬 순서
}, {
  timestamps: true
});

// 신고 스키마
const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 신고자
  reporterName: { type: String, required: true }, // 신고자 이름
  targetType: { type: String, enum: ['post', 'comment'], required: true }, // 신고 대상 타입
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true }, // 신고 대상 ID
  reason: { type: String, enum: ['spam', 'inappropriate', 'harassment', 'copyright', 'other'], required: true }, // 신고 사유
  description: { type: String }, // 상세 설명
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' }, // 처리 상태
  adminNote: { type: String }, // 관리자 메모
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 처리자
  processedAt: { type: Date } // 처리 일시
}, {
  timestamps: true
});

// 게시글 스키마
const postSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true }, // 게시판 ID
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 작성자
  authorName: { type: String, required: true }, // 작성자 이름
  title: { type: String, required: true }, // 제목
  content: { type: String, required: true }, // 내용
  isNotice: { type: Boolean, default: false }, // 공지사항 여부
  isAnonymous: { type: Boolean, default: false }, // 익명 여부
  attachments: [{ // 첨부파일
    filename: String,
    originalName: String,
    path: String,
    size: Number
  }],
  views: { type: Number, default: 0 }, // 조회수
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 좋아요
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 싫어요
  tags: [String], // 태그
  reportCount: { type: Number, default: 0 }, // 신고 수
  isHidden: { type: Boolean, default: false }, // 숨김 처리 여부
  searchKeywords: [String] // 검색 키워드 (태그 + 제목 키워드)
}, {
  timestamps: true
});

// 댓글 스키마
const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true }, // 게시글 ID
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 작성자
  authorName: { type: String, required: true }, // 작성자 이름
  content: { type: String, required: true }, // 내용
  isAnonymous: { type: Boolean, default: false }, // 익명 여부
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }, // 부모 댓글 (대댓글용)
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 좋아요
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 싫어요
  reportCount: { type: Number, default: 0 }, // 신고 수
  isHidden: { type: Boolean, default: false } // 숨김 처리 여부
}, {
  timestamps: true
});

// 검색 키워드 업데이트 미들웨어
postSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isModified('content') || this.isModified('tags')) {
    const keywords = [];
    
    // 제목에서 키워드 추출
    if (this.title) {
      keywords.push(...this.title.split(/\s+/));
    }
    
    // 태그 추가
    if (this.tags && this.tags.length > 0) {
      keywords.push(...this.tags);
    }
    
    // 중복 제거 및 정리
    this.searchKeywords = [...new Set(keywords.filter(keyword => keyword.length > 1))];
  }
  next();
});

// 인덱스 설정
postSchema.index({ boardId: 1, createdAt: -1 });
postSchema.index({ title: 'text', content: 'text', searchKeywords: 'text' });
postSchema.index({ searchKeywords: 1 });
postSchema.index({ reportCount: -1 });
commentSchema.index({ postId: 1, createdAt: 1 });
commentSchema.index({ reportCount: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  Board: mongoose.model('Board', boardSchema),
  Post: mongoose.model('Post', postSchema),
  Comment: mongoose.model('Comment', commentSchema),
  Report: mongoose.model('Report', reportSchema)
}; 