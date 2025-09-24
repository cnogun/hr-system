/**
 * 파일명: dutyOrders.js
 * 목적: 인사명령 관리 라우트
 * 기능:
 * - 인사명령 생성, 조회, 수정, 삭제
 * - 인사명령 승인/취소
 * - 직원 근무 배정 관리
 * - 인사명령 이력 관리
 */

const express = require('express');
const router = express.Router();
const DutyOrder = require('../models/DutyOrder');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Log = require('../models/Log');

// 인사명령 목록 조회
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, orderType, status, department, priority } = req.query;
    const query = {};
    
    // 필터링 조건
    if (orderType) query.orderType = orderType;
    if (status) query.status = status;
    if (department) query.department = department;
    if (priority) query.priority = priority;
    
    const dutyOrders = await DutyOrder.find(query)
      .populate({
        path: 'issuedBy',
        select: 'name position',
        options: { strictPopulate: false }
      })
      .populate('assignedEmployees.employee', 'name department position')
      .populate('approval.approvedBy', 'name position')
      .sort({ effectiveDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await DutyOrder.countDocuments(query);
    
    res.json({
      success: true,
      data: dutyOrders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total: total
      }
    });
  } catch (error) {
    console.error('인사명령 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 인사명령 조회
router.get('/:id', async (req, res) => {
  try {
    const dutyOrder = await DutyOrder.findById(req.params.id)
      .populate('issuedBy', 'name position')
      .populate('assignedEmployees.employee', 'name department position employeeId')
      .populate('approval.approvedBy', 'name position')
      .populate('comments.user', 'name position');
    
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 조회 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 생성
router.post('/', async (req, res) => {
  try {
    const {
      title,
      content,
      orderType,
      priority,
      department,
      effectiveDate,
      deadline,
      assignedEmployees
    } = req.body;
    
    // 인사명령 번호 생성 (YYYYMMDD-XXX 형식)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await DutyOrder.countDocuments({
      orderNumber: { $regex: `^${dateStr}` }
    });
    const orderNumber = `${dateStr}-${String(count + 1).padStart(3, '0')}`;
    
    const dutyOrder = new DutyOrder({
      orderNumber,
      title,
      content,
      orderType,
      priority,
      department,
      effectiveDate: new Date(effectiveDate),
      deadline: deadline ? new Date(deadline) : null,
      issuedBy: req.session.userId,
      assignedEmployees: assignedEmployees || []
    });
    
    await dutyOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'create_duty_order',
      detail: `인사명령 생성: ${orderNumber} - ${title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령이 생성되었습니다.',
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 생성 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 수정
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      content,
      orderType,
      priority,
      department,
      effectiveDate,
      deadline,
      assignedEmployees
    } = req.body;
    
    const dutyOrder = await DutyOrder.findById(req.params.id);
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    // 시행 중인 명령은 수정 제한
    if (dutyOrder.status === '시행') {
      return res.status(400).json({
        success: false,
        message: '시행 중인 인사명령은 수정할 수 없습니다.'
      });
    }
    
    dutyOrder.title = title;
    dutyOrder.content = content;
    dutyOrder.orderType = orderType;
    dutyOrder.priority = priority;
    dutyOrder.department = department;
    dutyOrder.effectiveDate = new Date(effectiveDate);
    dutyOrder.deadline = deadline ? new Date(deadline) : null;
    dutyOrder.assignedEmployees = assignedEmployees || [];
    
    await dutyOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'update_duty_order',
      detail: `인사명령 수정: ${dutyOrder.orderNumber} - ${title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령이 수정되었습니다.',
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 수정 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 승인
router.post('/:id/approve', async (req, res) => {
  try {
    const { approvalNotes } = req.body;
    
    const dutyOrder = await DutyOrder.findById(req.params.id);
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    if (dutyOrder.status !== '대기') {
      return res.status(400).json({
        success: false,
        message: '승인 가능한 상태가 아닙니다.'
      });
    }
    
    dutyOrder.status = '시행';
    dutyOrder.approval = {
      approvedBy: req.session.userId,
      approvedAt: new Date(),
      approvalNotes: approvalNotes || ''
    };
    
    await dutyOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'approve_duty_order',
      detail: `인사명령 승인: ${dutyOrder.orderNumber} - ${dutyOrder.title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령이 승인되었습니다.',
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 승인 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 승인 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 완료
router.post('/:id/complete', async (req, res) => {
  try {
    const dutyOrder = await DutyOrder.findById(req.params.id);
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    if (dutyOrder.status !== '시행') {
      return res.status(400).json({
        success: false,
        message: '완료 가능한 상태가 아닙니다.'
      });
    }
    
    dutyOrder.status = '완료';
    dutyOrder.progress = 100;
    await dutyOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'complete_duty_order',
      detail: `인사명령 완료: ${dutyOrder.orderNumber} - ${dutyOrder.title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령이 완료되었습니다.',
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 완료 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 완료 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 취소
router.post('/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;
    
    const dutyOrder = await DutyOrder.findById(req.params.id);
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    if (dutyOrder.status === '완료') {
      return res.status(400).json({
        success: false,
        message: '완료된 인사명령은 취소할 수 없습니다.'
      });
    }
    
    dutyOrder.status = '취소';
    await dutyOrder.save();
    
    // 코멘트 추가
    dutyOrder.comments.push({
      user: req.session.userId,
      content: `취소 사유: ${cancelReason || '사유 미입력'}`
    });
    await dutyOrder.save();
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'cancel_duty_order',
      detail: `인사명령 취소: ${dutyOrder.orderNumber} - ${dutyOrder.title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령이 취소되었습니다.',
      data: dutyOrder
    });
  } catch (error) {
    console.error('인사명령 취소 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 취소 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 삭제
router.delete('/:id', async (req, res) => {
  try {
    const dutyOrder = await DutyOrder.findById(req.params.id);
    if (!dutyOrder) {
      return res.status(404).json({
        success: false,
        message: '인사명령을 찾을 수 없습니다.'
      });
    }
    
    // 삭제 제한 해제 - 모든 상태의 인사명령서 삭제 가능
    // 필요시 관리자 권한 확인 로직 추가 가능
    
    await DutyOrder.findByIdAndDelete(req.params.id);
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'delete_duty_order',
      detail: `인사명령 삭제: ${dutyOrder.orderNumber} - ${dutyOrder.title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '인사명령서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('인사명령 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령서 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 직원 목록 조회 (인사명령 대상 선택용)
router.get('/employees/list', async (req, res) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};
    
    const employees = await Employee.find(query)
      .select('name department position employeeId')
      .sort({ department: 1, name: 1 });
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('직원 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '직원 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 인사명령 통계
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await DutyOrder.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const orderTypeStats = await DutyOrder.aggregate([
      {
        $group: {
          _id: '$orderType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const priorityStats = await DutyOrder.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        statusStats: stats,
        orderTypeStats: orderTypeStats,
        priorityStats: priorityStats
      }
    });
  } catch (error) {
    console.error('인사명령 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '인사명령 통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
