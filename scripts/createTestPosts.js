/**
 * 파일명: createTestPosts.js
 * 목적: 테스트용 게시글 데이터 생성
 * 기능:
 * - 다양한 게시판에 테스트 게시글 생성
 * - 댓글 데이터 생성
 * - 첨부파일 정보 생성
 * - 좋아요/싫어요 데이터 생성
 * - 데이터베이스 시드 데이터 삽입
 */
const mongoose = require('mongoose');
const { Board, Post } = require('../models/Board');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.once('open', async () => {
  console.log('MongoDB 연결 성공!');

  try {
    // 기존 테스트 게시글 삭제
    await Post.deleteMany({ title: { $regex: /^\[테스트\]/ } });
    console.log('✅ 기존 테스트 게시글 삭제 완료');

    // 게시판과 사용자 조회
    const boards = await Board.find().sort({ order: 1 });
    const users = await User.find().limit(3);

    if (boards.length === 0) {
      console.log('❌ 게시판이 없습니다. 먼저 createBoards.js를 실행하세요.');
      return;
    }

    if (users.length === 0) {
      console.log('❌ 사용자가 없습니다. 먼저 createTestData.js를 실행하세요.');
      return;
    }

    // 테스트 게시글 데이터
    const testPosts = [
      {
        title: '[테스트] 공지사항 테스트',
        content: `안녕하세요! 이것은 공지사항 테스트 게시글입니다.

주요 내용:
- 회사 공지사항 확인
- 중요 일정 안내
- 업무 관련 공지

모든 직원분들께서 확인해 주시기 바랍니다.`,
        isNotice: true,
        isAnonymous: false,
        tags: ['공지', '중요', '업무']
      },
      {
        title: '[테스트] 자유게시판 테스트',
        content: `안녕하세요! 자유게시판 테스트입니다.

오늘 날씨가 정말 좋네요! 
회사 근처에 맛집 추천받습니다.

- 점심 메뉴 추천
- 퇴근 후 모임 제안
- 주말 계획 공유

자유롭게 댓글 남겨주세요!`,
        isNotice: false,
        isAnonymous: false,
        tags: ['일상', '맛집', '모임']
      },
      {
        title: '[테스트] 보안1팀 업무 공유',
        content: `보안1팀 업무 공유 게시글입니다.

이번 주 업무 현황:
- 보안 시스템 점검 완료
- 신규 보안 정책 적용
- 다음 주 업무 계획

팀원분들 확인 부탁드립니다.`,
        isNotice: false,
        isAnonymous: false,
        tags: ['업무', '보안', '점검']
      },
      {
        title: '[테스트] 보안2팀 회의록',
        content: `보안2팀 회의록 공유합니다.

회의 일시: 2024년 1월 15일
참석자: 팀원 전체

주요 안건:
1. 보안 시스템 업그레이드
2. 신규 보안 정책 검토
3. 팀 내 업무 분담 조정

결의사항:
- 다음 주까지 시스템 업그레이드 완료
- 월말까지 정책 검토 완료`,
        isNotice: true,
        isAnonymous: false,
        tags: ['회의', '보안', '정책']
      },
      {
        title: '[테스트] 보안3팀 익명 건의사항',
        content: `익명으로 건의사항 올립니다.

현재 업무 환경 개선 제안:
1. 보안실 온도 조절 개선
2. 업무용 장비 추가 요청
3. 휴식 공간 확충

건의사항에 대한 검토 부탁드립니다.`,
        isNotice: false,
        isAnonymous: true,
        tags: ['건의', '개선', '환경']
      }
    ];

    // 게시글 생성
    for (let i = 0; i < testPosts.length; i++) {
      const postData = testPosts[i];
      const board = boards[i % boards.length];
      const user = users[i % users.length];

      const post = new Post({
        boardId: board._id,
        author: user._id,
        authorName: postData.isAnonymous ? '익명' : (user.name || user.username),
        title: postData.title,
        content: postData.content,
        isNotice: postData.isNotice,
        isAnonymous: postData.isAnonymous,
        tags: postData.tags,
        views: Math.floor(Math.random() * 50) + 1,
        likes: [],
        dislikes: []
      });

      await post.save();
      console.log(`✅ ${board.name}에 게시글 생성: ${postData.title}`);
    }

    console.log('\n🎉 테스트 게시글 생성 완료!');
    console.log('\n📋 생성된 게시글 목록:');
    
    const createdPosts = await Post.find({ title: { $regex: /^\[테스트\]/ } })
      .populate('boardId', 'name')
      .populate('author', 'username');
    
    createdPosts.forEach(post => {
      console.log(`- ${post.title} (${post.boardId.name}) - 작성자: ${post.authorName}`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 데이터베이스 연결 종료');
  }
});

db.on('error', console.error.bind(console, 'MongoDB 연결 에러:')); 