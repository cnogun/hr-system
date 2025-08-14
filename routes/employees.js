/**
 * 파일명: employees.js
 * 목적: 직원 정보 관리 라우트 처리
 * 기능:
 * - 직원 목록 조회 및 페이징
 * - 직원 정보 추가/수정/삭제
 * - 직원 상세 정보 조회
 * - 직원 검색 및 필터링
 * - 엑셀 파일 업로드/다운로드
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { parse } = require('csv-parse');
const Log = require('../models/Log');

function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

const User = require('../models/User');
async function adminOnly(req, res, next) {
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.send('관리자만 접근 가능합니다.');
  }
  next();
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// 직원 목록 (검색/정렬/페이징)
router.get('/', isLoggedIn, async (req, res) => {
  const { search, department, position, sort, order, page = 1, limit = 10 } = req.query;
  const query = {};
  
  // 디버깅을 위한 로그 추가
  console.log('검색 파라미터:', { search, department, position, sort, order, page, limit });
  
  if (search && search.trim() !== '') {
    const searchTerm = search.trim();
    query.name = { $regex: searchTerm, $options: 'i' };
    console.log('검색어:', searchTerm);
    console.log('검색 쿼리:', query);
    
    // 추가 디버깅: 전체 직원 목록에서 이름 확인
    const allEmployees = await Employee.find({}).select('name');
    console.log('전체 직원 이름 목록:', allEmployees.map(emp => emp.name));
  }
  if (department) query.department = department;
  if (position) query.position = position;
  let sortOption = {};
  if (sort) {
    sortOption[sort] = order === 'desc' ? -1 : 1;
  }
  
  console.log('최종 쿼리:', query);
  console.log('정렬 옵션:', sortOption);
  
  const total = await Employee.countDocuments(query);
  console.log('총 검색 결과 수:', total);
  
  const employees = await Employee.find(query)
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('+userId');
    
  console.log('검색된 직원 수:', employees.length);
  if (employees.length > 0) {
    console.log('검색된 직원 이름들:', employees.map(emp => emp.name));
  } else if (search && search.trim() !== '') {
    console.log('검색 결과가 없습니다. 검색어:', search.trim());
  }
  
  // 부서/직급 목록 추출(필터용)
  const departments = await Employee.distinct('department');
  // 직급 목록을 원하는 순서로 정의하고 데이터베이스에서 가져온 직급과 합치기 (빈 값 제외)
  const orderedPositions = ['인턴', '사원', '주임', '대리', '과장', '차장', '팀장', '실장', '임원'];
  const dbPositions = await Employee.distinct('position');
  const positions = [...new Set([...orderedPositions, ...dbPositions])].filter(pos => pos && pos.trim() !== '');
  const totalPages = Math.ceil(total / limit);
  console.log('템플릿에 전달할 데이터:');
  console.log('- employees.length:', employees.length);
  console.log('- query:', query);
  console.log('- search term:', req.query.search);
  
  // 추가 통계 데이터
  const totalEmployees = await Employee.countDocuments();
  const activeEmployees = await Employee.countDocuments({ status: '재직' });
  const newEmployees = await Employee.countDocuments({
    hireDate: { 
      $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) 
    }
  });
  
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
  
  res.render('employees', {
    employees,
    departments,
    positions,
    totalPages,
    page,
    totalEmployees,
    activeEmployees,
    newEmployees,
    query: req.query,
    message: req.session.message,
    session: req.session
  });
});

// 직원 추가 폼
router.get('/new', isLoggedIn, adminOnly, async (req, res) => {
  const employees = await Employee.find().sort({ name: 1 });
  const users = await User.find().sort({ username: 1 });
  
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
  
  res.render('addEmployee', { employees, users, session: req.session });
});

// 기존 직원 선택 폼
router.get('/existing', isLoggedIn, adminOnly, async (req, res) => {
  const employees = await Employee.find().sort({ name: 1 });
  
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
  
  res.render('existingEmployee', { employees, session: req.session });
});

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
// 직원 추가
router.post('/', isLoggedIn, adminOnly, upload.single('profileImage'), async (req, res) => {
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
    
    // 디버깅: 전송된 모든 데이터 로깅
    console.log('=== 신입정보 저장 디버깅 ===');
    console.log('req.body 전체:', req.body);
    console.log('기본 정보:', { name, email, userId, empNo, orgType, department, position, status: req.body.status || '재직', hireDate });
    console.log('상세 정보:', {
      birth: req.body.birth,
      gender: req.body.gender,
      nationality: req.body.nationality,
      education: req.body.education,
      phone: req.body.phone,
      mobile: req.body.mobile,
      address: req.body.address,
      emergencyContact: req.body.emergencyContact,
      employmentType: req.body.employmentType,
      salaryBank: req.body.salaryBank,
      salaryAccount: req.body.salaryAccount,
      height: req.body.height,
      weight: req.body.weight,
      bloodType: req.body.bloodType,
      militaryBranch: req.body.militaryBranch,
      militaryRank: req.body.militaryRank,
      militaryNumber: req.body.militaryNumber,
      militaryServicePeriod: req.body.militaryServicePeriod,
      militaryExemptionReason: req.body.militaryExemptionReason,
      career: req.body.career,
      specialNotes: req.body.specialNotes
    });
    console.log('유니폼 정보:', {
      cap: req.body.cap,
      uniformSummerTop: req.body.uniformSummerTop,
      uniformSummerBottom: req.body.uniformSummerBottom,
      uniformWinterTop: req.body.uniformWinterTop,
      uniformWinterBottom: req.body.uniformWinterBottom,
      uniformWinterPants: req.body.uniformWinterPants,
      springAutumnUniform: req.body.springAutumnUniform,
      uniformWinterCoat: req.body.uniformWinterCoat,
      raincoat: req.body.raincoat,
      safetyShoes: req.body.safetyShoes,
      rainBoots: req.body.rainBoots,
      winterJacket: req.body.winterJacket,
      doubleJacket: req.body.doubleJacket
    });
    console.log('=== 디버깅 끝 ===');
    
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
      cap: req.body.cap,
    uniformSummerTop: req.body.uniformSummerTop,
    uniformSummerBottom: req.body.uniformSummerBottom,
    uniformWinterTop: req.body.uniformWinterTop,
    uniformWinterBottom: req.body.uniformWinterBottom,
    uniformWinterPants: req.body.uniformWinterPants,
      springAutumnUniform: req.body.springAutumnUniform,
    uniformWinterCoat: req.body.uniformWinterCoat,
    raincoat: req.body.raincoat,
    safetyShoes: req.body.safetyShoes,
      rainBoots: req.body.rainBoots,
      winterJacket: req.body.winterJacket,
      doubleJacket: req.body.doubleJacket,
      birth: req.body.birth,
      residentNumber: req.body.residentNumber && req.body.residentNumber.trim() !== '' ? req.body.residentNumber : null,
      gender: req.body.gender,
      nationality: req.body.nationality,
      education: req.body.education,
      phone: req.body.phone,
      mobile: req.body.mobile,
      address: req.body.address,
      emergencyContact: req.body.emergencyContact,
      employmentType: req.body.employmentType,
      salaryBank: req.body.salaryBank,
      salaryAccount: req.body.salaryAccount,
      height: req.body.height,
      weight: req.body.weight,
      bloodType: req.body.bloodType,
      militaryBranch: req.body.militaryBranch,
      militaryRank: req.body.militaryRank,
      militaryNumber: req.body.militaryNumber,
      militaryServicePeriod: req.body.militaryServicePeriod,
      militaryExemptionReason: req.body.militaryExemptionReason,
      specialNotes: req.body.specialNotes,
      career: req.body.career
    });
    
    employee.empNo = await generateEmpNo(orgType, department);
    if (req.file) {
      employee.profileImage = '/uploads/' + req.file.filename;
    }
    
    await employee.save();
    
    // 디버깅: 저장된 직원 데이터 확인
    console.log('=== 저장된 직원 데이터 확인 ===');
    const savedEmployee = await Employee.findById(employee._id);
    console.log('저장된 직원 ID:', savedEmployee._id);
    console.log('저장된 상세정보:', {
      birth: savedEmployee.birth,
      gender: savedEmployee.gender,
      nationality: savedEmployee.nationality,
      education: savedEmployee.education,
      phone: savedEmployee.phone,
      mobile: savedEmployee.mobile,
      address: savedEmployee.address,
      emergencyContact: savedEmployee.emergencyContact,
      employmentType: savedEmployee.employmentType,
      salaryBank: savedEmployee.salaryBank,
      salaryAccount: savedEmployee.salaryAccount,
      height: savedEmployee.height,
      weight: savedEmployee.weight,
      bloodType: savedEmployee.bloodType,
      militaryBranch: savedEmployee.militaryBranch,
      militaryRank: savedEmployee.militaryRank,
      militaryNumber: savedEmployee.militaryNumber,
      militaryServicePeriod: savedEmployee.militaryServicePeriod,
      militaryExemptionReason: savedEmployee.militaryExemptionReason,
      career: savedEmployee.career,
      specialNotes: savedEmployee.specialNotes
    });
    console.log('=== 저장된 데이터 확인 끝 ===');
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'create',
      detail: `신입직원 추가: ${name} (사번: ${employee.empNo})`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // 성공 메시지와 함께 리다이렉트
    req.session.message = `신입직원 ${name}이(가) 추가되었습니다. (사번: ${employee.empNo})`;
  res.redirect('/employees');
  } catch (error) {
    console.error('직원 추가 오류:', error);
    res.status(500).send(`
      <script>
        alert('직원 추가 중 오류가 발생했습니다. 다시 시도해주세요.');
        history.back();
      </script>
    `);
  }
});

// 직원 수정 폼
router.get('/:id/edit', isLoggedIn, adminOnly, async (req, res) => {
  const employeeData = await Employee.findById(req.params.id);
  const employees = await Employee.find().sort({ name: 1 });
  
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
  
  res.render('editEmployee', { employee: employeeData, employees, session: req.session });
});

// 직원 수정(사번은 수정 불가)
router.put('/:id', isLoggedIn, adminOnly, upload.single('profileImage'), async (req, res) => {
  const { name, orgType, department, position, email, hireDate } = req.body;
  
  try {
    // 이메일 중복 검사 (자기 자신 제외)
    const existingEmployee = await Employee.findOne({ 
      email: email, 
      _id: { $ne: req.params.id } 
    });
    if (existingEmployee) {
      return res.status(400).send(`
        <script>
          alert('이미 존재하는 이메일입니다: ${email}');
          history.back();
        </script>
      `);
    }
    
    // 주민등록번호 중복 검사 (자기 자신 제외)
    if (req.body.residentNumber && req.body.residentNumber.trim() !== '') {
      const existingResidentNumber = await Employee.findOne({ 
        residentNumber: req.body.residentNumber, 
        _id: { $ne: req.params.id } 
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
    
  // 동점퍼/겹점퍼 처리 로직
  const jacketType = req.body.jacketType;
  let winterJacket = null;
  let doubleJacket = null;
  
  if (jacketType === 'winterJacket') {
    winterJacket = req.body.winterJacket;
    doubleJacket = null;
  } else if (jacketType === 'doubleJacket') {
    doubleJacket = req.body.doubleJacket;
    winterJacket = null;
  }

  // 디버깅: 경력사항 데이터 확인
  console.log('경력사항 데이터:', req.body.career);
  console.log('특이사항 데이터:', req.body.specialNotes);
  
  const update = {
      name, orgType, department, position, email, hireDate,
      status: req.body.status,
      birth: req.body.birth,
      residentNumber: req.body.residentNumber && req.body.residentNumber.trim() !== '' ? req.body.residentNumber : null,
      gender: req.body.gender,
      nationality: req.body.nationality,
      education: req.body.education,
      phone: req.body.phone,
      mobile: req.body.mobile,
      address: req.body.address,
      emergencyContact: req.body.emergencyContact,
      employmentType: req.body.employmentType,
      salaryBank: req.body.salaryBank,
      salaryAccount: req.body.salaryAccount,
      height: req.body.height,
      weight: req.body.weight,
      bloodType: req.body.bloodType,
      militaryBranch: req.body.militaryBranch,
      militaryRank: req.body.militaryRank,
      militaryNumber: req.body.militaryNumber,
      militaryServicePeriod: req.body.militaryServicePeriod,
      militaryExemptionReason: req.body.militaryExemptionReason,
      specialNotes: req.body.specialNotes,
      career: req.body.career,
      // 유니폼/장구류 정보
      cap: req.body.cap,
      capQty: req.body.capQty,
      uniformSummerTop: req.body.uniformSummerTop,
      uniformSummerTopQty: req.body.uniformSummerTopQty,
      uniformSummerBottom: req.body.uniformSummerBottom,
      uniformSummerBottomQty: req.body.uniformSummerBottomQty,
      uniformWinterTop: req.body.uniformWinterTop,
      uniformWinterTopQty: req.body.uniformWinterTopQty,
      uniformWinterBottom: req.body.uniformWinterBottom,
      uniformWinterBottomQty: req.body.uniformWinterBottomQty,
      uniformWinterPants: req.body.uniformWinterPants,
      uniformWinterPantsQty: req.body.uniformWinterPantsQty,
      springAutumnUniform: req.body.springAutumnUniform,
      springAutumnUniformQty: req.body.springAutumnUniformQty,
      uniformWinterCoat: req.body.uniformWinterCoat,
      uniformWinterCoatQty: req.body.uniformWinterCoatQty,
      raincoat: req.body.raincoat,
      raincoatQty: req.body.raincoatQty,
      safetyShoes: req.body.safetyShoes,
      safetyShoesQty: req.body.safetyShoesQty,
      rainBoots: req.body.rainBoots,
      rainBootsQty: req.body.rainBootsQty,
      winterJacket: winterJacket,
      winterJacketQty: req.body.winterJacketQty,
      doubleJacket: doubleJacket,
      doubleJacketQty: req.body.doubleJacketQty
  };
    
  if (req.file) {
    update.profileImage = '/uploads/' + req.file.filename;
  }
    
  // empNo는 수정 불가
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });
    
    if (!updatedEmployee) {
      throw new Error('직원을 찾을 수 없습니다.');
    }
    
    console.log('✅ 직원 수정 완료:', {
      id: req.params.id,
      name: updatedEmployee.name,
      department: updatedEmployee.department,
      position: updatedEmployee.position,
      status: updatedEmployee.status,
      career: updatedEmployee.career,
      specialNotes: updatedEmployee.specialNotes
    });
    
  // 로그 기록
  await Log.create({
    userId: req.session.userId,
    action: 'update',
      detail: `직원정보 수정: ${name} (${req.params.id})`,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
    
    // 성공 메시지와 함께 직원 목록으로 리다이렉트
    req.session.message = `✅ 직원 ${name}의 정보가 성공적으로 수정되었습니다.`;
    res.redirect('/admin/employees');
  } catch (error) {
    console.error('직원 수정 오류:', error);
    res.status(500).send(`
      <script>
        alert('직원 수정 중 오류가 발생했습니다. 다시 시도해주세요.');
        history.back();
      </script>
    `);
  }
});

// 직원 삭제
router.delete('/:id', isLoggedIn, adminOnly, async (req, res) => {
  try {
    // ObjectId 유효성 검사
    if (!req.params.id || !require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send('유효하지 않은 직원 ID입니다.');
    }
    
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).send('직원을 찾을 수 없습니다.');
    }
    
  // 로그 기록
  await Log.create({
    userId: req.session.userId,
    action: 'delete',
      detail: `직원정보 삭제: ${employee.name} (${req.params.id})`,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.redirect('/employees');
  } catch (error) {
    console.error('직원 삭제 오류:', error);
    res.status(500).send('직원 삭제 중 오류가 발생했습니다.');
  }
});

// 직원 엑셀 다운로드 - 개선된 버전
router.get('/excel', isLoggedIn, async (req, res) => {
  try {
    const { search, department, position, sort, order, format = 'xlsx' } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { orgType: { $regex: search, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (position) query.position = position;
    
    let sortOption = {};
    if (sort) {
      sortOption[sort] = order === 'desc' ? -1 : 1;
    } else {
      sortOption = { name: 1 }; // 기본 정렬
    }
    
    const employees = await Employee.find(query).sort(sortOption);
    
    if (format === 'csv') {
      // CSV 형식으로 다운로드
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=employees.csv');
      
      const csvHeader = [
        '이름', '소속', '부서', '직급', '이메일', '입사일', '사번', '상태',
        '전화번호', '주소', '학력', '비상연락처', '고용형태', '급여은행', '급여계좌',
        '경력사항', '특이사항', '등록일'
      ].join(',');
      
      res.write('\ufeff'); // UTF-8 BOM
      res.write(csvHeader + '\n');
      
      employees.forEach(emp => {
        const row = [
          emp.name || '',
          emp.orgType || '',
          emp.department || '',
          emp.position || '',
          emp.email || '',
          emp.hireDate ? emp.hireDate.toISOString().slice(0,10) : '',
          emp.empNo || '',
          emp.status || '재직',
          emp.phone || '',
          emp.address || '',
          emp.education || '',
          emp.emergencyContact || '',
          emp.employmentType || '',
          emp.salaryBank || '',
          emp.salaryAccount || '',
          emp.career || '',
          emp.notes || '',
          emp.createdAt ? emp.createdAt.toISOString().slice(0,10) : ''
        ].map(field => `"${field}"`).join(',');
        
        res.write(row + '\n');
      });
      
      res.end();
    } else {
      // Excel 형식으로 다운로드
  const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('직원 목록');
      
      // 헤더 스타일
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      // 컬럼 정의
  worksheet.columns = [
        { header: '이름', key: 'name', width: 15 },
        { header: '소속', key: 'orgType', width: 12 },
        { header: '부서', key: 'department', width: 15 },
        { header: '직급', key: 'position', width: 12 },
        { header: '이메일', key: 'email', width: 25 },
        { header: '입사일', key: 'hireDate', width: 12 },
        { header: '사번', key: 'empNo', width: 12 },
        { header: '상태', key: 'status', width: 10 },
        { header: '전화번호', key: 'phone', width: 15 },
        { header: '주소', key: 'address', width: 30 },
        { header: '학력', key: 'education', width: 12 },
        { header: '비상연락처', key: 'emergencyContact', width: 15 },
        { header: '고용형태', key: 'employmentType', width: 12 },
        { header: '급여은행', key: 'salaryBank', width: 15 },
        { header: '급여계좌', key: 'salaryAccount', width: 20 },
        { header: '경력사항', key: 'career', width: 40 },
        { header: '특이사항', key: 'notes', width: 40 },
        { header: '등록일', key: 'createdAt', width: 12 }
      ];
      
      // 헤더 스타일 적용
      worksheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });
      
      // 데이터 추가
  employees.forEach(emp => {
    worksheet.addRow({
          name: emp.name || '',
          orgType: emp.orgType || '',
          department: emp.department || '',
          position: emp.position || '',
          email: emp.email || '',
      hireDate: emp.hireDate ? emp.hireDate.toISOString().slice(0,10) : '',
          empNo: emp.empNo || '',
          status: emp.status || '재직',
          phone: emp.phone || '',
          address: emp.address || '',
          education: emp.education || '',
          emergencyContact: emp.emergencyContact || '',
          employmentType: emp.employmentType || '',
          salaryBank: emp.salaryBank || '',
          salaryAccount: emp.salaryAccount || '',
          career: emp.career || '',
          notes: emp.notes || '',
          createdAt: emp.createdAt ? emp.createdAt.toISOString().slice(0,10) : ''
        });
      });
      
      // 상태별 색상 적용
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 헤더 스킵
        
        const statusCell = row.getCell('status');
        if (statusCell.value === '퇴직') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB6C1' } };
        } else if (statusCell.value === '휴직') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4B5' } };
        }
      });
      
      // 통계 정보 추가
      const statsSheet = workbook.addWorksheet('통계');
      statsSheet.columns = [
        { header: '구분', key: 'category', width: 20 },
        { header: '수량', key: 'count', width: 15 }
      ];
      
      const totalCount = employees.length;
      const activeCount = employees.filter(emp => emp.status !== '퇴직').length;
      const retiredCount = employees.filter(emp => emp.status === '퇴직').length;
      const leaveCount = employees.filter(emp => emp.status === '휴직').length;
      
      const deptStats = {};
      employees.forEach(emp => {
        deptStats[emp.department] = (deptStats[emp.department] || 0) + 1;
      });
      
      statsSheet.addRow({ category: '전체 직원', count: totalCount });
      statsSheet.addRow({ category: '재직', count: activeCount });
      statsSheet.addRow({ category: '퇴직', count: retiredCount });
      statsSheet.addRow({ category: '휴직', count: leaveCount });
      statsSheet.addRow({ category: '', count: '' }); // 빈 행
      
      Object.entries(deptStats).forEach(([dept, count]) => {
        statsSheet.addRow({ category: `${dept}`, count: count });
      });
      
      // 다운로드 파일명 설정
      const timestamp = new Date().toISOString().slice(0,10);
      const filename = `employees_${timestamp}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await workbook.xlsx.write(res);
      res.end();
    }
    
    // 로그 기록
    await Log.create({
      action: 'excel_download',
      userId: req.session.userId,
      details: `엑셀 다운로드: ${employees.length}개 직원 데이터`,
      ip: req.ip
    });
    
  } catch (error) {
    console.error('엑셀 다운로드 오류:', error);
    res.status(500).send('엑셀 다운로드 중 오류가 발생했습니다.');
  }
});

// 엑셀 관리 페이지
router.get('/excel-manager', isLoggedIn, adminOnly, async (req, res) => {
  res.render('excelManager', { 
    session: req.session,
    message: req.session.message,
    error: req.session.error
  });
  delete req.session.message;
  delete req.session.error;
});

// 엑셀 템플릿 다운로드
router.get('/excel/template', isLoggedIn, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('직원 정보 템플릿');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // 필수 필드 스타일
    const requiredStyle = {
      font: { bold: true, color: { argb: 'FF0000' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6' } }
    };

    // 컬럼 정의
    worksheet.columns = [
      { header: '이름 *', key: 'name', width: 15, style: requiredStyle },
      { header: '소속 *', key: 'orgType', width: 15, style: requiredStyle },
      { header: '부서 *', key: 'department', width: 15, style: requiredStyle },
      { header: '직급', key: 'position', width: 15 },
      { header: '이메일 *', key: 'email', width: 25, style: requiredStyle },
      { header: '입사일 *', key: 'hireDate', width: 15, style: requiredStyle },
      { header: '연결 사용자', key: 'userId', width: 20 },
      { header: '주민등록번호', key: 'residentNumber', width: 20 },
      { header: '전화번호', key: 'phone', width: 15 },
      { header: '주소', key: 'address', width: 30 },
      { header: '학력', key: 'education', width: 15 },
      { header: '비상연락처', key: 'emergencyContact', width: 20 },
      { header: '고용형태', key: 'employmentType', width: 15 },
      { header: '급여은행', key: 'salaryBank', width: 15 },
      { header: '급여계좌', key: 'salaryAccount', width: 20 },
      { header: '경력사항', key: 'career', width: 40 },
      { header: '특이사항', key: 'notes', width: 40 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 예시 데이터 추가
    worksheet.addRow({
      name: '홍길동',
      orgType: '본사',
      department: '보안1팀',
      position: '팀장',
      email: 'hong@company.com',
      hireDate: '2023-01-15',
      userId: 'hong123',
      residentNumber: '123456-1234567',
      phone: '010-1234-5678',
      address: '서울시 강남구',
      education: '대졸',
      emergencyContact: '010-9876-5432',
      employmentType: '정규직',
      salaryBank: '신한은행',
      salaryAccount: '110-123-456789',
      career: '보안업계 10년 경력',
      notes: '특별한 사항 없음'
    });

    // 유효성 검사 규칙 추가
    worksheet.dataValidations.add('B2:B1000', {
      type: 'list',
      allowBlank: false,
      formulae: ['"본사,지사"'],
      showErrorMessage: true,
      errorTitle: '입력 오류',
      error: '본사 또는 지사를 선택하세요.'
    });

    worksheet.dataValidations.add('C2:C1000', {
      type: 'list',
      allowBlank: false,
      formulae: ['"보안1팀,보안2팀,보안3팀,관리팀"'],
      showErrorMessage: true,
      errorTitle: '입력 오류',
      error: '올바른 부서를 선택하세요.'
    });

    // 설명 시트 추가
    const infoSheet = workbook.addWorksheet('사용 설명');
    infoSheet.columns = [
      { header: '항목', key: 'item', width: 20 },
      { header: '설명', key: 'description', width: 50 }
    ];

    const infoData = [
      { item: '필수 필드', description: '빨간색으로 표시된 필드는 반드시 입력해야 합니다.' },
      { item: '이름', description: '직원의 성명을 입력하세요.' },
      { item: '소속', description: '본사 또는 지사를 선택하세요.' },
      { item: '부서', description: '보안1팀, 보안2팀, 보안3팀, 관리팀 중 선택하세요.' },
      { item: '직급', description: '팀장, 대리, 주임, 사원 등 직급을 입력하세요.' },
      { item: '이메일', description: '회사 이메일 주소를 입력하세요. (예: name@company.com)' },
      { item: '입사일', description: 'YYYY-MM-DD 형식으로 입력하세요. (예: 2023-01-15)' },
      { item: '연결 사용자', description: '시스템 로그인용 사용자 ID를 입력하세요.' },
      { item: '주민등록번호', description: '000000-0000000 형식으로 입력하세요.' },
      { item: '전화번호', description: '010-0000-0000 형식으로 입력하세요.' },
      { item: '주소', description: '현재 거주 주소를 입력하세요.' },
      { item: '학력', description: '고졸, 대졸, 대학원졸 등 학력을 입력하세요.' },
      { item: '비상연락처', description: '긴급시 연락할 수 있는 번호를 입력하세요.' },
      { item: '고용형태', description: '정규직, 계약직, 인턴 등 고용형태를 입력하세요.' },
      { item: '급여은행', description: '급여를 받는 은행명을 입력하세요.' },
      { item: '급여계좌', description: '급여를 받는 계좌번호를 입력하세요.' },
      { item: '경력사항', description: '관련 업무 경력을 자유롭게 입력하세요.' },
      { item: '특이사항', description: '기타 특별한 사항이 있다면 입력하세요.' }
    ];

    infoData.forEach(row => {
      infoSheet.addRow(row);
    });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employee_template.xlsx');
  await workbook.xlsx.write(res);
  res.end();
  } catch (error) {
    console.error('템플릿 생성 오류:', error);
    res.status(500).send('템플릿 생성 중 오류가 발생했습니다.');
  }
});

// 엑셀/CSV 업로드 (대량등록) - 개선된 버전
router.post('/upload', isLoggedIn, adminOnly, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 업로드되지 않았습니다.' });
    }

  const ext = req.file.originalname.split('.').pop().toLowerCase();
    const skipHeader = req.body.skipHeader === 'on';
    const updateExisting = req.body.updateExisting === 'on';
    
    let employees = [];

  if (ext === 'csv') {
    // CSV 처리
      employees = await new Promise((resolve, reject) => {
        const data = [];
    fs.createReadStream(req.file.path)
      .pipe(parse({ columns: true, trim: true }))
          .on('data', row => data.push(row))
          .on('end', () => resolve(data))
          .on('error', reject);
      });
    } else if (ext === 'xlsx') {
    // 엑셀(xlsx) 처리
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];
      
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1 && skipHeader) return; // 헤더 스킵
        
        const values = row.values.slice(1); // 첫 번째 빈 값 제거
        if (values.length < 5) return; // 최소 필수 필드 확인
        
        const employee = {
          name: values[0] || '',
          orgType: values[1] || '',
          department: values[2] || '',
          position: values[3] || '',
          email: values[4] || '',
          hireDate: values[5] ? new Date(values[5]) : null,
          userId: values[6] || '',
          residentNumber: values[7] || '',
          phone: values[8] || '',
          address: values[9] || '',
          education: values[10] || '',
          emergencyContact: values[11] || '',
          employmentType: values[12] || '',
          salaryBank: values[13] || '',
          salaryAccount: values[14] || '',
          career: values[15] || '',
          notes: values[16] || ''
        };
        
        // 필수 필드 검증
        if (employee.name && employee.email) {
          employees.push(employee);
        }
      });
    } else {
      return res.status(400).json({ success: false, error: '지원되지 않는 파일 형식입니다.' });
    }

    // 데이터 검증
    const validEmployees = [];
    const errors = [];
    
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const rowNum = i + (skipHeader ? 2 : 1);
      
      if (!emp.name || !emp.email) {
        errors.push(`행 ${rowNum}: 이름과 이메일은 필수입니다.`);
        continue;
      }
      
      // 이메일 형식 검증
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emp.email)) {
        errors.push(`행 ${rowNum}: 올바른 이메일 형식이 아닙니다.`);
        continue;
      }
      
      // 중복 이메일 검사
      const existingEmployee = await Employee.findOne({ email: emp.email });
      if (existingEmployee && !updateExisting) {
        errors.push(`행 ${rowNum}: 이미 존재하는 이메일입니다. (${emp.email})`);
        continue;
      }
      
      validEmployees.push(emp);
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: '데이터 검증 오류가 발생했습니다.',
        details: errors.slice(0, 10) // 최대 10개 오류만 표시
      });
    }

    // 데이터베이스에 저장
    let savedCount = 0;
    let updatedCount = 0;

    for (const emp of validEmployees) {
      if (updateExisting) {
        // 기존 데이터 업데이트
        const result = await Employee.findOneAndUpdate(
          { email: emp.email },
          emp,
          { upsert: true, new: true }
        );
        if (result.isNew) {
          savedCount++;
        } else {
          updatedCount++;
        }
      } else {
        // 새 데이터 추가
        await Employee.create(emp);
        savedCount++;
      }
    }

    // 로그 기록
    await Log.create({
      action: 'bulk_upload',
      userId: req.session.userId,
      details: `엑셀 업로드: ${savedCount}개 추가, ${updatedCount}개 업데이트`,
      ip: req.ip
    });

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);

    res.json({ 
      success: true, 
      message: `성공적으로 처리되었습니다. (추가: ${savedCount}개, 업데이트: ${updatedCount}개)`,
      savedCount,
      updatedCount
    });

  } catch (error) {
    console.error('업로드 오류:', error);
    
    // 임시 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: '업로드 중 오류가 발생했습니다: ' + error.message 
    });
  }
});

// 일괄삭제(선택삭제)
router.delete('/bulk', isLoggedIn, adminOnly, async (req, res) => {
  try {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [req.body.ids];
    
    // 선택된 직원이 없는 경우
    if (!ids || ids.length === 0) {
      req.session.message = '삭제할 직원을 선택해주세요.';
      return res.redirect('/employees');
    }
    
    // ObjectId 유효성 검사
    const validIds = ids.filter(id => require('mongoose').Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      req.session.message = '유효하지 않은 직원 ID가 포함되어 있습니다.';
      return res.redirect('/employees');
    }
    
    // 삭제할 직원 정보 조회 (로그용)
    const employeesToDelete = await Employee.find({ _id: { $in: validIds } }).select('name empNo');
    const employeeNames = employeesToDelete.map(emp => `${emp.name}(${emp.empNo || '사번없음'})`).join(', ');
    
    // 직원 삭제
    const result = await Employee.deleteMany({ _id: { $in: validIds } });
    
    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'bulk_delete',
      detail: `일괄 삭제: ${employeeNames} (${result.deletedCount}명)`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    req.session.message = `${result.deletedCount}명의 직원이 삭제되었습니다.`;
    res.redirect('/employees');
  } catch (error) {
    console.error('일괄 삭제 오류:', error);
    req.session.message = '일괄 삭제 중 오류가 발생했습니다.';
  res.redirect('/employees');
  }
});

// 직원 단일 필드 인라인 수정 (PATCH)
router.patch('/:id/field', isLoggedIn, adminOnly, async (req, res) => {
  const { field, value } = req.body;
  if (!field) return res.status(400).json({ error: '필드명이 필요합니다.' });
  const update = {};
  update[field] = value;
  const employee = await Employee.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!employee) return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
  res.json({ success: true, value: employee[field] });
});

// 직원 상세보기 (이 라우트는 반드시 admin 라우트 아래에 위치해야 함)
router.get('/:id', isLoggedIn, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  
  // 디버깅: 직원 데이터 확인
  console.log('직원 상세보기 데이터:', {
    id: employee._id,
    name: employee.name,
    career: employee.career,
    specialNotes: employee.specialNotes,
    profileImage: employee.profileImage
  });
  
  res.render('employeeDetail', { employee });
});

module.exports = router; 