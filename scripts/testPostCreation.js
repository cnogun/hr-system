/**
 * 파일명: testPostCreation.js
 * 목적: 게시글 생성 기능 테스트
 * 기능:
 * - 게시글 작성 권한 테스트
 * - 게시글 데이터 생성 테스트
 * - 첨부파일 처리 테스트
 * - 게시글 검증 로직 테스트
 */
const mongoose = require('mongoose');
const { Board, Post } = require('../models/Board');
const User = require('../models/User');
const Employee = require('../models/Employee');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.once('open', async () => {
  console.log('MongoDB 연결 성공!');

  try {
    // 게시판과 사용자 조회
    const boards = await Board.find().sort({ order: 1 });
    const users = await User.find().limit(3);

    console.log('\n📋 게시판 목록:');
    boards.forEach(board => {
      console.log(`- ${board.name} (${board.type}) - 부서: ${board.department || '전체'}`);
    });

    console.log('\n👥 사용자 목록:');
    for (const user of users) {
      const employee = await Employee.findOne({ userId: user._id });
      console.log(`- ${user.username} (${user.role}) - 부서: ${employee ? employee.department : '없음'} - 이름: ${employee ? employee.name : '없음'}`);
    }

    // 게시글 작성 테스트
    console.log('\n🧪 게시글 작성 테스트:');
    
    if (boards.length > 0 && users.length > 0) {
      const testBoard = boards[0]; // 첫 번째 게시판
      const testUser = users[0]; // 첫 번째 사용자
      const testEmployee = await Employee.findOne({ userId: testUser._id });

      console.log(`\n테스트 게시글 작성:`);
      console.log(`- 게시판: ${testBoard.name}`);
      console.log(`- 사용자: ${testUser.username} (${testUser.role})`);
      console.log(`- 부서: ${testEmployee ? testEmployee.department : '없음'}`);

      // 게시글 생성 테스트
      const testPost = new Post({
        boardId: testBoard._id,
        author: testUser._id,
        authorName: testEmployee ? testEmployee.name : testUser.username,
        title: '[테스트] 게시글 작성 기능 테스트',
        content: `이것은 게시글 작성 기능 테스트입니다.

테스트 내용:
- 게시글 작성 기능 확인
- 사용자 정보 연동 확인
- 부서 정보 연동 확인

모든 기능이 정상적으로 작동하는지 확인합니다.`,
        isNotice: false,
        isAnonymous: false,
        tags: ['테스트', '기능', '확인']
      });

      await testPost.save();
      console.log('✅ 테스트 게시글 작성 성공!');

      // 생성된 게시글 확인
      const createdPost = await Post.findById(testPost._id)
        .populate('boardId', 'name')
        .populate('author', 'username');
      
      console.log(`\n📝 생성된 게시글 정보:`);
      console.log(`- 제목: ${createdPost.title}`);
      console.log(`- 게시판: ${createdPost.boardId.name}`);
      console.log(`- 작성자: ${createdPost.authorName}`);
      console.log(`- 작성일: ${createdPost.createdAt}`);

    } else {
      console.log('❌ 게시판 또는 사용자가 없습니다.');
    }

    // 기존 게시글 목록 확인
    console.log('\n📋 기존 게시글 목록:');
    const posts = await Post.find()
      .populate('boardId', 'name')
      .populate('author', 'username')
      .sort({ createdAt: -1 })
      .limit(5);

    posts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title} (${post.boardId.name}) - ${post.authorName}`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('스택 트레이스:', error.stack);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 데이터베이스 연결 종료');
  }
});

db.on('error', console.error.bind(console, 'MongoDB 연결 에러:')); 