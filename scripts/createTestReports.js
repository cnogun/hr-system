/**
 * 파일명: createTestReports.js
 * 목적: 테스트용 신고 데이터 생성
 * 기능:
 * - 다양한 유형의 신고 데이터 생성
 * - 게시글 및 댓글 신고 생성
 * - 신고 상태별 데이터 생성
 * - 신고 사유별 데이터 생성
 * - 데이터베이스 시드 데이터 삽입
 */
const mongoose = require('mongoose');
require('dotenv').config();

// 모델 불러오기
const { Post, Comment, Report } = require('../models/Board');
const User = require('../models/User');

async function createTestReports() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log('MongoDB 연결 성공!');

    // 기존 신고 데이터 삭제
    await Report.deleteMany({});
    console.log('기존 신고 데이터 삭제 완료');

    // 사용자와 게시글 가져오기
    const users = await User.find({});
    const posts = await Post.find({});
    const comments = await Comment.find({});

    if (users.length === 0 || posts.length === 0) {
      console.log('사용자나 게시글이 없습니다. 먼저 테스트 데이터를 생성해주세요.');
      return;
    }

    const reportReasons = ['spam', 'inappropriate', 'harassment', 'copyright', 'other'];
    const reportStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];

    // 게시글 신고 생성
    for (let i = 0; i < 5; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      const randomReason = reportReasons[Math.floor(Math.random() * reportReasons.length)];
      const randomStatus = reportStatuses[Math.floor(Math.random() * reportStatuses.length)];

      const report = new Report({
        reporter: randomUser._id,
        reporterName: randomUser.name || randomUser.username,
        targetType: 'post',
        targetId: randomPost._id,
        reason: randomReason,
        description: `테스트 신고 ${i + 1}: ${randomReason} 사유로 신고합니다.`,
        status: randomStatus,
        adminNote: randomStatus !== 'pending' ? `관리자 처리 메모 ${i + 1}` : null,
        processedBy: randomStatus !== 'pending' ? users.find(u => u.role === 'admin')?._id : null,
        processedAt: randomStatus !== 'pending' ? new Date() : null
      });

      await report.save();

      // 게시글 신고 수 증가
      randomPost.reportCount += 1;
      await randomPost.save();
    }

    // 댓글 신고 생성 (댓글이 있는 경우)
    if (comments.length > 0) {
      for (let i = 0; i < 3; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        const randomReason = reportReasons[Math.floor(Math.random() * reportReasons.length)];
        const randomStatus = reportStatuses[Math.floor(Math.random() * reportStatuses.length)];

        const report = new Report({
          reporter: randomUser._id,
          reporterName: randomUser.name || randomUser.username,
          targetType: 'comment',
          targetId: randomComment._id,
          reason: randomReason,
          description: `테스트 댓글 신고 ${i + 1}: ${randomReason} 사유로 신고합니다.`,
          status: randomStatus,
          adminNote: randomStatus !== 'pending' ? `관리자 처리 메모 ${i + 1}` : null,
          processedBy: randomStatus !== 'pending' ? users.find(u => u.role === 'admin')?._id : null,
          processedAt: randomStatus !== 'pending' ? new Date() : null
        });

        await report.save();

        // 댓글 신고 수 증가
        randomComment.reportCount += 1;
        await randomComment.save();
      }
    }

    console.log('테스트 신고 데이터 생성 완료!');
    console.log(`- 게시글 신고: 5개`);
    console.log(`- 댓글 신고: ${comments.length > 0 ? '3개' : '0개'}`);

    // 통계 출력
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });

    console.log('\n신고 통계:');
    console.log(`- 전체 신고: ${totalReports}개`);
    console.log(`- 대기중: ${pendingReports}개`);
    console.log(`- 해결됨: ${resolvedReports}개`);

  } catch (error) {
    console.error('테스트 신고 데이터 생성 오류:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB 연결 종료');
  }
}

createTestReports(); 