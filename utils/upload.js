/**
 * 파일명: upload.js
 * 목적: 파일 업로드 유틸리티 함수
 * 기능:
 * - 파일 업로드 설정
 * - 파일 형식 검증
 * - 파일 크기 제한
 * - 파일명 중복 처리
 * - 업로드 경로 관리
 */
const multer = require('multer');
const path = require('path');

// 기본 파일 업로드 설정
function createUploadConfig(destination, filenamePrefix = '') {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destination);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const prefix = filenamePrefix ? filenamePrefix + '-' : '';
      cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
  });

  return multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
    fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('지원하지 않는 파일 형식입니다.'));
      }
    }
  });
}

// 직원 프로필 이미지 업로드
const employeeUpload = createUploadConfig('uploads/', 'profileImage');

// 게시판 파일 업로드
const boardUpload = createUploadConfig('uploads/board/', 'board');

// 단일 파일 업로드
const singleUpload = (fieldName) => {
  return (req, res, next) => {
    const upload = createUploadConfig('uploads/');
    return upload.single(fieldName)(req, res, next);
  };
};

// 다중 파일 업로드
const multipleUpload = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const upload = createUploadConfig('uploads/');
    return upload.array(fieldName, maxCount)(req, res, next);
  };
};

module.exports = {
  createUploadConfig,
  employeeUpload,
  boardUpload,
  singleUpload,
  multipleUpload
}; 