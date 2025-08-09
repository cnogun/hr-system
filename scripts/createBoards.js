/**
 * 파일명: createBoards.js
 * 목적: 게시판 초기 데이터 생성
 * 기능:
 * - 기본 게시판 생성 (공지사항, 자유게시판, 부서별 게시판)
 * - 게시판 권한 설정
 * - 게시판 순서 및 활성화 상태 설정
 * - 데이터베이스 초기화
 */

const mongoose = require('mongoose');
const { Board } = require('../models/Board');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.once('open', async () => {
  console.log('MongoDB 연결 성공!');

  try {
    // 기존 게시판 삭제
    await Board.deleteMany({});
    console.log('✅ 기존 게시판 삭제 완료');

    // 게시판 데이터 생성
    const boards = [
      {
        name: '공지사항',
        type: 'notice',
        description: '회사 공지사항을 확인하세요',
        writePermission: 'admin',
        readPermission: 'all',
        order: 1
      },
      {
        name: '자유게시판',
        type: 'free',
        description: '직원들의 자유로운 소통 공간',
        writePermission: 'all',
        readPermission: 'all',
        order: 2
      },
      {
        name: '보안1팀 게시판',
        type: 'department',
        department: '보안1팀',
        description: '보안1팀 전용 게시판',
        writePermission: 'department',
        readPermission: 'department',
        order: 3
      },
      {
        name: '보안2팀 게시판',
        type: 'department',
        department: '보안2팀',
        description: '보안2팀 전용 게시판',
        writePermission: 'department',
        readPermission: 'department',
        order: 4
      },
      {
        name: '보안3팀 게시판',
        type: 'department',
        department: '보안3팀',
        description: '보안3팀 전용 게시판',
        writePermission: 'department',
        readPermission: 'department',
        order: 5
      }
    ];

    await Board.insertMany(boards);
    console.log('✅ 게시판 생성 완료:', boards.length, '개');

    // 생성된 게시판 목록 출력
    const createdBoards = await Board.find().sort({ order: 1 });
    console.log('\n📋 생성된 게시판 목록:');
    createdBoards.forEach(board => {
      console.log(`- ${board.name} (${board.type}) - ${board.description}`);
    });

    console.log('\n🎉 게시판 초기 데이터 생성 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 데이터베이스 연결 종료');
  }
});

db.on('error', console.error.bind(console, 'MongoDB 연결 에러:')); 