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
const ExcelJS = require('exceljs');
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
    const employee = await Employee.findById(req.params.id).select({
      userId: 1,
      orgType: 1,
      department: 1,
      team: 1,
      position: 1,
      name: 1,
      age: 1,
      birth: 1,
      residentNumber: 1,
      gender: 1,
      nationality: 1,
      education: 1,
      phone: 1,
      mobile: 1,
      email: 1,
      address: 1,
      emergencyContact: 1,
      empNo: 1,
      status: 1,
      employmentType: 1,
      hireDate: 1,
      salaryBank: 1,
      salaryAccount: 1,
      workLocation: 1,
      rewardPunishment: 1,
      uniformSummerTop: 1,
      uniformSummerBottom: 1,
      uniformWinterTop: 1,
      uniformWinterBottom: 1,
      uniformWinterPants: 1,
      uniformWinterCoat: 1,
      raincoat: 1,
      cap: 1,
      safetyShoes: 1,
      rainBoots: 1,
      winterJacket: 1,
      doubleJacket: 1,
      springAutumnUniform: 1,
      profileImage: 1,
      bloodType: 1,
      height: 1,
      weight: 1,
      militaryBranch: 1,
      militaryRank: 1,
      militaryNumber: 1,
      militaryServicePeriod: 1,
      militaryExemptionReason: 1,
      specialNotes: 1,
      career: 1
    });
    
    if (!employee) {
      return res.status(404).send('직원을 찾을 수 없습니다.');
    }
    
    // 디버깅: 상세보기 데이터 확인
    console.log('관리자 직원 상세보기 데이터:', {
      id: employee._id,
      name: employee.name,
      birth: employee.birth,
      gender: employee.gender,
      nationality: employee.nationality,
      education: employee.education,
      phone: employee.phone,
      address: employee.address,
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
    // 전체 통계 (안전하게 처리)
    const totalEmployees = await Employee.countDocuments().catch(() => 0);
    const totalUsers = await User.countDocuments().catch(() => 0);
    
    // 게시판 관련 통계 (컬렉션이 없을 수 있음)
    let totalPosts = 0, totalComments = 0, totalReports = 0, pendingReports = 0;
    let recentPosts = 0, recentComments = 0, recentReports = 0;
    let boardStats = [], popularPosts = [], reportStats = [], reportReasonStats = [];
    
    try {
      totalPosts = await Post.countDocuments();
      totalComments = await Comment.countDocuments();
      totalReports = await Report.countDocuments();
      pendingReports = await Report.countDocuments({ status: 'pending' });
      
      // 최근 7일 통계
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      recentPosts = await Post.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
      recentComments = await Comment.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
      recentReports = await Report.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
      
      // 게시판별 통계
      boardStats = await Post.aggregate([
        {
          $group: {
            _id: '$boardId',
            count: { $sum: 1 },
            totalViews: { $sum: { $ifNull: ['$views', 0] } },
            totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
            totalDislikes: { $sum: { $size: { $ifNull: ['$dislikes', []] } } }
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
          $unwind: { path: '$board', preserveNullAndEmptyArrays: true }
        },
        {
          $project: {
            boardName: { $ifNull: ['$board.name', '알 수 없음'] },
            boardType: { $ifNull: ['$board.type', 'unknown'] },
            postCount: '$count',
            totalViews: '$totalViews',
            totalLikes: '$totalLikes',
            totalDislikes: '$totalDislikes'
          }
        }
      ]);
      
      // 인기 게시글 (조회수 기준)
      popularPosts = await Post.find({ isHidden: { $ne: true } })
        .populate('author', 'username name')
        .populate('boardId', 'name')
        .sort({ views: -1 })
        .limit(10);
      
      // 신고 통계
      reportStats = await Report.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      reportReasonStats = await Report.aggregate([
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 }
          }
        }
      ]);
    } catch (boardError) {
      console.log('게시판 데이터 없음:', boardError.message);
      // 게시판 데이터가 없어도 계속 진행
    }
    
    // 최근 7일 직원 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentEmployees = await Employee.countDocuments({ createdAt: { $gte: sevenDaysAgo } }).catch(() => 0);
    
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
    ]).catch(() => []);

    res.render('boards/admin/dashboard', {
      stats: {
        total: {
          employees: totalEmployees,
          users: totalUsers,
          posts: totalPosts,
          comments: totalComments,
          reports: totalReports,
          pendingReports: pendingReports
        },
        recent: {
          employees: recentEmployees,
          posts: recentPosts,
          comments: recentComments,
          reports: recentReports
        },
        boardStats: boardStats,
        popularPosts: popularPosts,
        reportStats: reportStats,
        reportReasonStats: reportReasonStats
      },
      departmentStats,
      session: req.session
    });
  } catch (error) {
    console.error('관리자 대시보드 오류:', error);
    res.status(500).send('대시보드를 불러오는 중 오류가 발생했습니다.');
  }
});

// 신고 전용 통계 대시보드
router.get('/reports/dashboard', adminOnly, async (req, res) => {
  try {
    // Report 모델이 존재하는지 확인
    if (!Report) {
      console.log('Report 모델을 찾을 수 없음');
      return res.render('boards/admin/reports-dashboard', {
        stats: {
          total: 0,
          pending: 0,
          reviewed: 0,
          resolved: 0,
          dismissed: 0,
          recent: 0
        },
        reportReasonStats: [],
        reportStatusStats: [],
        recentReportList: [],
        session: req.session
      });
    }

    // 신고 통계만 집중 (안전하게 처리)
    let totalReports = 0, pendingReports = 0, reviewedReports = 0, resolvedReports = 0, dismissedReports = 0;
    let recentReports = 0;
    let reportReasonStats = [], reportStatusStats = [], recentReportList = [];

    try {
      // 기본 통계
      totalReports = await Report.countDocuments();
      pendingReports = await Report.countDocuments({ status: 'pending' });
      reviewedReports = await Report.countDocuments({ status: 'reviewed' });
      resolvedReports = await Report.countDocuments({ status: 'resolved' });
      dismissedReports = await Report.countDocuments({ status: 'dismissed' });

      // 최근 7일 신고 통계
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      recentReports = await Report.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

      // 신고 사유별 통계
      reportReasonStats = await Report.aggregate([
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 }
          }
        }
      ]);

      // 신고 상태별 통계
      reportStatusStats = await Report.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // 최근 신고 목록 (상위 5개)
      recentReportList = await Report.find()
        .populate('reporter', 'username name')
        .sort({ createdAt: -1 })
        .limit(5);

    } catch (reportError) {
      console.log('신고 데이터 처리 중 오류:', reportError.message);
      // 오류가 발생해도 기본값으로 계속 진행
    }

    res.render('boards/admin/reports-dashboard', {
      stats: {
        total: totalReports,
        pending: pendingReports,
        reviewed: reviewedReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
        recent: recentReports
      },
      reportReasonStats,
      reportStatusStats,
      recentReportList,
      session: req.session
    });
  } catch (error) {
    console.error('신고 통계 대시보드 오류:', error);
    res.status(500).send('신고 통계를 불러오는 중 오류가 발생했습니다.');
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
    message: req.session.message && !req.session.message.includes('유니폼') ? req.session.message : undefined,
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

// 인사 현황 보고서 엑셀 다운로드
router.get('/hr-report/excel', adminOnly, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('인사 현황 보고서');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '부서', key: 'department', width: 20 },
      { header: '직급', key: 'position', width: 15 },
      { header: '인원수', key: 'count', width: 12 },
      { header: '비율(%)', key: 'percentage', width: 12 },
      { header: '평균 연령', key: 'avgAge', width: 12 },
      { header: '평균 근속년수', key: 'avgTenure', width: 15 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 부서별 통계 데이터 추가 (샘플)
    const departments = ['보안1팀', '보안2팀', '보안3팀'];
    const positions = ['보안원', '보안팀장', '보안과장'];
    
    departments.forEach(dept => {
      positions.forEach(pos => {
        worksheet.addRow({
          department: dept,
          position: pos,
          count: pos === '보안원' ? 35 : pos === '보안팀장' ? 3 : 2,
          percentage: pos === '보안원' ? 87.5 : pos === '보안팀장' ? 7.5 : 5,
          avgAge: 35,
          avgTenure: 5.2
        });
      });
    });

    // 파일명 설정
    const fileName = `인사현황보고서_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('인사 현황 보고서 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '보고서 다운로드 중 오류가 발생했습니다.' });
  }
});

// 근무 통계 보고서 엑셀 다운로드
router.get('/work-stats/excel', adminOnly, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('근무 통계 보고서');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '구분', key: 'category', width: 20 },
      { header: '보안1팀', key: 'team1', width: 15 },
      { header: '보안2팀', key: 'team2', width: 15 },
      { header: '보안3팀', key: 'team3', width: 15 },
      { header: '합계', key: 'total', width: 15 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 통계 데이터 추가 (샘플)
    const categories = [
      { category: '주간 근무', team1: '7일', team2: '7일', team3: '7일', total: '21일' },
      { category: '심야 근무', team1: '7일', team2: '7일', team3: '7일', total: '21일' },
      { category: '초야 근무', team1: '7일', team2: '7일', team3: '7일', total: '21일' },
      { category: '특근 근무', team1: '2일', team2: '2일', team3: '2일', total: '6일' },
      { category: '휴무', team1: '2일', team2: '2일', team3: '2일', total: '6일' }
    ];

    categories.forEach(cat => {
      worksheet.addRow(cat);
    });

    // 파일명 설정
    const fileName = `근무통계보고서_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('근무 통계 보고서 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '보고서 다운로드 중 오류가 발생했습니다.' });
  }
});

// 월별 요약 보고서 엑셀 다운로드
router.get('/monthly-report/excel', adminOnly, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ success: false, message: '월 정보가 필요합니다.' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('월별 요약 보고서');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '항목', key: 'item', width: 25 },
      { header: '내용', key: 'content', width: 30 },
      { header: '비고', key: 'note', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 월별 요약 데이터 추가 (샘플)
    const summaryData = [
      { item: '총 직원 수', content: '120명', note: '전체 재직자' },
      { item: '신규 입사', content: '3명', note: '신규 채용' },
      { item: '퇴사', content: '1명', note: '자연 퇴사' },
      { item: '총 근무일수', content: '22일', note: '월 근무일' },
      { item: '평균 출근률', content: '98.5%', note: '전체 평균' },
      { item: '총 특근 시간', content: '240시간', note: '월간 합계' },
      { item: '총 야간 근무', content: '180시간', note: '월간 합계' }
    ];

    summaryData.forEach(data => {
      worksheet.addRow(data);
    });

    // 파일명 설정
    const fileName = `월별요약보고서_${month}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('월별 요약 보고서 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '보고서 다운로드 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 