require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system';
const mode = process.argv[2];

async function createTestEmployees() {
  const operations = [];
  for (let team = 1; team <= 3; team += 1) {
    for (let number = 1; number <= 40; number += 1) {
      const padded = String(number).padStart(2, '0');
      const sundayGroup = `${Math.floor((number - 1) / 10) + 1}조`;
      const weekendGroup = number <= 20 ? 'A조' : 'B조';
      const empNo = `TEST-SEC-${team}-${padded}`;
      operations.push({
        updateOne: {
          filter: { empNo },
          update: {
            $setOnInsert: {
              userId: new mongoose.Types.ObjectId(),
              empNo,
              name: `가명${team}팀-${padded}`,
              email: `test-security-${team}-${padded}@example.invalid`,
              department: `보안${team}팀`,
              team: `보안${team}팀`,
              position: '보안원',
              status: '재직',
              hireDate: new Date('2026-09-01T00:00:00+09:00'),
              weekendAssignment: {
                group: 'none',
                weekendGroup,
                sundayGroup
              },
              attendance: {}
            }
          },
          upsert: true
        }
      });
    }
  }
  const result = await Employee.bulkWrite(operations, { ordered: false });
  console.log(`테스트 직원 준비 완료: 신규 ${result.upsertedCount}명, 기존 ${result.matchedCount}명`);
}

async function removeTestEmployees() {
  const result = await Employee.deleteMany({ empNo: /^TEST-SEC-/ });
  console.log(`테스트 직원 삭제 완료: ${result.deletedCount}명`);
}

async function main() {
  if (!['create', 'remove'].includes(mode)) {
    throw new Error('사용법: node scripts/seedAttendanceTestEmployees.js create 또는 remove');
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_SEED !== 'true') {
    throw new Error('운영 환경에서는 ALLOW_TEST_SEED=true일 때만 실행할 수 있습니다.');
  }
  await mongoose.connect(URI);
  if (mode === 'create') await createTestEmployees();
  else await removeTestEmployees();
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exitCode = 1;
});
