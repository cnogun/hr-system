/**
 * 파일명: Employee.js
 * 목적: 직원 정보 데이터 모델 정의
 * 기능:
 * - 직원 기본 정보 (이름, 사번, 부서, 직급 등)
 * - 연락처 정보 (전화번호, 이메일, 주소 등)
 * - 유니폼/장구류 사이즈 정보
 * - 재직 상태 및 입사일 관리
 * - 데이터 검증 및 스키마 정의
 */

const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  // 유저 참조 (권한/본인확인용)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 조직정보
  orgType: { type: String }, // 본부/영업소 구분
  department: { type: String },
  team: { type: String },
  position: { type: String },

  // 개인정보
  name: { type: String, required: true },
  age: { type: Number },
  birth: { type: Date },
  residentNumber: { 
    type: String, 
    default: null,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true; // 빈 값은 허용
        // 주민등록번호 형식 검사 (000000-0000000)
        const pattern = /^\d{6}-\d{7}$/;
        if (!pattern.test(v)) return false;
        
        // 주민등록번호 유효성 검사
        const numbers = v.replace('-', '').split('').map(Number);
        const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
        let sum = 0;
        
        for (let i = 0; i < 12; i++) {
          sum += numbers[i] * weights[i];
        }
        
        const remainder = sum % 11;
        const checkDigit = remainder < 2 ? 0 : 11 - remainder;
        
        return numbers[12] === checkDigit;
      },
      message: '유효하지 않은 주민등록번호입니다. (예: 123456-1234567)'
    }
  }, // 주민등록번호
  gender: { type: String, enum: ['', '남', '여'] },
  nationality: { type: String },
  education: { type: String },
  ssn: { type: String }, // 주민등록번호 (기존)

  // 연락처
  phone: { type: String },
  mobile: { type: String },
  email: { type: String, required: true, unique: true },
  address: { type: String },
  emergencyContact: { type: String },

  // 고용정보
  empNo: { type: String }, // 사번
  status: { type: String, enum: ['재직', '퇴직', '휴직'], default: '재직' }, // 재직상태
  employmentType: { type: String, enum: ['', '정규직', '파견직', '계약직'] },
  hireDate: { type: Date },
  salaryBank: { type: String },
  salaryAccount: { type: String },

  // 업무정보
  workLocation: { type: String },
  rewardPunishment: { type: String }, // 상벌사항

  // 유니폼/장구류 사이즈
  uniformSummerTop: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  uniformSummerTopQty: { type: Number, default: 1 },
  uniformSummerBottom: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] },
  uniformSummerBottomQty: { type: Number, default: 1 },
  uniformWinterTop: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  uniformWinterTopQty: { type: Number, default: 1 },
  uniformWinterBottom: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] },
  uniformWinterBottomQty: { type: Number, default: 1 },
  uniformWinterPants: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] }, // 방한하의
  uniformWinterPantsQty: { type: Number, default: 1 },
  uniformWinterCoat: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] }, // 방한외투
  uniformWinterCoatQty: { type: Number, default: 1 },
  raincoat: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  raincoatQty: { type: Number, default: 1 },
  cap: { type: String, enum: ['', '별대', '특대', '대', '중', '소'] },
  capQty: { type: Number, default: 1 },
  safetyShoes: { type: String, enum: ['', '290', '285', '280', '275', '270', '265', '260', '255', '250'] },
  safetyShoesQty: { type: Number, default: 1 },
  rainBoots: { type: String, enum: ['', '290', '285', '280', '275', '270', '265', '260', '255', '250'] },
  rainBootsQty: { type: Number, default: 1 },
  winterJacket: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] }, // 동점퍼
  winterJacketQty: { type: Number, default: 1 },
  doubleJacket: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] }, // 겹점퍼
  doubleJacketQty: { type: Number, default: 1 },
  springAutumnUniform: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },

  // 프로필 이미지
  profileImage: { type: String },
  bloodType: { type: String },
  height: { type: Number },
  weight: { type: Number },
  militaryService: { type: String },
  militaryDischargeDate: { type: Date },
  
  // 병역사항 상세정보
  militaryBranch: { type: String }, // 군별
  militaryRank: { type: String }, // 계급
  militaryNumber: { type: String }, // 군번
  militaryServicePeriod: { type: String }, // 복무기간
  militaryExemptionReason: { type: String }, // 미필사유
  
  // 특이사항
  specialNotes: { type: String },
  
  // 경력사항
  career: { type: String },
});

module.exports = mongoose.model('Employee', employeeSchema); 