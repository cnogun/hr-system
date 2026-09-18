const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// 업무용 직원찾기: 민감한 직원 상세정보와 별도로 필요한 항목만 조회합니다.
router.get('/', async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 60) : '';
    const department = typeof req.query.department === 'string' ? req.query.department.trim().slice(0, 60) : '';
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = 20;
    const departments = (await Employee.distinct('department', { status: '재직' }))
      .filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
    const filter = { status: '재직' };
    if (department && departments.includes(department)) filter.department = department;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }
    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .select('name empNo orgType department position')
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Employee.countDocuments(filter)
    ]);
    res.render('directory', {
      employees, departments, search,
      department: departments.includes(department) ? department : '',
      page, totalPages: Math.ceil(total / limit), session: req.session
    });
  } catch (error) {
    console.error('직원찾기 오류:', error);
    res.status(500).send('직원찾기 화면을 불러오는 중 오류가 발생했습니다.');
  }
});

module.exports = router;
