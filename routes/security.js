const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const upload = require('../middleware/upload');
const DutyOrder = require('../models/DutyOrder');
const Handover = require('../models/Handover');
const Schedule = require('../models/Schedule');
const Employee = require('../models/Employee');
const NotificationService = require('../services/notificationService');
const fs = require('fs');
const path = require('path');

// ===== 근무명령서 라우트 =====

// 근무명령서 목록 페이지
router.get('/duty-orders', isLoggedIn, async (req, res) => {
  try {
    const { department, priority, status, page = 1, limit = 10 } = req.query;
    
    // 필터 조건 구성
    const filter = {};
    if (department && department !== '전체') filter.department = department;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;
    
    // 페이지네이션
    const skip = (page - 1) * limit;
    
    // 데이터 조회
    const dutyOrders = await DutyOrder.find(filter)
      .populate('issuedBy', 'name username')
      .populate('assignedTo', 'name department')
      .sort({ priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await DutyOrder.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    // 추가 통계 데이터
    const allDutyOrders = await DutyOrder.find();
    const pendingCount = allDutyOrders.filter(d => d.status === 'pending').length;
    const activeCount = allDutyOrders.filter(d => d.status === 'active').length;
    const completedCount = allDutyOrders.filter(d => d.status === 'completed').length;
    const highPriorityCount = allDutyOrders.filter(d => d.priority === 'high').length;
    
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
    
    res.render('security/duty-orders', { 
      session: req.session,
      title: '근무명령서',
      dutyOrders,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: { department, priority, status },
      // 통계 데이터 추가
      pendingCount,
      activeCount,
      completedCount,
      highPriorityCount
    });
  } catch (error) {
    console.error('근무명령서 페이지 오류:', error);
    res.status(500).send(`
      <script>
        alert('근무명령서 페이지 로드 중 오류가 발생했습니다.\\n\\n오류: ${error.message}');
        history.back();
      </script>
    `);
  }
});

// 새 근무명령서 등록
router.post('/duty-orders', isLoggedIn, upload.array('attachments', 5), async (req, res) => {
  try {
    // 디버깅: 세션 정보 확인
    console.log('=== 근무명령서 등록 디버깅 ===');
    console.log('req.session:', req.session);
    console.log('req.session.userId:', req.session.userId);
    console.log('req.body:', req.body);
    
    const { title, content, priority, department, deadline, assignedTo } = req.body;
    
    // 파일 정보 처리
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      uploadedAt: new Date()
    })) : [];
    
    const dutyOrder = new DutyOrder({
      title,
      content,
      priority,
      department,
      deadline: deadline ? new Date(deadline) : null,
      issuedBy: req.session.userId,
      assignedTo: assignedTo ? assignedTo.split(',').map(id => id.trim()) : [],
      attachments
    });
    
    await dutyOrder.save();
    
    // 알림 생성
    try {
      await NotificationService.createDutyOrderNotification(dutyOrder);
    } catch (error) {
      console.error('알림 생성 실패:', error);
    }
    
    req.session.message = '근무명령서가 성공적으로 등록되었습니다.';
    res.redirect('/security/duty-orders');
  } catch (error) {
    console.error('근무명령서 등록 오류:', error);
    // 업로드된 파일이 있다면 삭제
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    req.session.error = '근무명령서 등록에 실패했습니다.';
    res.redirect('/security/duty-orders');
  }
});

// 근무명령서 상세보기
router.get('/duty-orders/:id', isLoggedIn, async (req, res) => {
  try {
    const dutyOrder = await DutyOrder.findById(req.params.id)
      .populate('issuedBy', 'name username')
      .populate('assignedTo', 'name department position')
      .populate('comments.user', 'name username');
    
    if (!dutyOrder) {
      return res.status(404).send('근무명령서를 찾을 수 없습니다.');
    }
    
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
    
    res.render('security/duty-order-detail', {
      session: req.session,
      dutyOrder
    });
  } catch (error) {
    console.error('근무명령서 상세보기 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// ===== 인계사항 라우트 =====

// 인계사항 목록 페이지
router.get('/handover', isLoggedIn, async (req, res) => {
  try {
    const { department, type, status, page = 1, limit = 10 } = req.query;
    
    // 필터 조건 구성
    const filter = {};
    if (department && department !== '전체') filter.department = department;
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    // 페이지네이션
    const skip = (page - 1) * limit;
    
    // 데이터 조회
    const handovers = await Handover.find(filter)
      .populate('handoverFrom', 'name department')
      .populate('handoverTo', 'name department')
      .sort({ handoverDate: -1, priority: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Handover.countDocuments(filter);
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
    
    res.render('security/handover', { 
      session: req.session,
      title: '인계사항',
      handovers,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: { department, type, status }
    });
  } catch (error) {
    console.error('인계사항 페이지 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 인계사항 등록
router.post('/handover', isLoggedIn, upload.array('attachments', 5), async (req, res) => {
  try {
    const { title, content, type, department, handoverTo, followUp } = req.body;
    
    // 현재 사용자의 직원 정보 조회
    const currentEmployee = await Employee.findOne({ userId: req.session.userId });
    if (!currentEmployee) {
      throw new Error('직원 정보를 찾을 수 없습니다.');
    }
    
    // 파일 정보 처리
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      uploadedAt: new Date()
    })) : [];
    
    const handover = new Handover({
      title,
      content,
      type,
      department,
      handoverFrom: currentEmployee._id,
      handoverTo: handoverTo || null,
      handoverDate: new Date(),
      followUpActions: followUp ? [{ action: followUp, status: 'pending' }] : [],
      attachments
    });
    
    await handover.save();
    
    // 알림 생성
    try {
      await NotificationService.createHandoverNotification(handover);
    } catch (error) {
      console.error('알림 생성 실패:', error);
    }
    
    req.session.message = '인계사항이 성공적으로 등록되었습니다.';
    res.redirect('/security/handover');
  } catch (error) {
    console.error('인계사항 등록 오류:', error);
    // 업로드된 파일이 있다면 삭제
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    req.session.error = '인계사항 등록에 실패했습니다.';
    res.redirect('/security/handover');
  }
});

// ===== 일정 라우트 =====

// 일정 목록 페이지
router.get('/schedule', isLoggedIn, async (req, res) => {
  try {
    const { department, type, status, page = 1, limit = 10 } = req.query;
    
    // 필터 조건 구성
    const filter = {};
    if (department && department !== '전체') filter.department = department;
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    // 페이지네이션
    const skip = (page - 1) * limit;
    
    // 데이터 조회
    const schedules = await Schedule.find(filter)
      .populate('createdBy', 'name username')
      .populate('attendees', 'name department')
      .sort({ startDate: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Schedule.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    // 오늘의 일정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySchedules = await Schedule.find({
      startDate: { $gte: today, $lt: tomorrow }
    })
    .populate('createdBy', 'name username')
    .populate('attendees', 'name department')
    .sort({ startTime: 1 });
    
    // 이번 주 일정 (월요일부터 일요일까지)
    const weekStart = new Date(today);
    const dayOfWeek = today.getDay();
    weekStart.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekSchedules = await Schedule.find({
      startDate: { $gte: weekStart, $lte: weekEnd }
    })
    .populate('createdBy', 'name username')
    .populate('attendees', 'name department')
    .sort({ startDate: 1, startTime: 1 });
    
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
    
    res.render('security/schedule', { 
      session: req.session,
      title: '일정',
      schedules,
      todaySchedules,
      weekSchedules,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: { department, type, status }
    });
  } catch (error) {
    console.error('일정 페이지 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 일정 등록
router.post('/schedule', isLoggedIn, upload.array('attachments', 5), async (req, res) => {
  try {
    // 디버깅: 세션 정보 확인
    console.log('=== 일정 등록 디버깅 ===');
    console.log('req.session:', req.session);
    console.log('req.session.userId:', req.session.userId);
    console.log('req.body:', req.body);
    
    const { 
      title, content, type, department, startDate, startTime, 
      endDate, endTime, location, attendees 
    } = req.body;
    
    // 파일 정보 처리
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      uploadedAt: new Date()
    })) : [];
    
    const schedule = new Schedule({
      title,
      content,
      type,
      department,
      startDate: new Date(startDate),
      startTime,
      endDate: endDate ? new Date(endDate) : null,
      endTime: endTime || null,
      location,
      attendees: attendees ? attendees.split(',').map(id => id.trim()) : [],
      createdBy: req.session.userId,
      attachments
    });
    
    await schedule.save();
    
    // 알림 생성
    try {
      await NotificationService.createScheduleNotification(schedule);
    } catch (error) {
      console.error('알림 생성 실패:', error);
    }
    
    req.session.message = '일정이 성공적으로 등록되었습니다.';
    res.redirect('/security/schedule');
  } catch (error) {
    console.error('일정 등록 오류:', error);
    req.session.error = '일정 등록에 실패했습니다.';
    res.redirect('/security/schedule');
  }
});

// ===== 공통 API 엔드포인트 =====

// 부서별 직원 목록 조회 (AJAX용)
router.get('/api/employees/:department', isLoggedIn, async (req, res) => {
  try {
    const { department } = req.params;
    const employees = await Employee.find({ department })
      .select('name position')
      .sort({ name: 1 });
    
    res.json(employees);
  } catch (error) {
    console.error('직원 목록 조회 오류:', error);
    res.status(500).json({ error: '직원 목록을 가져올 수 없습니다.' });
  }
});

// 진행률 업데이트 (AJAX용)
router.put('/api/duty-orders/:id/progress', isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;
    
    const dutyOrder = await DutyOrder.findByIdAndUpdate(
      id, 
      { progress: parseInt(progress) },
      { new: true }
    );
    
    if (!dutyOrder) {
      return res.status(404).json({ error: '근무명령서를 찾을 수 없습니다.' });
    }
    
    res.json({ success: true, progress: dutyOrder.progress });
  } catch (error) {
    console.error('진행률 업데이트 오류:', error);
    res.status(500).json({ error: '진행률 업데이트에 실패했습니다.' });
  }
});

// 댓글 작성 (AJAX용)
router.post('/api/duty-orders/:id/comments', isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    }
    
    const dutyOrder = await DutyOrder.findById(id);
    if (!dutyOrder) {
      return res.status(404).json({ error: '근무명령서를 찾을 수 없습니다.' });
    }
    
    const comment = {
      user: req.session.userId,
      content: content.trim(),
      createdAt: new Date()
    };
    
    dutyOrder.comments.push(comment);
    await dutyOrder.save();
    
    res.json({ success: true, message: '댓글이 등록되었습니다.' });
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    res.status(500).json({ error: '댓글 작성에 실패했습니다.' });
  }
});

// 댓글 삭제 (AJAX용)
router.delete('/api/duty-orders/:id/comments/:commentId', isLoggedIn, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    
    const dutyOrder = await DutyOrder.findById(id);
    if (!dutyOrder) {
      return res.status(404).json({ error: '근무명령서를 찾을 수 없습니다.' });
    }
    
    const comment = dutyOrder.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }
    
    // 댓글 작성자 또는 관리자만 삭제 가능
    if (comment.user.toString() !== req.session.userId && req.session.role !== 'admin') {
      return res.status(403).json({ error: '댓글을 삭제할 권한이 없습니다.' });
    }
    
    comment.remove();
    await dutyOrder.save();
    
    res.json({ success: true, message: '댓글이 삭제되었습니다.' });
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    res.status(500).json({ error: '댓글 삭제에 실패했습니다.' });
  }
});

// ===== 파일 다운로드 라우트 =====

// 파일 다운로드
router.get('/download/:filename', isLoggedIn, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/security', filename);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).send('파일을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).send('파일 다운로드에 실패했습니다.');
  }
});

// 파일 삭제 (관리자만)
router.delete('/files/:filename', isLoggedIn, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/security', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: '파일이 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({ success: false, message: '파일 삭제에 실패했습니다.' });
  }
});

// ===== 알림 API 라우트 =====

// 사용자의 읽지 않은 알림 조회
router.get('/api/notifications/unread', isLoggedIn, async (req, res) => {
  try {
    const notifications = await NotificationService.getUnreadNotifications(req.session.userId);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('알림 조회 오류:', error);
    res.status(500).json({ success: false, message: '알림 조회에 실패했습니다.' });
  }
});

// 사용자의 모든 알림 조회
router.get('/api/notifications', isLoggedIn, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await NotificationService.getAllNotifications(req.session.userId, parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('알림 조회 오류:', error);
    res.status(500).json({ success: false, message: '알림 조회에 실패했습니다.' });
  }
});

// 알림 읽음 처리
router.put('/api/notifications/:id/read', isLoggedIn, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.session.userId);
    if (notification) {
      res.json({ success: true, notification });
    } else {
      res.status(404).json({ success: false, message: '알림을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('알림 읽음 처리 오류:', error);
    res.status(500).json({ success: false, message: '알림 읽음 처리에 실패했습니다.' });
  }
});

// 모든 알림 읽음 처리
router.put('/api/notifications/read-all', isLoggedIn, async (req, res) => {
  try {
    await NotificationService.markAllAsRead(req.session.userId);
    res.json({ success: true, message: '모든 알림이 읽음 처리되었습니다.' });
  } catch (error) {
    console.error('모든 알림 읽음 처리 오류:', error);
    res.status(500).json({ success: false, message: '알림 읽음 처리에 실패했습니다.' });
  }
});

// 알림 삭제
router.delete('/api/notifications/:id', isLoggedIn, async (req, res) => {
  try {
    const notification = await NotificationService.deleteNotification(req.params.id, req.session.userId);
    if (notification) {
      res.json({ success: true, message: '알림이 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, message: '알림을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('알림 삭제 오류:', error);
    res.status(500).json({ success: false, message: '알림 삭제에 실패했습니다.' });
  }
});

module.exports = router;
