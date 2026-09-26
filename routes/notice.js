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
const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const User = require('../models/User');

// 날짜 입력은 한국 시간의 하루 전체로 해석합니다.
function parseKoreanDay(value, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('게시 날짜 형식이 올바르지 않습니다.');
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) !== value) {
    throw new Error('유효한 게시 날짜를 입력해 주세요.');
  }
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function publicationFrom(body) {
  const publishStart = parseKoreanDay(body.publishStart);
  const publishEnd = parseKoreanDay(body.publishEnd, true);
  if (Boolean(publishStart) !== Boolean(publishEnd)) throw new Error('게시 시작일과 종료일을 모두 입력하거나 모두 비워 주세요.');
  if (publishStart && publishEnd && publishStart >= publishEnd) throw new Error('게시 종료일은 시작일 이후여야 합니다.');
  return { showOnLogin: Boolean(publishStart && publishEnd), publishStart, publishEnd };
}

// 공지사항 목록(최신순)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
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
      canManageNotices: res.locals.userRole === 'admin',
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
// 목록에서 로그인 전 공지 노출과 게시기간을 바로 설정
router.post('/:id/publication', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('공지사항을 찾을 수 없습니다.');
  try {
    const publication = publicationFrom(req.body);
    const notice = await Notice.findById(req.params.id).select('_id');
    if (!notice) return res.status(404).send('공지사항을 찾을 수 없습니다.');
    await Notice.findByIdAndUpdate(notice._id, { ...publication, updatedAt: new Date() }, { runValidators: true });
    res.redirect('/notice/manage');
  } catch (error) {
    const notices = await Notice.find().sort({ createdAt: -1 }).populate('author', 'username email');
    res.status(400).render('noticeManage', { notices, session: req.session, error: error.message });
  }
});
router.post('/:id/publication/stop', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('공지사항을 찾을 수 없습니다.');
  const notice = await Notice.findById(req.params.id);
  if (!notice) return res.status(404).send('공지사항을 찾을 수 없습니다.');
  const now = new Date();
  notice.publishStart = null;
  notice.publishEnd = null;
  notice.showOnLogin = false;
  notice.updatedAt = now;
  await notice.save();
  res.redirect('/notice/manage');
});
// 시스템 알림 작성 처리
router.post('/new', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  try {
    await Notice.create({
      title: req.body.title,
      content: req.body.content,
      author: user._id
    });
    res.redirect('/notice/manage');
  } catch (error) {
    res.status(400).render('noticeForm', { notice: { ...req.body, showOnLogin: req.body.showOnLogin === 'on' }, session: req.session, error: error.message, isNew: true });
  }
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
  try {
    await Notice.findByIdAndUpdate(req.params.id, {
      title: req.body.title,
      content: req.body.content,
      updatedAt: new Date()
    }, { runValidators: true });
    res.redirect('/notice/manage');
  } catch (error) {
    res.status(400).render('noticeForm', { notice: { ...req.body, _id: req.params.id, showOnLogin: req.body.showOnLogin === 'on' }, session: req.session, error: error.message });
  }
});
// 시스템 알림 삭제
router.post('/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  await Notice.findByIdAndDelete(req.params.id);
  res.redirect('/notice');
});

// 시스템 알림 상세 조회
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).send('시스템 알림을 찾을 수 없습니다.');
  }

  try {
    const notice = await Notice.findById(req.params.id).populate('author', 'username');
    if (!notice) return res.status(404).send('시스템 알림을 찾을 수 없습니다.');
    const viewer = req.session?.userId ? await User.findById(req.session.userId).select('role') : null;
    const canManageNotices = viewer?.role === 'admin';
    res.render('noticeDetail', { notice, session: req.session, canManageNotices });
  } catch (error) {
    console.error('시스템 알림 상세 조회 오류:', error);
    res.status(500).send('시스템 알림을 불러오는 중 오류가 발생했습니다.');
  }
});

module.exports = router;
