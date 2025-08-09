/**
 * 목적: 프로덕션 초기 관리자 계정 생성 스크립트
 * 실행: node scripts/seedAdmin.js
 * 필요 ENV: MONGODB_URI, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, (선택) ADMIN_NAME
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../models/User');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('에러: MONGODB_URI 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const username = process.env.ADMIN_USERNAME || 'admin';
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const plainPassword = process.env.ADMIN_PASSWORD || 'changeMe!123';
  const name = process.env.ADMIN_NAME || '관리자';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    let admin = await User.findOne({ username });
    if (admin) {
      console.log(`관리자 사용자 '${username}'는 이미 존재합니다. (email: ${admin.email})`);
      return;
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    admin = await User.create({
      username,
      password: hash,
      email,
      role: 'admin',
      profileImage: '',
      name,
    });

    console.log('관리자 사용자 생성 완료:');
    console.log(`- username: ${username}`);
    console.log(`- email:    ${email}`);
  } catch (err) {
    console.error('시드 중 오류:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();



