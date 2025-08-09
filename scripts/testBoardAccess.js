/**
 * 파일명: testBoardAccess.js
 * 목적: 게시판 접근 권한 테스트
 * 기능:
 * - 게시판별 접근 권한 검증
 * - 사용자 역할별 권한 테스트
 * - 부서별 게시판 접근 테스트
 * - 권한 검증 로직 디버깅
 */
const mongoose = require('mongoose');
const { Board } = require('../models/Board');
const User = require('../models/User');
const Employee = require('../models/Employee');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.once('open', async () => {
  console.log('MongoDB 연결 성공!');

  try {
    // 게시판 목록 조회
    const boards = await Board.find().sort({ order: 1 });
    console.log('\n📋 전체 게시판 목록:');
    boards.forEach(board => {
      console.log(`- ${board.name} (${board.type}) - 부서: ${board.department || '전체'} - 읽기권한: ${board.readPermission} - 쓰기권한: ${board.writePermission}`);
    });

    // 사용자와 직원 정보 조회
    const users = await User.find();
    console.log('\n👥 사용자 목록:');
    for (const user of users) {
      const employee = await Employee.findOne({ userId: user._id });
      console.log(`- ${user.username} (${user.role}) - ${employee ? `${employee.name} (${employee.department} ${employee.position})` : '직원 정보 없음'}`);
    }

    // 권한 테스트 시뮬레이션
    console.log('\n🔐 권한 테스트 시뮬레이션:');
    
    const testCases = [
      { username: 'admin', role: 'admin', department: null, position: null },
      { username: 'manager1', role: 'user', department: '보안1팀', position: '과장' },
      { username: 'manager2', role: 'user', department: '보안2팀', position: '과장' },
      { username: 'manager3', role: 'user', department: '보안3팀', position: '과장' },
      { username: 'employee1', role: 'user', department: '보안1팀', position: '보안관' },
      { username: 'employee2', role: 'user', department: '보안2팀', position: '보안관' },
      { username: 'employee3', role: 'user', department: '관리팀', position: '팀장' }
    ];

    for (const testCase of testCases) {
      console.log(`\n👤 ${testCase.username} (${testCase.role}) - ${testCase.department || '전체'} ${testCase.position || ''}`);
      
      // 접근 가능한 게시판 필터링
      let accessibleBoards = boards;
      if (testCase.role !== 'admin') {
        accessibleBoards = boards.filter(board => {
          // 공지사항과 자유게시판은 모든 사용자에게 표시
          if (board.type === 'notice' || board.type === 'free') {
            return true;
          }
          // 부서별 게시판은 본인 부서만 표시
          if (board.type === 'department' && board.department === testCase.department) {
            return true;
          }
          return false;
        });
      }

      console.log('  📖 읽기 가능한 게시판:');
      accessibleBoards.forEach(board => {
        console.log(`    - ${board.name}`);
      });

      console.log('  ✍️ 글쓰기 가능한 게시판:');
      accessibleBoards.forEach(board => {
        let canWrite = false;
        let reason = '';

        if (board.writePermission === 'admin') {
          canWrite = testCase.role === 'admin';
          reason = testCase.role === 'admin' ? '관리자 권한' : '관리자만 가능';
        } else if (board.writePermission === 'department') {
          const isAdmin = testCase.role === 'admin';
          const isSameDepartment = testCase.department === board.department;
          
          canWrite = isAdmin || isSameDepartment;
          reason = isAdmin ? '관리자 권한' : 
                   isSameDepartment ? '해당 부서원' : '해당 부서만 가능';
        }

        console.log(`    - ${board.name}: ${canWrite ? '✅ 가능' : '❌ 불가능'} (${reason})`);
      });
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 데이터베이스 연결 종료');
  }
});

db.on('error', console.error.bind(console, 'MongoDB 연결 에러:')); 