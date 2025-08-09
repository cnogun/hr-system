/**
 * 파일명: auth.js
 * 목적: 인증 및 권한 검증 미들웨어
 * 기능:
 * - 로그인 상태 확인
 * - 관리자 권한 검증
 * - 사용자 권한 검증
 * - 세션 관리
 * - 보안 처리
 */
const User = require('../models/User');

// 로그인 체크 미들웨어
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// 관리자 권한 체크 미들웨어
async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).send('관리자만 접근 가능합니다.');
    }
    next();
  } catch (error) {
    console.error('관리자 권한 체크 오류:', error);
    res.status(500).send('권한 확인 중 오류가 발생했습니다.');
  }
}

// 본인 또는 관리자 접근 허용 미들웨어
async function requireSelfOrAdmin(req, res, next) {
  try {
    const userId = req.session.userId;
    const targetUserId = req.params.userId || req.body.userId;
    
    if (!userId) {
      return res.redirect('/auth/login');
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(403).send('사용자를 찾을 수 없습니다.');
    }
    
    // 관리자이거나 본인인 경우 허용
    if (user.role === 'admin' || userId === targetUserId) {
      next();
    } else {
      res.status(403).send('접근 권한이 없습니다.');
    }
  } catch (error) {
    console.error('권한 체크 오류:', error);
    res.status(500).send('권한 확인 중 오류가 발생했습니다.');
  }
}

module.exports = {
  isLoggedIn,
  adminOnly,
  requireSelfOrAdmin
}; 