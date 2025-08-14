/**
 * 파일명: notice.js
 * 목적: 시스템 알림(공지사항) 관리 라우트 처리
 * 기능:
 * - 시스템 알림 목록 조회
 * - 시스템 알림 작성/수정/삭제
 * - 관리자 전용 알림 관리
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const User = require('../models/User');

// 공지사항 목록(최신순)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const notices = await Notice.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username email');
    
    const total = await Notice.countDocuments();
    const totalPages = Math.ceil(total / limit);
    
    // 헤더에 필요한 변수들 설정
    if (req.session && req.session.userId) {
      const User = require('../models/User');
      const Employee = require('../models/Employee');
      
      const user = await User.findById(req.session.userId);
      if (user) {
        if (user.role === 'admin') {
          res.locals.position = '관리자';
          res.locals.name = user.username;
          res.locals.department = '시스템 관리';
          res.locals.employeePosition = '관리자';
          res.locals.userRole = 'admin';
        } else {
          const employee = await Employee.findOne({ userId: req.session.userId });
          if (employee) {
            res.locals.position = `${employee.department || '부서미정'} / ${employee.position || '직급미정'}`;
            res.locals.name = employee.name;
            res.locals.department = employee.department || '부서미정';
            res.locals.employeePosition = employee.position || '직급미정';
            res.locals.userRole = 'user';
          } else {
            res.locals.position = '일반 사용자';
            res.locals.name = user.username;
            res.locals.department = '부서미정';
            res.locals.employeePosition = '직급미정';
            res.locals.userRole = 'user';
          }
        }
      }
    }
    
    res.render('notice', { 
      notices, 
      currentPage: page,
      totalPages,
      session: req.session 
    });
  } catch (error) {
    console.error('공지사항 목록 로드 오류:', error);
    res.status(500).send(`
      <script>
        alert('공지사항 목록 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 공지사항 관리(관리자)
router.get('/manage', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  const notices = await Notice.find().sort({ createdAt: -1 }).populate('author', 'username email');
  res.render('noticeManage', { notices, session: req.session });
});

// 시스템 알림 작성 폼(관리자)
router.get('/new', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  res.render('noticeForm', { notice: null, session: req.session });
});
// 시스템 알림 작성 처리
router.post('/new', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  await Notice.create({
    title: req.body.title,
    content: req.body.content,
    author: user._id
  });
  res.redirect('/notice/manage');
});
// 시스템 알림 수정 폼
router.get('/:id/edit', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  const notice = await Notice.findById(req.params.id);
  if (!notice) return res.status(404).send('공지사항을 찾을 수 없습니다.');
  res.render('noticeForm', { notice, session: req.session });
});
// 시스템 알림 수정 처리
router.post('/:id/edit', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  await Notice.findByIdAndUpdate(req.params.id, {
    title: req.body.title,
    content: req.body.content
  });
  res.redirect('/notice/manage');
});
// 시스템 알림 삭제
router.post('/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  await Notice.findByIdAndDelete(req.params.id);
  res.redirect('/notice/manage');
});

module.exports = router; 