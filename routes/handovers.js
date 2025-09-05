/**
 * 파일명: handovers.js
 * 목적: 일일업무 인계장 관리 라우트
 * 기능:
 * - 인계장 목록 조회
 * - 인계장 작성/수정/삭제
 * - 인계장 상세 조회
 * - 인계사항 관리
 * - 보고 완료 처리
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const Handover = require('../models/Handover');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Log = require('../models/Log');

// 로그인 체크 미들웨어
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
}

// 관리자 권한 체크
function adminOnly(req, res, next) {
  if (req.session.userRole === 'admin') {
    next();
  } else {
    res.status(403).send('관리자만 접근 가능합니다.');
  }
}

// 인계장 목록 조회
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // 검색 조건
    const filter = {};
    if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.date) {
      const date = new Date(req.query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.handoverDate = {
        $gte: date,
        $lt: nextDay
      };
    }
    if (req.query.team) {
      filter['handoverItems.assignedTeam'] = req.query.team;
    }
    
    const handovers = await Handover.find(filter)
      .populate('handoverFrom', 'name empNo')
      .populate('handoverTo', 'name empNo')
      .sort({ handoverDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Handover.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    
    res.render('handoverList', {
      handovers,
      currentPage: page,
      totalPages,
      total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('인계장 목록 조회 오류:', error);
    res.status(500).render('error', { 
      message: '인계장 목록을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 인계장 작성 폼
router.get('/new', isLoggedIn, adminOnly, async (req, res) => {
  try {
    res.render('handoverForm', {
      handover: null,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('인계장 작성 폼 오류:', error);
    res.status(500).render('error', { 
      message: '인계장 작성 폼을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 인계장 작성 처리
router.post('/', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const handoverData = {
      ...req.body,
      handoverDate: new Date(req.body.handoverDate),
      handoverFrom: req.session.userId,
      status: 'pending'
    };
    
    // 인계사항 처리
    if (req.body.handoverItems) {
      handoverData.handoverItems = req.body.handoverItems.map(item => ({
        taskType: item.taskType,
        assignedTeam: item.assignedTeam,
        timeCategory: item.timeCategory,
        reportCompleted: item.reportCompleted === 'on',
        status: '진행중',
        taskDetails: {
          dateTime: {
            date: item.taskDetails?.dateTime?.date || '',
            startTime: item.taskDetails?.dateTime?.startTime || '',
            endTime: item.taskDetails?.dateTime?.endTime || ''
          },
          personnel: {
            company: item.taskDetails?.personnel?.company || '',
            name: item.taskDetails?.personnel?.name || '',
            additionalCount: parseInt(item.taskDetails?.personnel?.additionalCount) || 0,
            phone: item.taskDetails?.personnel?.phone || ''
          },
          location: item.taskDetails?.location || '',
          content: item.taskDetails?.content || '',
          additionalInfo: item.taskDetails?.additionalInfo || ''
        }
      }));
    }
    
    const handover = new Handover(handoverData);
    await handover.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'CREATE_HANDOVER',
      details: `인계장 생성: ${handover.formattedHandoverDate}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.flash('success', '인계장이 성공적으로 생성되었습니다.');
    res.redirect(`/handovers/${handover._id}`);
  } catch (error) {
    console.error('인계장 생성 오류:', error);
    req.flash('error', '인계장 생성 중 오류가 발생했습니다.');
    res.render('handoverForm', {
      handover: null,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session,
      errors: [error.message]
    });
  }
});

// 인계장 상세 조회
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id)
      .populate('handoverFrom', 'name empNo')
      .populate('handoverTo', 'name empNo');
    
    if (!handover) {
      return res.status(404).render('error', { 
        message: '인계장을 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    res.render('handover', {
      handover,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('인계장 상세 조회 오류:', error);
    res.status(500).render('error', { 
      message: '인계장을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 인계장 수정 폼
router.get('/:id/edit', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id);
    
    if (!handover) {
      return res.status(404).render('error', { 
        message: '인계장을 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    res.render('handoverForm', {
      handover,
      user: req.session.user,
      userRole: req.session.userRole,
      session: req.session
    });
  } catch (error) {
    console.error('인계장 수정 폼 오류:', error);
    res.status(500).render('error', { 
      message: '인계장 수정 폼을 불러오는 중 오류가 발생했습니다.',
      error: error
    });
  }
});

// 인계장 수정 처리
router.put('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id);
    
    if (!handover) {
      return res.status(404).render('error', { 
        message: '인계장을 찾을 수 없습니다.',
        error: { status: 404 }
      });
    }
    
    const updateData = {
      ...req.body,
      handoverDate: new Date(req.body.handoverDate),
      handoverTo: req.session.userId
    };
    
    // 인계사항 처리
    if (req.body.handoverItems) {
      updateData.handoverItems = req.body.handoverItems.map(item => ({
        taskType: item.taskType,
        assignedTeam: item.assignedTeam,
        timeCategory: item.timeCategory,
        reportCompleted: item.reportCompleted === 'on',
        status: item.status || '진행중',
        taskDetails: {
          dateTime: {
            date: item.taskDetails?.dateTime?.date || '',
            startTime: item.taskDetails?.dateTime?.startTime || '',
            endTime: item.taskDetails?.dateTime?.endTime || ''
          },
          personnel: {
            company: item.taskDetails?.personnel?.company || '',
            name: item.taskDetails?.personnel?.name || '',
            additionalCount: parseInt(item.taskDetails?.personnel?.additionalCount) || 0,
            phone: item.taskDetails?.personnel?.phone || ''
          },
          location: item.taskDetails?.location || '',
          content: item.taskDetails?.content || '',
          additionalInfo: item.taskDetails?.additionalInfo || ''
        }
      }));
    }
    
    await Handover.findByIdAndUpdate(req.params.id, updateData);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_HANDOVER',
      details: `인계장 수정: ${handover.formattedHandoverDate}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    req.flash('success', '인계장이 성공적으로 수정되었습니다.');
    res.redirect(`/handovers/${req.params.id}`);
  } catch (error) {
    console.error('인계장 수정 오류:', error);
    req.flash('error', '인계장 수정 중 오류가 발생했습니다.');
    res.redirect(`/handovers/${req.params.id}/edit`);
  }
});

// 인계장 삭제
router.delete('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id);
    
    if (!handover) {
      return res.status(404).json({ 
        success: false,
        message: '인계장을 찾을 수 없습니다.'
      });
    }
    
    await Handover.findByIdAndDelete(req.params.id);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'DELETE_HANDOVER',
      details: `인계장 삭제: ${handover.formattedHandoverDate}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true,
      message: '인계장이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('인계장 삭제 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '인계장 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 인계장 상태 변경
router.patch('/:id/status', isLoggedIn, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const handover = await Handover.findById(req.params.id);
    
    if (!handover) {
      return res.status(404).json({ 
        success: false,
        message: '인계장을 찾을 수 없습니다.'
      });
    }
    
    handover.status = status;
    handover.handoverTo = req.session.userId;
    await handover.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_HANDOVER_STATUS',
      details: `인계장 상태 변경: ${handover.formattedHandoverDate} -> ${status}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true,
      message: '인계장 상태가 성공적으로 변경되었습니다.',
      status: status
    });
  } catch (error) {
    console.error('인계장 상태 변경 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '인계장 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// 인계사항 보고 완료 처리
router.patch('/:id/items/:itemId/report', isLoggedIn, async (req, res) => {
  try {
    const { reportCompleted } = req.body;
    const handover = await Handover.findById(req.params.id);
    
    if (!handover) {
      return res.status(404).json({ 
        success: false,
        message: '인계장을 찾을 수 없습니다.'
      });
    }
    
    const item = handover.handoverItems.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: '인계사항을 찾을 수 없습니다.'
      });
    }
    
    item.reportCompleted = reportCompleted === 'true';
    await handover.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'UPDATE_HANDOVER_ITEM_REPORT',
      details: `인계사항 보고 완료 처리: ${item.taskType} -> ${reportCompleted === 'true' ? '완료' : '미완료'}`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ 
      success: true,
      message: '보고 완료 상태가 성공적으로 변경되었습니다.',
      reportCompleted: item.reportCompleted
    });
  } catch (error) {
    console.error('인계사항 보고 완료 처리 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '보고 완료 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// 인계장 통계 조회
router.get('/stats/summary', isLoggedIn, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.handoverDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (department) {
      filter.department = department;
    }
    
    const stats = await Handover.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalHandovers: { $sum: 1 },
          totalItems: { $sum: { $size: '$handoverItems' } },
          completedReports: {
            $sum: {
              $size: {
                $filter: {
                  input: '$handoverItems',
                  cond: { $eq: ['$$this.reportCompleted', true] }
                }
              }
            }
          },
          teamStats: {
            $push: {
              $map: {
                input: '$handoverItems',
                as: 'item',
                in: '$$item.assignedTeam'
              }
            }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalHandovers: 0,
      totalItems: 0,
      completedReports: 0,
      teamStats: []
    };
    
    // 팀별 통계 계산
    const teamCounts = {};
    result.teamStats.forEach(teamArray => {
      teamArray.forEach(team => {
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      });
    });
    
    res.json({
      success: true,
      data: {
        totalHandovers: result.totalHandovers,
        totalItems: result.totalItems,
        completedReports: result.completedReports,
        pendingReports: result.totalItems - result.completedReports,
        completionRate: result.totalItems > 0 ? 
          Math.round((result.completedReports / result.totalItems) * 100) : 0,
        teamStats: teamCounts
      }
    });
  } catch (error) {
    console.error('인계장 통계 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
