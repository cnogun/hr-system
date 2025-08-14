const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['duty_order', 'handover', 'schedule', 'comment', 'system'], 
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedItem: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'relatedItemModel' 
  },
  relatedItemModel: { 
    type: String, 
    enum: ['DutyOrder', 'Handover', 'Schedule'] 
  },
  isRead: { type: Boolean, default: false },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'high'], 
    default: 'normal' 
  },
  actionUrl: { type: String }, // 알림 클릭시 이동할 URL
  expiresAt: { type: Date } // 알림 만료일
}, { timestamps: true });

// 인덱스 설정
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
