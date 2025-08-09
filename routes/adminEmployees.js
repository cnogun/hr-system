/**
 * 파일명: adminEmployees.js
 * 목적: 관리자용 직원 관리 라우트 처리
 * 기능:
 * - 관리자 전용 직원 목록 조회
 * - 직원 정보 일괄 수정
 * - 직원 상태 관리
 * - 관리자 권한 검증
 * - 고급 검색 및 필터링
 */
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const User = require('../models/User');
const Log = require('../models/Log');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// 사번 생성 함수
async function generateEmpNo(orgType, department) {
  const orgCode = orgType === '본사' ? '1' : '2';
  let deptCode = '88';
  if (department === '보안1팀') deptCode = '01';
  else if (department === '보안2팀') deptCode = '02';
  else if (department === '보안3팀') deptCode = '03';
  else if (department === '관리팀') deptCode = '04';
  else if (department === '인사팀') deptCode = '05';
  else if (department === '영업팀') deptCode = '06';
  else if (department === '지원팀') deptCode = '07';
  
  // 해당 부서의 최신 사번 찾기
  const latestEmployee = await Employee.findOne({ 
    orgType, 
    department,
    empNo: { $regex: `^${orgCode}${deptCode}` }
  }).sort({ empNo: -1 });
  
  let seq = 1;
  if (latestEmployee && latestEmployee.empNo) {
    const lastSeq = parseInt(latestEmployee.empNo.slice(-4));
    seq = lastSeq + 1;
  }
  
  return orgCode + deptCode + seq.toString().padStart(4, '0');
}

function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}
async function adminOnly(req, res, next) {
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.send('관리자만 접근 가능합니다.');
  }
  next();
}

// 관리자 전용: 직원 전체 카드형 통합 페이지
router.get('/', isLoggedIn, adminOnly, async (req, res) => {
  const employees = await Employee.find();
  res.render('employeesCard', { 
    employees, 
    session: req.session,
    message: req.session.message 
  });
  delete req.session.message;
});

// 관리자 전용: 신입직원 추가 폼
router.get('/new', isLoggedIn, adminOnly, async (req, res) => {
  const users = await User.find({ role: 'employee' }).sort({ username: 1 });
  const employees = await Employee.find().sort({ name: 1 });
  res.render('addEmployee', { users, employees, session: req.session });
});

// 관리자 전용: 신입직원 추가 처리
router.post('/new', isLoggedIn, adminOnly, upload.single('profileImage'), async (req, res) => {
  const { name, email, userId, orgType, department, position, hireDate } = req.body;
  
  try {
    // 이메일 중복 검사
    const existingEmployee = await Employee.findOne({ email: email });
    if (existingEmployee) {
      return res.status(400).send(`
        <script>
          alert('이미 존재하는 이메일입니다: ${email}');
          history.back();
        </script>
      `);
    }
    
    // userId 중복 검사
    const existingUserEmployee = await Employee.findOne({ userId: userId });
    if (existingUserEmployee) {
      return res.status(400).send(`
        <script>
          alert('이미 등록된 사용자입니다. 다른 사용자를 선택해주세요.');
          history.back();
        </script>
      `);
    }
    
    // 주민등록번호 중복 검사 (빈 값이 아닌 경우에만)
    if (req.body.residentNumber && req.body.residentNumber.trim() !== '') {
      const existingResidentNumber = await Employee.findOne({ 
        residentNumber: req.body.residentNumber,
        _id: { $ne: req.params.id } // 수정 시 자기 자신 제외
      });
      if (existingResidentNumber) {
        return res.status(400).send(`
          <script>
            alert('이미 등록된 주민등록번호입니다: ${req.body.residentNumber}');
            history.back();
          </script>
        `);
      }
    }
    
    // 사번 자동 생성
    const empNo = await generateEmpNo(orgType, department);
    
    // 디버깅: 입력 데이터 확인
    console.log('신입 직원 추가 데이터:', {
      name: req.body.name,
      career: req.body.career,
      specialNotes: req.body.specialNotes,
      profileImage: req.file ? req.file.filename : '없음'
    });
    
    // 프로필 이미지 경로 설정
    let profileImagePath = null;
    if (req.file) {
      profileImagePath = '/uploads/' + req.file.filename;
    }
    
    const employee = new Employee({
      name,
      email,
      userId,
      empNo,
      orgType,
      department,
      position,
      status: req.body.status || '재직',
      hireDate,
      employmentType: req.body.employmentType,
      
      // 개인정보
      birth: req.body.birth,
      residentNumber: req.body.residentNumber && req.body.residentNumber.trim() !== '' ? req.body.residentNumber : null,
      gender: req.body.gender,
      nationality: req.body.nationality || '대한민국',
      education: req.body.education,
      
      // 연락처 정보
      phone: req.body.phone,
      mobile: req.body.mobile,
      address: req.body.address,
      emergencyContact: req.body.emergencyContact,
      
      // 급여 정보
      salaryBank: req.body.salaryBank,
      salaryAccount: req.body.salaryAccount,
      
      // 신체 정보
      height: req.body.height,
      weight: req.body.weight,
      bloodType: req.body.bloodType,
      
      // 병역 정보
      militaryBranch: req.body.militaryBranch,
      militaryRank: req.body.militaryRank,
      militaryNumber: req.body.militaryNumber,
      militaryServicePeriod: req.body.militaryServicePeriod,
      militaryExemptionReason: req.body.militaryExemptionReason,
      
      // 경력 및 특이사항
      career: req.body.career,
      specialNotes: req.body.specialNotes,
      
      // 프로필 이미지
      profileImage: profileImagePath,
      
      // 유니폼 정보
      cap: req.body.cap,
      uniformSummerTop: req.body.uniformSummerTop,
      uniformSummerBottom: req.body.uniformSummerBottom,
      uniformWinterTop: req.body.uniformWinterTop,
      uniformWinterBottom: req.body.uniformWinterBottom,
      uniformWinterPants: req.body.uniformWinterPants,
      uniformWinterCoat: req.body.uniformWinterCoat,
      raincoat: req.body.raincoat,
      springAutumnUniform: req.body.springAutumnUniform,
      safetyShoes: req.body.safetyShoes,
      rainBoots: req.body.rainBoots,
      winterJacket: req.body.winterJacket,
      doubleJacket: req.body.doubleJacket,
      
      // 수량 정보
      capQty: req.body.capQty || 1,
      uniformSummerTopQty: req.body.uniformSummerTopQty || 1,
      uniformSummerBottomQty: req.body.uniformSummerBottomQty || 1,
      uniformWinterTopQty: req.body.uniformWinterTopQty || 1,
      uniformWinterBottomQty: req.body.uniformWinterBottomQty || 1,
      uniformWinterPantsQty: req.body.uniformWinterPantsQty || 1,
      uniformWinterCoatQty: req.body.uniformWinterCoatQty || 1,
      raincoatQty: req.body.raincoatQty || 1,
      springAutumnUniformQty: req.body.springAutumnUniformQty || 1,
      safetyShoesQty: req.body.safetyShoesQty || 1,
      rainBootsQty: req.body.rainBootsQty || 1,
      winterJacketQty: req.body.winterJacketQty || 1,
      doubleJacketQty: req.body.doubleJacketQty || 1
    });
    
    await employee.save();
    
    // 디버깅: 저장된 데이터 확인
    console.log('✅ 신입 직원 저장 완료:', {
      id: employee._id,
      name: employee.name,
      career: employee.career,
      specialNotes: employee.specialNotes,
      profileImage: employee.profileImage
    });
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'create',
      detail: `관리자 신입직원 추가: ${name} (사번: ${employee.empNo})`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // 성공 메시지와 함께 리다이렉트
    req.session.message = `신입직원 ${name}이(가) 추가되었습니다. (사번: ${employee.empNo})`;
    res.redirect('/admin/employees');
  } catch (error) {
    console.error('신입직원 추가 오류:', error);
    res.status(500).send(`
      <script>
        alert('신입직원 추가 중 오류가 발생했습니다. 다시 시도해주세요.');
        history.back();
      </script>
    `);
  }
});

// 관리자 전용: 직원 상세정보 페이지
router.get('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    // ObjectId 유효성 검사
    if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send('유효하지 않은 직원 ID입니다.');
    }
    
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
    res.render('employeesCardDetail', { 
      employee, 
      session: req.session,
      message: req.session.message 
    });
    delete req.session.message;
  } catch (error) {
    console.error('직원 상세정보 조회 오류:', error);
    res.status(500).send('직원 상세정보 조회 중 오류가 발생했습니다.');
  }
});

// 단일 필드 등록/수정 폼
router.get('/:id/editField/:field', isLoggedIn, adminOnly, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  const field = req.params.field;
  if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  res.render('editEmployeeField', { employee, field, value: employee[field], session: req.session });
});
// 단일 필드 저장
router.post('/:id/editField/:field', isLoggedIn, adminOnly, async (req, res) => {
  const field = req.params.field;
  const value = req.body.value;
  await Employee.findByIdAndUpdate(req.params.id, { [field]: value });
  res.redirect('/admin/employees/' + req.params.id);
});
// 단일 필드 삭제
router.post('/:id/deleteField/:field', isLoggedIn, adminOnly, async (req, res) => {
  const field = req.params.field;
  await Employee.findByIdAndUpdate(req.params.id, { [field]: '' });
  res.redirect('/admin/employees/' + req.params.id);
});

// 상세정보 일괄 관리 페이지
router.get('/:id/editDetails', isLoggedIn, adminOnly, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  res.render('editEmployeeDetails', { employee, session: req.session });
});
router.post('/:id/editDetails', isLoggedIn, adminOnly, async (req, res) => {
  const fields = [
    'orgType','nationality','ssn','gender','age','birth','phone','mobile','address','bloodType','height','weight',
    'militaryBranch','militaryRank','militaryNumber','militaryServicePeriod','militaryExemptionReason','specialNotes','career',
    'education','employmentType','hireDate','salaryBank','salaryAccount','workLocation','rewardPunishment'
  ];
  const update = {};
  fields.forEach(f => { 
    if (f === 'ssn') {
      // 주민등록번호는 빈 문자열 대신 null로 저장
      update[f] = req.body[f] && req.body[f].trim() !== '' ? req.body[f] : null;
    } else {
      update[f] = req.body[f] || '';
    }
  });
  const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });
  await Log.create({
    userId: req.session.userId,
    action: 'update',
    detail: `관리자 상세정보 일괄수정: ${updatedEmployee.name} (${req.params.id})`,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // 성공 메시지와 함께 상세페이지로 리다이렉트
  req.session.message = `직원 ${updatedEmployee.name}의 상세정보가 수정되었습니다.`;
  res.redirect(`/admin/employees/${req.params.id}`);
});

// 직원 삭제 확인 페이지
router.get('/:id/delete', isLoggedIn, adminOnly, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  res.render('deleteEmployeeConfirm', { employee, session: req.session });
});
// 직원 삭제 처리
router.post('/:id/delete', isLoggedIn, adminOnly, async (req, res) => {
  try {
    // ObjectId 유효성 검사
    if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send('유효하지 않은 직원 ID입니다.');
    }
    
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).send('직원을 찾을 수 없습니다.');
    }
    
    await Log.create({
      userId: req.session.userId,
      action: 'delete',
      detail: `관리자 직원 삭제: ${employee.name} (${req.params.id})`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.redirect('/admin/employees');
  } catch (error) {
    console.error('직원 삭제 오류:', error);
    res.status(500).send('직원 삭제 중 오류가 발생했습니다.');
  }
});

// 직원 단일 필드 인라인 수정 (PATCH) - 상세카드용
router.patch('/:id/field', isLoggedIn, adminOnly, async (req, res) => {
  const { field, value } = req.body;
  if (!field) return res.status(400).json({ error: '필드명이 필요합니다.' });
  
  try {
    const update = {};
    update[field] = value;
    const employee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!employee) return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'update',
      detail: `관리자 필드 수정: ${req.params.id} - ${field}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ success: true, value: employee[field] });
  } catch (error) {
    console.error('필드 수정 오류:', error);
    res.status(500).json({ error: '필드 수정 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 