/**
 * 파일명: admin.js
 * 목적: 관리자 전용 기능 라우트 처리
 * 기능:
 * - 관리자 대시보드
 * - 시스템 통계 조회
 * - 사용자 관리
 * - 로그 조회
 * - 시스템 설정 관리
 * - 관리자 권한 검증
 */
const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/auth');
const { employeeUpload } = require('../utils/upload');
const { 
  generateEmpNo, 
  checkEmailDuplicate, 
  checkResidentNumberDuplicate, 
  checkUserIdDuplicate 
} = require('../utils/employee');

const Employee = require('../models/Employee');
const User = require('../models/User');
const Log = require('../models/Log');
const { Board, Post, Comment, Report } = require('../models/Board');

// 관리자용 직원 상세보기
router.get('/employees/:id', adminOnly, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).send('직원을 찾을 수 없습니다.');
    }
    
    // 디버깅: 상세보기 데이터 확인
    console.log('관리자 직원 상세보기 데이터:', {
      id: employee._id,
      name: employee.name,
      career: employee.career,
      specialNotes: employee.specialNotes,
      profileImage: employee.profileImage
    });
    
    res.render('employeeDetail', { employee, session: req.session });
  } catch (error) {
    console.error('관리자 직원 상세보기 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 관리자 대시보드
router.get('/dashboard', adminOnly, async (req, res) => {
  try {
    // 전체 통계
    const totalEmployees = await Employee.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });

    // 최근 7일 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentEmployees = await Employee.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const recentPosts = await Post.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const recentComments = await Comment.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const recentReports = await Report.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // 부서별 직원 통계
    const departmentStats = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // 게시판별 통계
    const boardStats = await Post.aggregate([
      {
        $group: {
          _id: '$boardId',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: { $size: '$likes' } },
          totalDislikes: { $sum: { $size: '$dislikes' } }
        }
      },
      {
        $lookup: {
          from: 'boards',
          localField: '_id',
          foreignField: '_id',
          as: 'board'
        }
      },
      {
        $unwind: '$board'
      },
      {
        $project: {
          boardName: '$board.name',
          boardType: '$board.type',
          postCount: '$count',
          totalViews: '$totalViews',
          totalLikes: '$totalLikes',
          totalDislikes: '$totalDislikes'
        }
      }
    ]);

    // 인기 게시글 (조회수 기준)
    const popularPosts = await Post.find({ isHidden: false })
      .populate('author', 'username name')
      .populate('boardId', 'name')
      .sort({ views: -1 })
      .limit(10);

    // 신고 통계
    const reportStats = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const reportReasonStats = await Report.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      }
    ]);

    res.render('admin/dashboard', {
      stats: {
        totalEmployees,
        totalUsers,
        totalPosts,
        totalComments,
        totalReports,
        pendingReports,
        recentEmployees,
        recentPosts,
        recentComments,
        recentReports
      },
      departmentStats,
      boardStats,
      popularPosts,
      reportStats,
      reportReasonStats,
      session: req.session
    });
  } catch (error) {
    console.error('관리자 대시보드 오류:', error);
    res.status(500).send('대시보드를 불러오는 중 오류가 발생했습니다.');
  }
});

// 관리자용 신고 목록
router.get('/reports', adminOnly, async (req, res) => {
  try {
    const { page = 1, status = '', type = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (type) query.targetType = type;

    const reports = await Report.find(query)
      .populate('reporter', 'username name')
      .populate('processedBy', 'username name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalReports = await Report.countDocuments(query);
    const totalPages = Math.ceil(totalReports / limit);

    res.render('admin/reports', {
      reports,
      currentPage: parseInt(page),
      totalPages,
      status,
      type,
      session: req.session 
    });
  } catch (error) {
    console.error('신고 목록 조회 오류:', error);
    res.status(500).send('신고 목록을 불러오는 중 오류가 발생했습니다.');
  }
});

// 관리자용 신고 처리
router.post('/reports/:reportId/process', adminOnly, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, adminNote } = req.body;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).send('신고를 찾을 수 없습니다.');
    }

    report.status = action; // 'reviewed', 'resolved', 'dismissed'
    report.adminNote = adminNote;
    report.processedBy = req.session.userId;
    report.processedAt = new Date();

    await report.save();

    // 신고가 해결된 경우 대상 게시글/댓글 숨김 처리
    if (action === 'resolved') {
      if (report.targetType === 'post') {
        await Post.findByIdAndUpdate(report.targetId, { isHidden: true });
      } else if (report.targetType === 'comment') {
        await Comment.findByIdAndUpdate(report.targetId, { isHidden: true });
      }
    }

    res.json({ success: true, message: '신고가 처리되었습니다.' });
  } catch (error) {
    console.error('신고 처리 오류:', error);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

// 관리자용 신입직원 추가 폼
router.get('/employees/new', adminOnly, async (req, res) => {
  const users = await User.find({ role: 'user' }).sort({ username: 1 });
  const employees = await Employee.find().sort({ name: 1 });
  res.render('addEmployee', { users, employees, session: req.session });
});

// 관리자용 직원 전체 정보
router.get('/employees', adminOnly, async (req, res) => {
  const { search, department, position, sort, order, page = 1, limit = 10 } = req.query;
  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
      { position: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (department) query.department = department;
  if (position) query.position = position;
  
  let sortOption = {};
  if (sort) {
    sortOption[sort] = order === 'desc' ? -1 : 1;
  }
  
  const total = await Employee.countDocuments(query);
  const employees = await Employee.find(query)
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('+userId');
  
  // 부서 목록 가져오기
  const departments = await Employee.distinct('department');
  
  // 직급 목록 가져오기
  const orderedPositions = ['인턴', '사원', '주임', '대리', '과장', '차장', '팀장'];
  const dbPositions = await Employee.distinct('position');
  const positions = [...new Set([...orderedPositions, ...dbPositions])];
  
  const totalPages = Math.ceil(total / limit);
  
  res.render('employees', { 
    employees, 
    departments,
    positions,
    totalPages,
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    session: req.session,
    message: req.session.message,
    query: req.query || {}
  });
  delete req.session.message;
});

// 관리자용 신입직원 추가 처리
router.post('/employees/new', adminOnly, employeeUpload.single('profileImage'), async (req, res) => {
  const { name, email, userId, orgType, department, position, hireDate } = req.body;
  
  try {
    // 이메일 중복 검사
    const existingEmployee = await checkEmailDuplicate(email);
    if (existingEmployee) {
      return res.status(400).send(`
        <script>
          alert('이미 존재하는 이메일입니다: ${email}');
          history.back();
        </script>
      `);
    }
    
    // userId 중복 검사
    const existingUserEmployee = await checkUserIdDuplicate(userId);
    if (existingUserEmployee) {
      return res.status(400).send(`
        <script>
          alert('이미 등록된 사용자입니다. 다른 사용자를 선택해주세요.');
          history.back();
        </script>
      `);
    }
    
    // 주민등록번호 중복 검사
    const existingResidentNumber = await checkResidentNumberDuplicate(req.body.residentNumber);
    if (existingResidentNumber) {
      return res.status(400).send(`
        <script>
          alert('이미 등록된 주민등록번호입니다: ${req.body.residentNumber}');
          history.back();
        </script>
      `);
    }
    
    const empNo = await generateEmpNo(orgType, department);
    
    const employee = new Employee({
      name,
      email,
      userId,
      empNo,
      orgType,
      department,
      position,
      hireDate,
      status: '재직',
      cap: req.body.cap,
      uniformSummerTop: req.body.uniformSummerTop,
      uniformSummerBottom: req.body.uniformSummerBottom,
      uniformWinterTop: req.body.uniformWinterTop,
      uniformWinterBottom: req.body.uniformWinterBottom,
      uniformWinterPants: req.body.uniformWinterPants,
      springAutumnUniform: req.body.springAutumnUniform,
      uniformWinterCoat: req.body.uniformWinterCoat,
      raincoat: req.body.raincoat,
      safetyShoes: req.body.safetyShoes,
      rainBoots: req.body.rainBoots,
      winterJacket: req.body.winterJacket,
      doubleJacket: req.body.doubleJacket,
      residentNumber: req.body.residentNumber || null,
      profileImage: req.file ? req.file.filename : null
    });

    await employee.save();

    // 로그 기록
    const log = new Log({
      userId: req.session.userId,
      action: '직원 추가',
      details: `직원 ${name} 추가`,
      ip: req.ip
    });
    await log.save();

    req.session.message = '직원이 성공적으로 추가되었습니다.';
    res.redirect('/admin/employees');
  } catch (error) {
    console.error('직원 추가 오류:', error);
    res.status(500).send('직원 추가 중 오류가 발생했습니다.');
  }
});

module.exports = router; 