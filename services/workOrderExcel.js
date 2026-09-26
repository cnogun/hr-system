const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const LOCATION_ALIASES = {
  '물류센터문': ['교육원중문'],
  '선적문': ['선적중문'],
  '5의장문': ['5의장중문'],
  '엔진 4문': ['엔진4문', '엔진4부'],
  '시트 1문': ['시트1문'],
  '시트1주차장문': ['시트1중문', '시트1주차장중문'],
  '시트1주차장초소': ['시트1주차장초소'],
  '시트 3문': ['시트3문'],
  '코일주차장': ['코일주차장'],
  '야적장초소': ['야적장초소']
};
const normalize = value => String(value || '').replace(/\s+/g, '').trim();
const text = value => String(value || '').trim();
const LEADER_LOCATIONS = new Set(['해안입문', '기술교육원문', '시트1문', '엔진4문']);
const hasLeader = location => LEADER_LOCATIONS.has(normalize(location));

function templateBytes(content) {
  // A lean Mongoose query can return a MongoDB Binary object instead of Buffer.
  if (Buffer.isBuffer(content)) return content;
  if (content && typeof content.value === 'function') return templateBytes(content.value());
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (content instanceof ArrayBuffer) return Buffer.from(content);
  if (content && content.buffer) return templateBytes(content.buffer);
  throw new TypeError('저장된 근무명령서 양식의 파일 데이터를 읽을 수 없습니다.');
}

const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function replaceCellValues(original, updates) {
  const zip = await JSZip.loadAsync(templateBytes(original));
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (!sheetFile) throw new Error('양식의 첫 번째 시트를 찾을 수 없습니다.');
  let xml = await sheetFile.async('string');
  for (const [address, rawValue] of updates) {
    const openingMatch = new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*>`).exec(xml);
    if (!openingMatch) throw new Error(`양식에 ${address} 셀이 없습니다.`);
    const opening = openingMatch[0];
    const end = opening.endsWith('/>') ? openingMatch.index + opening.length
      : xml.indexOf('</c>', openingMatch.index + opening.length) + 4;
    if (end < 4) throw new Error(`양식의 ${address} 셀을 읽을 수 없습니다.`);
    const originalCell = xml.slice(openingMatch.index, end);
    if (/<f(?:\s|>)/.test(originalCell)) throw new Error(`양식의 ${address} 셀에는 수식이 있어 덮어쓸 수 없습니다.`);
    const numeric = typeof rawValue === 'number' && Number.isFinite(rawValue);
    const attributes = opening.replace(/^<c\b/, '').replace(/\s*\/?>(?:.*)?$/, '')
      .replace(/\s+t="[^"]*"/g, '');
    const value = rawValue == null ? '' : rawValue;
    const replacement = numeric
      ? `<c${attributes}><v>${value}</v></c>`
      : `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    xml = xml.slice(0, openingMatch.index) + replacement + xml.slice(end);
  }
  // Center the printed sheet and slightly reduce the paper margins, without changing cells.
  const options = '<printOptions horizontalCentered="1" verticalCentered="1"/>';
  const margins = '<pageMargins left="0.18" right="0.18" top="0.23" bottom="0.23" header="0.10" footer="0.10"/>';
  if (/<printOptions\b[^>]*\/>/.test(xml)) xml = xml.replace(/<printOptions\b[^>]*\/>/, options);
  if (/<pageMargins\b[^>]*\/>/.test(xml)) xml = xml.replace(/<pageMargins\b[^>]*\/>/, margins);
  const originalColumns = '<col min="1" max="18" width="4.5" customWidth="1"/>';
  if (xml.includes(originalColumns)) {
    xml = xml.replace(originalColumns, '<col min="1" max="5" width="4.5" customWidth="1"/>' +
      '<col min="6" max="9" width="4.75" customWidth="1"/>' +
      '<col min="10" max="14" width="4.5" customWidth="1"/>' +
      '<col min="15" max="18" width="4.75" customWidth="1"/>');
  }
  for (let row = 17; row <= 34; row++) {
    const pattern = new RegExp(`(<row r="${row}"[^>]*\\bht=")([\\d.]+)(")`);
    if (pattern.test(xml)) {
      xml = xml.replace(pattern, (_, start, height, end) => `${start}${Number(height) + 0.5}${end}`);
    }
  }
  // Increase the older, split-cell form slightly while keeping one printed page.
  if (xml.includes('ref="F18:G18"')) {
    xml = xml.replace(/<pageSetup\b([^>]*?)\/>/, (_, attrs) =>
      `<pageSetup${attrs.replace(/\s+scale="[^"]*"/, '')} scale="102"/>`);
  }
  zip.file('xl/worksheets/sheet1.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function assignmentName(value, region, location) {
  let name = text(value);
  const labels = [region, location, ...(LOCATION_ALIASES[location] || [])]
    .map(label => text(label).replace(/\s+/g, ''))
    .filter(Boolean);
  // Older saved orders sometimes included the template's region and post in each member field.
  // Remove only leading labels; the preprinted template cells already contain them.
  while (name) {
    const compact = name.replace(/\s+/g, '');
    const label = labels.find(candidate => compact.startsWith(candidate));
    if (!label) break;
    let consumed = 0;
    let count = 0;
    while (consumed < name.length && count < label.length) {
      if (!/\s/.test(name[consumed])) count++;
      consumed++;
    }
    name = name.slice(consumed).replace(/^[\s:：,，-]+/, '').trim();
  }
  return name;
}

function assignmentSlots(sheet, firstColumn, row) {
  const slots = new Map();
  for (let r = row; r <= row + 1; r++) {
    for (let col = firstColumn; col < firstColumn + 4; col++) {
      const master = sheet.getRow(r).getCell(col).master;
      if (!slots.has(master.address)) slots.set(master.address, { address: master.address, cell: master, cells: [] });
      slots.get(master.address).cells.push({ row: r, col });
    }
  }
  return [...slots.values()].map(slot => {
    const columns = new Set(slot.cells.map(cell => cell.col)).size;
    const rows = new Set(slot.cells.map(cell => cell.row)).size;
    return { ...slot, capacity: columns >= 4 ? 3
      : slot.cell.alignment?.wrapText && rows >= 2 ? 2 : 1 };
  });
}

function assignmentValues(slots, item, location, region) {
  const leaderSlot = hasLeader(location)
    ? slots.find(slot => /^\s*조\s*장\s*[:：]/.test(String(slot.cell.value || ''))) : null;
  if (hasLeader(location) && !leaderSlot) throw new Error(`${location}의 '조장 :' 셀이 양식에 없습니다.`);
  const dataSlots = slots.filter(slot => slot !== leaderSlot);
  const assignment = item?.assignment || {};
  const leader = hasLeader(location)
    ? assignmentName(assignment.supervisor || assignment.teamLeader, region, location) : '';
  const names = Array.isArray(assignment.members)
    ? assignment.members.map(name => assignmentName(name, region, location)).filter(Boolean) : [];
  const required = names.length + (hasLeader(location) ? 1 : 0);
  const capacity = dataSlots.reduce((total, slot) => total + slot.capacity, 0);
  if (required > capacity) throw new Error(`${location} 편성 칸에는 최대 ${capacity - (hasLeader(location) ? 1 : 0)}명의 근무자와 조장을 인쇄할 수 있습니다. 현재 근무자 ${names.length}명입니다.`);
  const values = new Map();
  if (hasLeader(location)) {
    const slot = dataSlots.shift();
    if (!slot) throw new Error(`${location}의 조장 이름 칸이 양식에 없습니다.`);
    values.set(slot.address, leader || '');
  }
  dataSlots.forEach((slot, index) => {
    const later = dataSlots.slice(index + 1);
    const remainingCapacity = later.reduce((total, next) => total + next.capacity, 0);
    const count = Math.min(slot.capacity, Math.max(names.length - remainingCapacity,
      Math.ceil(names.length / (later.length + 1))));
    const group = names.splice(0, count);
    values.set(slot.address, group.join('   '));
  });
  return values;
}

function shiftDisplay(info) {
  const date = info?.date && new Date(info.date);
  const weekend = date && !Number.isNaN(date.getTime()) && [0, 6].includes(date.getUTCDay());
  const time = info?.workTime || {};
  const raw = text(time.display) || (time.start && time.end
    ? `${text(info.shift)}(${time.start}~${time.end})` : text(info?.shift));
  return raw.replace(/주간특근(?:근무|조)?/g, '주간조')
    .replace(/야간특근(?:근무|조)?/g, '야간조')
    .replace(/주간근무/g, '주간조')
    .replace(/초야근무/g, weekend ? '야간조' : '초야조')
    .replace(/심야근무/g, weekend ? '야간조' : '심야조')
    .replace(/^(주간|초야|심야)(?=\(|$)/, value => ({ 주간: '주간조', 초야: weekend ? '야간조' : '초야조', 심야: weekend ? '야간조' : '심야조' })[value]);
}

function formatDate(info) {
  if (!info || !info.date) return '';
  const date = new Date(info.date);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date);
  const display = shiftDisplay(info);
  return `'${parts.year.slice(-2)}. ${parts.month}. ${parts.day}(${weekday}) ${text(info.team)}   ${display}`;
}

async function getTemplateLocations(templateBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes(templateBuffer));
  const sheet = workbook.getWorksheet('근무명령서') || workbook.worksheets[0];
  if (!sheet || normalize(sheet.getCell('A16').value) !== '지역') {
    throw new Error('근무명령서 양식의 근무편성 표를 찾을 수 없습니다.');
  }
  const sides = [{ location: 'C', region: 'A', assignment: 6 },
    { location: 'L', region: 'J', assignment: 15 }];
  const groups = sides.map(side => {
    let region = '';
    const locations = [];
    for (let row = 17; row <= 34; row += 2) {
      const nextRegion = text(sheet.getCell(`${side.region}${row}`).value).replace(/\s+/g, '');
      if (nextRegion) region = nextRegion;
      const location = text(sheet.getCell(`${side.location}${row}`).value).replace(/\s+/g, '');
      if (location) {
        const slots = assignmentSlots(sheet, side.assignment, row);
        const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
        locations.push({ location, region, memberCount: capacity - (hasLeader(location) ? 2 : 0) });
      }
    }
    return locations;
  });
  const names = groups.flat().map(item => normalize(item.location));
  if (groups.some(group => !group.length) || new Set(names).size !== names.length) {
    throw new Error('양식의 근무지 목록이 비어 있거나 중복되어 있습니다.');
  }
  for (const group of groups) {
    group.forEach((item, index) => {
      if (index > 0 && group[index - 1].region === item.region) return;
      let span = 1;
      while (index + span < group.length && group[index + span].region === item.region) span++;
      item.regionSpan = span;
    });
  }
  return groups;
}

async function validateWorkOrderTemplate(templateBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes(templateBuffer));
  const sheet = workbook.getWorksheet('근무명령서') || workbook.worksheets[0];
  if (!sheet || normalize(sheet.getCell('A2').value) !== '근무명령서' ||
      normalize(sheet.getCell('A9').value) !== '총원' ||
      normalize(sheet.getCell('A16').value) !== '지역') {
    throw new Error('양식의 제목 또는 근무편성 표를 확인해주세요.');
  }
  await getTemplateLocations(templateBuffer);
  const targets = ['G8', 'A10', 'D10', 'G10', 'P10', 'D39', 'D40'];
  for (const [post, data] of [['C', 'F'], ['L', 'O']]) {
    for (let row = 17; row <= 33; row += 2) {
      const location = text(sheet.getCell(`${post}${row}`).value);
      if (!location) continue;
      const slots = assignmentSlots(sheet, sheet.getColumn(data).number, row);
      assignmentValues(slots, null, location, '');
      for (const slot of slots) {
        targets.push(slot.address);
      }
    }
  }
  const zip = await JSZip.loadAsync(templateBytes(templateBuffer));
  const xml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  if (!xml) throw new Error('첫 번째 시트를 읽을 수 없습니다.');
  for (const address of targets) {
    const cell = sheet.getCell(address);
    if (cell.master.address !== address || cell.value?.formula) {
      throw new Error(`${address} 셀은 입력 가능한 병합 셀의 시작 위치여야 합니다.`);
    }
    if (!new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*>`).test(xml)) {
      throw new Error(`${address} 셀이 양식에 없습니다.`);
    }
  }
}

async function fillWorkOrderTemplate(templateBuffer, order) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes(templateBuffer));
  const sheet = workbook.getWorksheet('근무명령서') || workbook.worksheets[0];
  if (!sheet || normalize(sheet.getCell('A2').value) !== '근무명령서' ||
      normalize(sheet.getCell('A9').value) !== '총원' ||
      normalize(sheet.getCell('A16').value) !== '지역') {
    throw new Error('업로드된 엑셀의 근무명령서 양식 구조를 확인해주세요.');
  }

  const updates = new Map();
  const write = (address, value) => updates.set(address, value);
  write('G8', formatDate(order.workInfo));
  const status = order.personnelStatus || {};
  write('A10', status.totalPersonnel);
  write('D10', status.absentPersonnel);
  write('P10', status.currentPersonnel);
  const absent = (status.absentDetails || []).map(item =>
    typeof item === 'string' ? text(item) : [text(item.type), text(item.employeeName)].filter(Boolean).join(': ')
  ).filter(Boolean);
  write('G10', text(status.accidentDetails) || absent.join('\n'));

  const assignments = order.workAssignment || [];
  for (const [locationColumn, assignmentColumn, regionColumn] of [['C', 6, 'A'], ['L', 15, 'J']]) {
    let region = '';
    for (let row = 17; row <= 34; row += 2) {
      region = text(sheet.getCell(`${regionColumn}${row}`).value) || region;
      const location = text(sheet.getCell(`${locationColumn}${row}`).value);
      if (!location) continue;
      const aliases = [location, ...(LOCATION_ALIASES[location] || [])].map(normalize);
      const item = assignments.find(entry => aliases.includes(normalize(entry.location)));
      const slots = assignmentSlots(sheet, assignmentColumn, row);
      const values = assignmentValues(slots, item, location, region);
      for (const slot of slots) {
        if (/^\s*조\s*장\s*[:：]/.test(String(slot.cell.value || ''))) continue;
        write(slot.address, values.get(slot.address) || '');
      }
    }
  }
  const education = order.education || {};
  write('D39', (education.weeklyFocus || []).map(text).filter(Boolean).join('\n'));
  write('D40', (education.content && education.content.length ? education.content : education.generalEducation || [])
    .map(text).filter(Boolean).join('\n'));
  return replaceCellValues(templateBuffer, updates);
}

module.exports = { fillWorkOrderTemplate, getTemplateLocations, validateWorkOrderTemplate, assignmentName, templateBytes, hasLeader, shiftDisplay };
