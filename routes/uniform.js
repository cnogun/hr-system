/**
 * 파일명: uniform.js
 * 목적: 유니폼/장구류 관리 라우트 처리
 * 기능:
 * - 개인 유니폼 정보 조회/수정
 * - 관리자용 유니폼 정보 관리
 * - 유니폼 사이즈 정보 관리
 * - 엑셀 파일 다운로드
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const User = require('../models/User');
const ExcelJS = require('exceljs');

// 인증 및 본인확인 미들웨어
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// 관리자 확인 미들웨어
async function requireAdmin(req, res, next) {
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).send('관리자만 접근 가능합니다.');
  }
  next();
}

// 본인 또는 관리자 접근 허용
async function requireSelfOrAdmin(req, res, next) {
  const userId = req.session.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(403).send('권한이 없습니다.');
  if (user.role === 'admin') return next();
  
  // 매번 최신 데이터를 불러오기 위해 fresh query 사용
  const employee = await Employee.findOne({ userId });
  if (!employee) return res.status(403).send('권한이 없습니다.');
  req.employee = employee;
  next();
}

// 유니폼 품목별 사이즈별 수량 합계 엑셀 다운로드 (관리자)
router.get('/excel-qty', requireLogin, requireAdmin, async (req, res) => {
  const employees = await Employee.find();
  const fields = [
    { key: 'cap', qty: 'capQty', label: '모자', sizes: ['별대', '특대', '대', '중', '소'] },
    { key: 'uniformSummerTop', qty: 'uniformSummerTopQty', label: '하복 상의', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'uniformSummerBottom', qty: 'uniformSummerBottomQty', label: '하복 하의', sizes: ['38', '36', '35', '34', '33', '32', '31', '30'] },
    { key: 'uniformWinterTop', qty: 'uniformWinterTopQty', label: '동복 상의', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'uniformWinterBottom', qty: 'uniformWinterBottomQty', label: '동복 하의', sizes: ['38', '36', '35', '34', '33', '32', '31', '30'] },
    { key: 'uniformWinterPants', qty: 'uniformWinterPantsQty', label: '방한하의', sizes: ['38', '36', '35', '34', '33', '32', '31', '30'] },
    { key: 'uniformWinterCoat', qty: 'uniformWinterCoatQty', label: '방한외투', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'winterJacket', qty: 'winterJacketQty', label: '동점퍼', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'doubleJacket', qty: 'doubleJacketQty', label: '겹점퍼', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'raincoat', qty: 'raincoatQty', label: '우의', sizes: ['2별대', '별대', '특대', '대'] },
    { key: 'safetyShoes', qty: 'safetyShoesQty', label: '신발(안전화)', sizes: ['290', '285', '280', '275', '270', '265', '260', '255', '250'] },
    { key: 'rainBoots', qty: 'rainBootsQty', label: '장화', sizes: ['290', '285', '280', '275', '270', '265', '260', '255', '250'] },
  ];
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('유니폼 사이즈별 수량합');
  worksheet.columns = [
    { header: '품목', key: 'item', width: 20 },
    { header: '사이즈', key: 'size', width: 10 },
    { header: '수량합계', key: 'qtySum', width: 12 }
  ];
  worksheet.getRow(1).font = { bold: true };
  let total = 0;
  fields.forEach(f => {
    let subtotal = 0;
    f.sizes.forEach(size => {
      const qtySum = employees
        .filter(emp => emp[f.key] === size)
        .reduce((sum, emp) => sum + (Number(emp[f.qty]) || 0), 0);
      subtotal += qtySum;
      worksheet.addRow({ item: f.label, size, qtySum });
    });
    worksheet.addRow({}); // 품목별 구분선
    worksheet.addRow({ item: f.label + ' 소계', qtySum: subtotal });
    worksheet.addRow({});
    total += subtotal;
  });
  worksheet.addRow({ item: '전체 합계', qtySum: total });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=uniform_size_qty_sum.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// 유니폼 통계 API (관리자용)
router.get('/stats/api', requireLogin, requireAdmin, async (req, res) => {
  try {
    // 전체 직원 수
    const totalEmployees = await Employee.countDocuments();
    
    // 유니폼 신청 직원 수 (유니폼 정보가 있는 직원)
    const uniformEmployees = await Employee.countDocuments({
      $or: [
        { uniformSummerTop: { $exists: true, $ne: null } },
        { uniformSummerBottom: { $exists: true, $ne: null } },
        { uniformWinterTop: { $exists: true, $ne: null } },
        { uniformWinterBottom: { $exists: true, $ne: null } },
        { uniformWinterPants: { $exists: true, $ne: null } },
        { uniformWinterCoat: { $exists: true, $ne: null } },
        { raincoat: { $exists: true, $ne: null } },
        { cap: { $exists: true, $ne: null } },
        { safetyShoes: { $exists: true, $ne: null } },
        { rainBoots: { $exists: true, $ne: null } },
        { winterJacket: { $exists: true, $ne: null } },
        { doubleJacket: { $exists: true, $ne: null } }
      ]
    });

    // 부서별 총 인원 수
    const departmentTotals = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          totalCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);

    // 부서별 유니폼 신청자 수
    const departmentUniformCounts = await Employee.aggregate([
      {
        $match: {
          $or: [
            { uniformSummerTop: { $exists: true, $ne: null } },
            { uniformSummerBottom: { $exists: true, $ne: null } },
            { uniformWinterTop: { $exists: true, $ne: null } },
            { uniformWinterBottom: { $exists: true, $ne: null } },
            { uniformWinterPants: { $exists: true, $ne: null } },
            { uniformWinterCoat: { $exists: true, $ne: null } },
            { raincoat: { $exists: true, $ne: null } },
            { cap: { $exists: true, $ne: null } },
            { safetyShoes: { $exists: true, $ne: null } },
            { rainBoots: { $exists: true, $ne: null } },
            { winterJacket: { $exists: true, $ne: null } },
            { doubleJacket: { $exists: true, $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: '$department',
          uniformCount: { $sum: 1 }
        }
      }
    ]);

    // 부서별 통계를 객체로 변환 (총 인원 수와 유니폼 신청자 수)
    const departmentStatsObj = {};
    departmentTotals.forEach(dept => {
      const deptName = dept._id || '미지정';
      const uniformCount = departmentUniformCounts.find(d => d._id === dept._id)?.uniformCount || 0;
      departmentStatsObj[deptName] = {
        total: dept.totalCount,
        uniform: uniformCount
      };
    });

    // 유니폼 종류별 현황
    const uniformDetails = {
      '하복 상의': await Employee.countDocuments({ uniformSummerTop: { $exists: true, $ne: null } }),
      '하복 하의': await Employee.countDocuments({ uniformSummerBottom: { $exists: true, $ne: null } }),
      '동복 상의': await Employee.countDocuments({ uniformWinterTop: { $exists: true, $ne: null } }),
      '동복 하의': await Employee.countDocuments({ uniformWinterBottom: { $exists: true, $ne: null } }),
      '방한 하의': await Employee.countDocuments({ uniformWinterPants: { $exists: true, $ne: null } }),
      '방한 외투': await Employee.countDocuments({ uniformWinterCoat: { $exists: true, $ne: null } }),
      '우의': await Employee.countDocuments({ raincoat: { $exists: true, $ne: null } }),
      '모자': await Employee.countDocuments({ cap: { $exists: true, $ne: null } }),
      '안전화': await Employee.countDocuments({ safetyShoes: { $exists: true, $ne: null } }),
      '장화': await Employee.countDocuments({ rainBoots: { $exists: true, $ne: null } }),
      '동점퍼': await Employee.countDocuments({ winterJacket: { $exists: true, $ne: null } }),
      '겹점퍼': await Employee.countDocuments({ doubleJacket: { $exists: true, $ne: null } })
    };

    // 사이즈별 현황
    const sizeDetails = {};
    
    // 하복 상의 사이즈별 현황
    const summerTopSizes = await Employee.aggregate([
      { $match: { uniformSummerTop: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformSummerTop', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['하복 상의'] = summerTopSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 하복 하의 사이즈별 현황
    const summerBottomSizes = await Employee.aggregate([
      { $match: { uniformSummerBottom: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformSummerBottom', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['하복 하의'] = summerBottomSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 동복 상의 사이즈별 현황
    const winterTopSizes = await Employee.aggregate([
      { $match: { uniformWinterTop: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformWinterTop', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['동복 상의'] = winterTopSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 동복 하의 사이즈별 현황
    const winterBottomSizes = await Employee.aggregate([
      { $match: { uniformWinterBottom: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformWinterBottom', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['동복 하의'] = winterBottomSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 방한 하의 사이즈별 현황
    const winterPantsSizes = await Employee.aggregate([
      { $match: { uniformWinterPants: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformWinterPants', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['방한 하의'] = winterPantsSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 방한 외투 사이즈별 현황
    const winterCoatSizes = await Employee.aggregate([
      { $match: { uniformWinterCoat: { $exists: true, $ne: null } } },
      { $group: { _id: '$uniformWinterCoat', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['방한 외투'] = winterCoatSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 우의 사이즈별 현황
    const raincoatSizes = await Employee.aggregate([
      { $match: { raincoat: { $exists: true, $ne: null } } },
      { $group: { _id: '$raincoat', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['우의'] = raincoatSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 모자 사이즈별 현황
    const capSizes = await Employee.aggregate([
      { $match: { cap: { $exists: true, $ne: null } } },
      { $group: { _id: '$cap', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['모자'] = capSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 안전화 사이즈별 현황
    const safetyShoesSizes = await Employee.aggregate([
      { $match: { safetyShoes: { $exists: true, $ne: null } } },
      { $group: { _id: '$safetyShoes', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['안전화'] = safetyShoesSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 장화 사이즈별 현황
    const rainBootsSizes = await Employee.aggregate([
      { $match: { rainBoots: { $exists: true, $ne: null } } },
      { $group: { _id: '$rainBoots', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['장화'] = rainBootsSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 동점퍼 사이즈별 현황
    const winterJacketSizes = await Employee.aggregate([
      { $match: { winterJacket: { $exists: true, $ne: null } } },
      { $group: { _id: '$winterJacket', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['동점퍼'] = winterJacketSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 겹점퍼 사이즈별 현황
    const doubleJacketSizes = await Employee.aggregate([
      { $match: { doubleJacket: { $exists: true, $ne: null } } },
      { $group: { _id: '$doubleJacket', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    sizeDetails['겹점퍼'] = doubleJacketSizes.reduce((acc, size) => {
      acc[size._id] = size.count;
      return acc;
    }, {});

    // 총계 계산
    const totalUniforms = Object.values(uniformDetails).reduce((sum, count) => sum + count, 0);
    
    // 비용 계산 (대략적인 추정치)
    const uniformCosts = {
      '하복 상의': 15000,
      '하복 하의': 12000,
      '동복 상의': 20000,
      '동복 하의': 15000,
      '방한 하의': 18000,
      '방한 외투': 35000,
      '우의': 25000,
      '모자': 8000,
      '안전화': 45000,
      '장화': 15000,
      '동점퍼': 40000,
      '겹점퍼': 50000
    };

    let totalCost = 0;
    Object.entries(uniformDetails).forEach(([type, count]) => {
      if (uniformCosts[type]) {
        totalCost += count * uniformCosts[type];
      }
    });

    const stats = {
      totalEmployees,
      uniformEmployees,
      departmentStats: departmentStatsObj,
      uniformDetails,
      sizeDetails,
      totalUniforms,
      totalCost
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('유니폼 통계 API 오류:', error);
    res.status(500).json({
      success: false,
      message: '통계 데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// 유니폼 정보 조회 (본인)
router.get('/', requireLogin, requireSelfOrAdmin, async (req, res) => {
  // 최신 데이터를 다시 불러와서 확실히 최신 정보를 표시
  const userId = req.session.userId;
  const freshEmployee = await Employee.findOne({ userId });
  
  console.log('유니폼 조회 - 방한하의 정보:', {
    name: freshEmployee.name,
    uniformWinterPants: freshEmployee.uniformWinterPants,
    uniformWinterPantsQty: freshEmployee.uniformWinterPantsQty,
    _id: freshEmployee._id
  });
  
  // 모든 유니폼 필드 확인
  console.log('유니폼 조회 - 모든 필드:', {
    name: freshEmployee.name,
    uniformSummerTop: freshEmployee.uniformSummerTop,
    uniformSummerBottom: freshEmployee.uniformSummerBottom,
    uniformWinterTop: freshEmployee.uniformWinterTop,
    uniformWinterBottom: freshEmployee.uniformWinterBottom,
    uniformWinterPants: freshEmployee.uniformWinterPants,
    springAutumnUniform: freshEmployee.springAutumnUniform,
    uniformWinterCoat: freshEmployee.uniformWinterCoat,
    raincoat: freshEmployee.raincoat,
    cap: freshEmployee.cap,
    safetyShoes: freshEmployee.safetyShoes,
    rainBoots: freshEmployee.rainBoots,
    winterJacket: freshEmployee.winterJacket,
    doubleJacket: freshEmployee.doubleJacket
  });
  
  res.render('uniform', { 
    employee: freshEmployee, 
    session: req.session,
    message: req.session.message 
  });
  delete req.session.message;
});

// 본인(일반 사용자) 유니폼 정보 수정 폼
router.get('/edit', requireLogin, requireSelfOrAdmin, async (req, res) => {
  // 최신 데이터를 다시 불러와서 확실히 최신 정보를 표시
  const userId = req.session.userId;
  const freshEmployee = await Employee.findOne({ userId });
  
  console.log('유니폼 수정 폼 - 방한하의 정보:', {
    name: freshEmployee.name,
    uniformWinterPants: freshEmployee.uniformWinterPants,
    uniformWinterPantsQty: freshEmployee.uniformWinterPantsQty
  });
  
  res.render('editUniform', { employee: freshEmployee, session: req.session });
});

// 유니폼 정보 수정 처리 (본인)
router.post('/edit', requireLogin, requireSelfOrAdmin, async (req, res) => {
  try {
    console.log('본인 유니폼 수정 요청 데이터:', req.body);
  console.log('방한하의 필드 값:', req.body.uniformWinterPants);
  console.log('동복 하의 필드 값:', req.body.uniformWinterBottom);
  console.log('전체 요청 데이터 키들:', Object.keys(req.body));
    
    const fields = [
    'uniformSummerTop', 'uniformSummerBottom',
    'uniformWinterTop', 'uniformWinterBottom', 'uniformWinterPants',
    'uniformWinterCoat', 'raincoat', 'cap', 'safetyShoes', 'rainBoots',
    'winterJacket', 'doubleJacket', 'springAutumnUniform' // '춘추복' 추가
  ];
  const qtyFields = [
    'uniformSummerTopQty', 'uniformSummerBottomQty',
    'uniformWinterTopQty', 'uniformWinterBottomQty', 'uniformWinterPantsQty',
    'uniformWinterCoatQty', 'raincoatQty', 'capQty', 'safetyShoesQty', 'rainBootsQty',
    'winterJacketQty', 'doubleJacketQty', 'springAutumnUniformQty' 
  ];
  // 관리자라면 id로 employee를 찾아서 수정
  let employee = req.employee;
  if (req.session.userRole === 'admin' && req.body.employeeId) {
    employee = await Employee.findById(req.body.employeeId);
    if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  }
  
  console.log('필드별 수정 데이터:');
  fields.forEach(field => {
    const oldValue = employee[field];
    const newValue = req.body[field];
    console.log(`${field}: ${oldValue} -> ${newValue}`);
    employee[field] = newValue;
  });
  

  
  console.log('수량 필드별 수정 데이터:');
  qtyFields.forEach(field => {
    const oldValue = employee[field];
    const newValue = req.body[field];
    console.log(`${field}: ${oldValue} -> ${newValue}`);
    // 수량 필드가 요청에 포함된 경우에만 업데이트
    if (req.body[field] !== undefined) {
      employee[field] = newValue;
    }
  });
    
    // 유니폼 관련 필드만 업데이트 (residentNumber 등 다른 필드는 제외)
    const updateData = {};
    fields.forEach(field => {
      updateData[field] = req.body[field];
    });
    qtyFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 동점퍼/겹점퍼 처리
    const jacketType = req.body.jacketType;
    if (jacketType === 'winterJacket') {
      updateData.winterJacket = req.body.winterJacket;
      updateData.doubleJacket = null;
    } else if (jacketType === 'doubleJacket') {
      updateData.doubleJacket = req.body.doubleJacket;
      updateData.winterJacket = null;
    } else {
      updateData.winterJacket = null;
      updateData.doubleJacket = null;
    }
    
    await Employee.findByIdAndUpdate(employee._id, updateData, { new: true });
    
    console.log('본인 유니폼 수정 완료:', {
      name: employee.name,
      uniformWinterPants: employee.uniformWinterPants,
      uniformWinterPantsQty: employee.uniformWinterPantsQty,
      uniformSummerTop: employee.uniformSummerTop,
      uniformSummerBottom: employee.uniformSummerBottom,
      uniformWinterTop: employee.uniformWinterTop,
      uniformWinterBottom: employee.uniformWinterBottom
    });
    
    // 데이터베이스에서 최신 정보를 다시 불러와서 확인
    const savedEmployee = await Employee.findById(employee._id);
    console.log('저장 후 데이터베이스에서 확인:', {
      name: savedEmployee.name,
      uniformWinterPants: savedEmployee.uniformWinterPants,
      uniformWinterPantsQty: savedEmployee.uniformWinterPantsQty,
      _id: savedEmployee._id
    });
    
    // 전체 유니폼 필드 확인
    console.log('저장 후 전체 유니폼 필드:', {
      name: savedEmployee.name,
      uniformSummerTop: savedEmployee.uniformSummerTop,
      uniformSummerBottom: savedEmployee.uniformSummerBottom,
      uniformWinterTop: savedEmployee.uniformWinterTop,
      uniformWinterBottom: savedEmployee.uniformWinterBottom,
      uniformWinterPants: savedEmployee.uniformWinterPants,
      springAutumnUniform: savedEmployee.springAutumnUniform,
      uniformWinterCoat: savedEmployee.uniformWinterCoat,
      raincoat: savedEmployee.raincoat,
      cap: savedEmployee.cap,
      safetyShoes: savedEmployee.safetyShoes,
      rainBoots: savedEmployee.rainBoots,
      winterJacket: savedEmployee.winterJacket,
      doubleJacket: savedEmployee.doubleJacket
    });
    
    // 성공 메시지와 함께 리다이렉트
    req.session.message = `유니폼 정보가 수정되었습니다.`;
    
    // 유니폼 수정 페이지로 리다이렉트
    if (req.session.userRole === 'admin' && req.body.employeeId) {
      res.redirect('/uniform/' + employee._id + '/edit');
    } else {
      res.redirect('/uniform/' + req.session.userId + '/edit');
    }
  } catch (error) {
    console.error('본인 유니폼 수정 오류:', error);
    res.status(500).send('유니폼 정보 수정 중 오류가 발생했습니다.');
  }
});

// 관리자: 특정 직원 유니폼 정보 조회
router.get('/:id', requireLogin, requireAdmin, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  res.render('uniform', { 
    employee, 
    session: req.session,
    message: req.session.message 
  });
  delete req.session.message;
});

// 관리자: 특정 직원 유니폼 정보 수정 폼
router.get('/:id/edit', requireLogin, requireAdmin, async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
  res.render('editUniform', { employee, session: req.session });
});

// 관리자: 특정 직원 유니폼 정보 수정 처리
router.post('/:id/edit', requireLogin, requireAdmin, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).send('직원을 찾을 수 없습니다.');
    
    console.log('수정 요청 데이터:', req.body);
    console.log('수정 전 직원 데이터:', {
      name: employee.name,
      uniformWinterPants: employee.uniformWinterPants
    });
  const fields = [
    'uniformSummerTop', 'uniformSummerBottom',
    'uniformWinterTop', 'uniformWinterBottom', 'uniformWinterPants',
    'uniformWinterCoat', 'raincoat', 'cap', 'safetyShoes', 'rainBoots',
    'winterJacket', 'doubleJacket', 'springAutumnUniform' // '춘추복' 추가
  ];
  const qtyFields = [
    'uniformSummerTopQty', 'uniformSummerBottomQty',
    'uniformWinterTopQty', 'uniformWinterBottomQty', 'uniformWinterPantsQty',
    'uniformWinterCoatQty', 'raincoatQty', 'capQty', 'safetyShoesQty', 'rainBootsQty',
    'winterJacketQty', 'doubleJacketQty', 'springAutumnUniformQty'
  ];
  console.log('관리자용 필드별 수정 데이터:');
  fields.forEach(field => {
    const oldValue = employee[field];
    const newValue = req.body[field];
    console.log(`${field}: ${oldValue} -> ${newValue}`);
    employee[field] = newValue;
  });
  
  console.log('관리자용 수량 필드별 수정 데이터:');
  qtyFields.forEach(field => {
    const oldValue = employee[field];
    const newValue = req.body[field];
    console.log(`${field}: ${oldValue} -> ${newValue}`);
    // 수량 필드가 요청에 포함된 경우에만 업데이트
    if (req.body[field] !== undefined) {
      employee[field] = newValue;
    }
  });
    
    // 유니폼 관련 필드만 업데이트 (residentNumber 등 다른 필드는 제외)
    const updateData = {};
    fields.forEach(field => {
      updateData[field] = req.body[field];
    });
    qtyFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 동점퍼/겹점퍼 처리
    const jacketType = req.body.jacketType;
    if (jacketType === 'winterJacket') {
      updateData.winterJacket = req.body.winterJacket;
      updateData.doubleJacket = null;
    } else if (jacketType === 'doubleJacket') {
      updateData.doubleJacket = req.body.doubleJacket;
      updateData.winterJacket = null;
    } else {
      updateData.winterJacket = null;
      updateData.doubleJacket = null;
    }
    
    await Employee.findByIdAndUpdate(employee._id, updateData, { new: true });
    
    console.log('수정 후 직원 데이터:', {
      name: employee.name,
      uniformWinterPants: employee.uniformWinterPants,
      uniformSummerTop: employee.uniformSummerTop,
      uniformSummerBottom: employee.uniformSummerBottom,
      uniformWinterTop: employee.uniformWinterTop,
      uniformWinterBottom: employee.uniformWinterBottom
    });
    
    // 성공 메시지와 함께 유니폼 수정 페이지로 리다이렉트
    req.session.message = `${employee.name}의 유니폼 정보가 수정되었습니다.`;
    res.redirect('/uniform/' + employee._id + '/edit');
  } catch (error) {
    console.error('유니폼 수정 오류:', error);
    res.status(500).send('유니폼 정보 수정 중 오류가 발생했습니다.');
  }
});

// 유니폼 엑셀 템플릿 다운로드
router.get('/excel/template', requireLogin, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('유니폼 정보 템플릿');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '이름', key: 'name', width: 15 },
      { header: '부서', key: 'department', width: 15 },
      { header: '직급', key: 'position', width: 15 },
      { header: '상의 사이즈', key: 'topSize', width: 15 },
      { header: '하의 사이즈', key: 'bottomSize', width: 15 },
      { header: '모자 사이즈', key: 'hatSize', width: 15 },
      { header: '신발 사이즈', key: 'shoeSize', width: 15 },
      { header: '장갑 사이즈', key: 'gloveSize', width: 15 },
      { header: '비고', key: 'note', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 샘플 데이터 추가
    const sampleData = [
      {
        name: '홍길동',
        department: '보안1팀',
        position: '보안원',
        topSize: 'L',
        bottomSize: 'L',
        hatSize: 'L',
        shoeSize: '270',
        gloveSize: 'L',
        note: '샘플 데이터'
      },
      {
        name: '김철수',
        department: '보안2팀',
        position: '보안원',
        topSize: 'M',
        bottomSize: 'M',
        hatSize: 'M',
        shoeSize: '260',
        gloveSize: 'M',
        note: '샘플 데이터'
      }
    ];

    sampleData.forEach(data => {
      worksheet.addRow(data);
    });

    // 파일명 설정
    const fileName = `유니폼_템플릿_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('유니폼 템플릿 다운로드 오류:', error);
    res.status(500).json({ success: false, message: '템플릿 다운로드 중 오류가 발생했습니다.' });
  }
});

// 유니폼 데이터 엑셀 내보내기
router.get('/excel/export', requireLogin, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('유니폼 현황');
    
    // 헤더 스타일
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 헤더 설정
    worksheet.columns = [
      { header: '이름', key: 'name', width: 15 },
      { header: '부서', key: 'department', width: 15 },
      { header: '직급', key: 'position', width: 15 },
      { header: '상의 사이즈', key: 'topSize', width: 15 },
      { header: '하의 사이즈', key: 'bottomSize', width: 15 },
      { header: '모자 사이즈', key: 'hatSize', width: 15 },
      { header: '신발 사이즈', key: 'shoeSize', width: 15 },
      { header: '장갑 사이즈', key: 'gloveSize', width: 15 },
      { header: '비고', key: 'note', width: 20 }
    ];

    // 헤더 스타일 적용
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 직원 데이터 추가
    employees.forEach(employee => {
      worksheet.addRow({
        name: employee.name,
        department: employee.department,
        position: employee.position,
        topSize: employee.uniform?.topSize || '',
        bottomSize: employee.uniform?.bottomSize || '',
        hatSize: employee.uniform?.hatSize || '',
        shoeSize: employee.uniform?.shoeSize || '',
        gloveSize: employee.uniform?.gloveSize || '',
        note: employee.uniform?.note || ''
      });
    });

    // 파일명 설정
    const fileName = `유니폼현황_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('유니폼 데이터 내보내기 오류:', error);
    res.status(500).json({ success: false, message: '데이터 내보내기 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 