/**
 * 파일명: addUniformWinterPants.js
 * 목적: 기존 직원 데이터에 방한하의 필드 추가
 * 기능:
 * - 기존 직원 문서에 uniformWinterPants 필드 추가
 * - 기본값 설정 (빈 문자열, 수량 1)
 * - 데이터베이스 마이그레이션
 * - 기존 데이터 보존
 */
const mongoose = require('mongoose');
require('dotenv').config();

// Employee 모델 정의
const employeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orgType: { type: String },
  department: { type: String },
  team: { type: String },
  position: { type: String },
  name: { type: String, required: true },
  age: { type: Number },
  birth: { type: Date },
  residentNumber: { 
    type: String, 
    default: null,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true;
        const pattern = /^\d{6}-\d{7}$/;
        if (!pattern.test(v)) return false;
        
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
  },
  gender: { type: String, enum: ['', '남', '여'] },
  nationality: { type: String },
  education: { type: String },
  ssn: { type: String },
  phone: { type: String },
  mobile: { type: String },
  email: { type: String, required: true, unique: true },
  address: { type: String },
  emergencyContact: { type: String },
  empNo: { type: String },
  status: { type: String, enum: ['재직', '퇴직', '휴직'], default: '재직' },
  employmentType: { type: String, enum: ['', '정규직', '파견직', '계약직'] },
  hireDate: { type: Date },
  salaryBank: { type: String },
  salaryAccount: { type: String },
  workLocation: { type: String },
  rewardPunishment: { type: String },
  uniformSummerTop: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  uniformSummerTopQty: { type: Number, default: 1 },
  uniformSummerBottom: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] },
  uniformSummerBottomQty: { type: Number, default: 1 },
  uniformWinterTop: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  uniformWinterTopQty: { type: Number, default: 1 },
  uniformWinterBottom: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] },
  uniformWinterBottomQty: { type: Number, default: 1 },
  uniformWinterPants: { type: String, enum: ['', '38', '36', '35', '34', '33', '32', '31', '30'] },
  uniformWinterPantsQty: { type: Number, default: 1 },
  uniformWinterCoat: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  uniformWinterCoatQty: { type: Number, default: 1 },
  raincoat: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  raincoatQty: { type: Number, default: 1 },
  cap: { type: String, enum: ['', '별대', '특대', '대', '중', '소'] },
  capQty: { type: Number, default: 1 },
  safetyShoes: { type: String, enum: ['', '290', '285', '280', '275', '270', '265', '260', '255', '250'] },
  safetyShoesQty: { type: Number, default: 1 },
  rainBoots: { type: String, enum: ['', '290', '285', '280', '275', '270', '265', '260', '255', '250'] },
  rainBootsQty: { type: Number, default: 1 },
  winterJacket: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  winterJacketQty: { type: Number, default: 1 },
  doubleJacket: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  doubleJacketQty: { type: Number, default: 1 },
  springAutumnUniform: { type: String, enum: ['', '2별대', '별대', '특대', '대', '중'] },
  profileImage: { type: String },
  bloodType: { type: String },
  height: { type: Number },
  weight: { type: Number },
  militaryService: { type: String }
});

const Employee = mongoose.model('Employee', employeeSchema);

async function addUniformWinterPants() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log('MongoDB 연결 성공!');

    // uniformWinterPants 필드가 없는 직원들을 찾아서 업데이트
    const employeesToUpdate = await Employee.find({
      $or: [
        { uniformWinterPants: { $exists: false } },
        { uniformWinterPants: null }
      ]
    });

    console.log(`업데이트할 직원 수: ${employeesToUpdate.length}`);

    if (employeesToUpdate.length > 0) {
      const updatePromises = employeesToUpdate.map(employee => {
        return Employee.updateOne(
          { _id: employee._id },
          { 
            $set: { 
              uniformWinterPants: '',
              uniformWinterPantsQty: 1
            }
          }
        );
      });

      await Promise.all(updatePromises);
      console.log('모든 직원의 uniformWinterPants 필드가 추가되었습니다.');
    } else {
      console.log('업데이트할 직원이 없습니다.');
    }

    // 업데이트 결과 확인
    const totalEmployees = await Employee.countDocuments();
    const employeesWithWinterPants = await Employee.countDocuments({
      uniformWinterPants: { $exists: true }
    });

    console.log(`전체 직원 수: ${totalEmployees}`);
    console.log(`uniformWinterPants 필드가 있는 직원 수: ${employeesWithWinterPants}`);

    // 샘플 데이터 확인
    const sampleEmployee = await Employee.findOne();
    if (sampleEmployee) {
      console.log('샘플 직원 데이터:', {
        name: sampleEmployee.name,
        uniformWinterPants: sampleEmployee.uniformWinterPants,
        uniformWinterPantsQty: sampleEmployee.uniformWinterPantsQty
      });
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB 연결 종료');
  }
}

// 스크립트 실행
addUniformWinterPants(); 