const Notification = require('../models/Notification');

class NotificationService {
  // 알림 생성
  static async createNotification(data) {
    try {
      const notification = new Notification({
        recipient: data.recipient,
        sender: data.sender,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedItem: data.relatedItem,
        relatedItemModel: data.relatedItemModel,
        priority: data.priority || 'normal',
        actionUrl: data.actionUrl,
        expiresAt: data.expiresAt
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('알림 생성 오류:', error);
      throw error;
    }
  }

  // 사용자의 읽지 않은 알림 조회
  static async getUnreadNotifications(userId, limit = 10) {
    try {
      return await Notification.find({ 
        recipient: userId, 
        isRead: false 
      })
      .populate('sender', 'name username')
      .sort({ createdAt: -1 })
      .limit(limit);
    } catch (error) {
      console.error('알림 조회 오류:', error);
      throw error;
    }
  }

  // 사용자의 모든 알림 조회 (페이지네이션)
  static async getAllNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const notifications = await Notification.find({ recipient: userId })
        .populate('sender', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({ recipient: userId });
      
      return {
        notifications,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('알림 조회 오류:', error);
      throw error;
    }
  }

  // 알림 읽음 처리
  static async markAsRead(notificationId, userId) {
    try {
      return await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 모든 알림 읽음 처리
  static async markAllAsRead(userId) {
    try {
      return await Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 알림 삭제
  static async deleteNotification(notificationId, userId) {
    try {
      return await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });
    } catch (error) {
      console.error('알림 삭제 오류:', error);
      throw error;
    }
  }

  // 근무명령서 관련 알림 생성
  static async createDutyOrderNotification(dutyOrder, action = 'created') {
    try {
      const notifications = [];
      
      // 담당자들에게 알림
      if (dutyOrder.assignedTo && dutyOrder.assignedTo.length > 0) {
        for (const employeeId of dutyOrder.assignedTo) {
          // Employee에서 userId 찾기
          const Employee = require('../models/Employee');
          const employee = await Employee.findById(employeeId);
          
          if (employee && employee.userId) {
            const notification = await this.createNotification({
              recipient: employee.userId,
              sender: dutyOrder.issuedBy,
              type: 'duty_order',
              title: `새로운 근무명령서: ${dutyOrder.title}`,
              message: `${dutyOrder.department} 부서에 새로운 근무명령서가 등록되었습니다.`,
              relatedItem: dutyOrder._id,
              relatedItemModel: 'DutyOrder',
              priority: dutyOrder.priority === 'high' ? 'high' : 'normal',
              actionUrl: `/security/duty-orders/${dutyOrder._id}`
            });
            notifications.push(notification);
          }
        }
      }
      
      return notifications;
    } catch (error) {
      console.error('근무명령서 알림 생성 오류:', error);
      throw error;
    }
  }

  // 인계사항 관련 알림 생성
  static async createHandoverNotification(handover, action = 'created') {
    try {
      const notifications = [];
      
      // 인계 대상자에게 알림
      if (handover.handoverTo) {
        const Employee = require('../models/Employee');
        const employee = await Employee.findById(handover.handoverTo);
        
        if (employee && employee.userId) {
          const notification = await this.createNotification({
            recipient: employee.userId,
            sender: handover.handoverFrom,
            type: 'handover',
            title: `새로운 인계사항: ${handover.title}`,
            message: `${handover.department} 부서에서 인계사항이 등록되었습니다.`,
            relatedItem: handover._id,
            relatedItemModel: 'Handover',
            priority: handover.type === 'urgent' ? 'high' : 'normal',
            actionUrl: `/security/handover/${handover._id}`
          });
          notifications.push(notification);
        }
      }
      
      return notifications;
    } catch (error) {
      console.error('인계사항 알림 생성 오류:', error);
      throw error;
    }
  }

  // 일정 관련 알림 생성
  static async createScheduleNotification(schedule, action = 'created') {
    try {
      const notifications = [];
      
      // 참석자들에게 알림
      if (schedule.attendees && schedule.attendees.length > 0) {
        for (const employeeId of schedule.attendees) {
          const Employee = require('../models/Employee');
          const employee = await Employee.findById(employeeId);
          
          if (employee && employee.userId) {
            const notification = await this.createNotification({
              recipient: employee.userId,
              sender: schedule.createdBy,
              type: 'schedule',
              title: `새로운 일정: ${schedule.title}`,
              message: `${schedule.department} 부서에 새로운 일정이 등록되었습니다.`,
              relatedItem: schedule._id,
              relatedItemModel: 'Schedule',
              priority: schedule.priority === 'high' ? 'high' : 'normal',
              actionUrl: `/security/schedule/${schedule._id}`
            });
            notifications.push(notification);
          }
        }
      }
      
      return notifications;
    } catch (error) {
      console.error('일정 알림 생성 오류:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
