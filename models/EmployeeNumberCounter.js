const mongoose = require('mongoose');

const employeeNumberCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // 발급 연도 (Asia/Seoul)
  sequence: { type: Number, required: true, default: 0 }
});

module.exports = mongoose.model('EmployeeNumberCounter', employeeNumberCounterSchema);
