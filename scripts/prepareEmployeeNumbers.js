/** 현재 DB의 사번 중복을 확인하고 고유 인덱스를 만듭니다. 기존 직원 값은 바꾸지 않습니다. */
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI가 설정되지 않았습니다.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const duplicates = await Employee.aggregate([
      { $match: { empNo: { $gt: '' } } },
      { $group: { _id: '$empNo', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    if (duplicates.length) {
      console.error('중복 사번을 먼저 확인해 주세요:', duplicates);
      process.exitCode = 1;
      return;
    }
    await Employee.collection.createIndex({ empNo: 1 }, {
      name: 'empNo_unique_nonempty',
      unique: true,
      partialFilterExpression: { empNo: { $gt: '' } }
    });
    console.log('중복 사번 없음. 사번 고유 인덱스 준비 완료. 기존 사번은 유지됩니다.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => { console.error('사번 인덱스 준비 실패:', error); process.exitCode = 1; });
