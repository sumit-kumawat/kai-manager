import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');
const SQLITE_FILE = path.join(__dirname, 'kai_manager.sqlite');

// Stable Server Build Identifier Token
const SERVER_BUILD_ID = 'BUILD_V2.0_STABLE';

// Native SQLite Database Connection
const sqliteDb = new DatabaseSync(SQLITE_FILE);

// In-memory active session tokens map: token -> user object
const activeSessions = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Initialize SQLite Schema
function initSqliteTables() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      email TEXT,
      role TEXT,
      branchId TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      studentId TEXT UNIQUE,
      name TEXT,
      firstName TEXT,
      middleName TEXT,
      lastName TEXT,
      gender TEXT,
      dob TEXT,
      belt TEXT,
      parentName TEXT,
      phone TEXT,
      email TEXT,
      emergName TEXT,
      emergPhone TEXT,
      emergRelation TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      govIdType TEXT,
      govIdNumber TEXT,
      avatar TEXT,
      accountStatus TEXT,
      branchId TEXT,
      joinDate TEXT,
      matHours INTEGER,
      monthlyFee REAL,
      lastPaymentDate TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      date TEXT,
      studentId TEXT,
      studentName TEXT,
      branchId TEXT,
      time TEXT,
      status TEXT,
      checkInBy TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS financials (
      id TEXT PRIMARY KEY,
      invoiceId TEXT,
      date TEXT,
      studentId TEXT,
      studentName TEXT,
      branchId TEXT,
      category TEXT,
      amount REAL,
      discount REAL,
      finalPaid REAL,
      paymentMethod TEXT,
      transactionRef TEXT,
      notes TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expenseId TEXT,
      date TEXT,
      category TEXT,
      vendor TEXT,
      description TEXT,
      amount REAL,
      branchId TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS staff_salaries (
      id TEXT PRIMARY KEY,
      invoiceId TEXT,
      staffId TEXT,
      staffName TEXT,
      role TEXT,
      branchId TEXT,
      month TEXT,
      baseSalary REAL,
      bonus REAL,
      deductions REAL,
      paidAmount REAL,
      paymentDate TEXT,
      paymentMethod TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      title TEXT,
      subtitle TEXT,
      timestamp TEXT,
      type TEXT,
      isRead INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pending_admissions (
      id TEXT PRIMARY KEY,
      applicationId TEXT UNIQUE,
      name TEXT,
      firstName TEXT,
      middleName TEXT,
      lastName TEXT,
      email TEXT,
      phone TEXT,
      branchId TEXT,
      gender TEXT,
      dob TEXT,
      belt TEXT,
      membershipPlan TEXT,
      medicalNotes TEXT,
      parentName TEXT,
      emergName TEXT,
      emergPhone TEXT,
      emergRelation TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      govIdType TEXT,
      govIdNumber TEXT,
      avatar TEXT,
      documentsJson TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS belt_exams (
      id TEXT PRIMARY KEY,
      examAppId TEXT UNIQUE,
      studentId TEXT,
      candidateName TEXT,
      dojoBranch TEXT,
      joinDate TEXT,
      matHours INTEGER,
      currentBelt TEXT,
      targetBelt TEXT,
      instructorRec TEXT,
      notes TEXT,
      status TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userJson TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      city TEXT,
      address TEXT,
      phone TEXT,
      status TEXT
    );
  `);

  // Migrate legacy db.json data to SQLite if users table is empty
  const userCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0 && fs.existsSync(DB_FILE)) {
    try {
      console.log('[SQLite DB] Migrating data from db.json into SQLite database...');
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      seedSqliteFromJson(data);
      console.log('[SQLite DB] Migration completed successfully.');
    } catch (e) {
      console.warn('[SQLite DB Migration Warning]', e.message);
    }
  }
}

function seedSqliteFromJson(data) {
  if (data.users && Array.isArray(data.users)) {
    const insertUser = sqliteDb.prepare(`INSERT OR REPLACE INTO users (id, username, password, name, email, role, branchId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.users.forEach(u => insertUser.run(String(u.id || u.username), u.username, u.password, u.name, u.email, u.role, u.branchId || 'HQ', u.status || 'active', u.createdAt || new Date().toISOString()));
  }

  if (data.students && Array.isArray(data.students)) {
    const insertStudent = sqliteDb.prepare(`INSERT OR REPLACE INTO students (id, studentId, name, firstName, middleName, lastName, gender, dob, belt, parentName, phone, email, emergName, emergPhone, emergRelation, address, city, state, pincode, govIdType, govIdNumber, avatar, accountStatus, branchId, joinDate, matHours, monthlyFee, lastPaymentDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.students.forEach(s => insertStudent.run(String(s.id || s.studentId), s.studentId, s.name, s.firstName || '', s.middleName || '', s.lastName || '', s.gender || 'Male', s.dob || '', s.belt || 'White Belt', s.parentName || '', s.phone || '', s.email || '', s.emergName || '', s.emergPhone || '', s.emergRelation || 'Parent / Guardian', s.address || '', s.city || 'Jaipur', s.state || 'Rajasthan', s.pincode || '', s.govIdType || 'Aadhaar Card', s.govIdNumber || '', s.avatar || '', s.accountStatus || 'active', s.branchId || 'HQ', s.joinDate || new Date().toISOString().split('T')[0], s.matHours || 0, s.monthlyFee || 2500, s.lastPaymentDate || '', s.status || 'present', s.createdAt || new Date().toISOString()));
  }

  if (data.financials && Array.isArray(data.financials)) {
    const insertFinancial = sqliteDb.prepare(`INSERT OR REPLACE INTO financials (id, invoiceId, date, studentId, studentName, branchId, category, amount, discount, finalPaid, paymentMethod, transactionRef, notes, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.financials.forEach(f => insertFinancial.run(String(f.id || f.invoiceId), f.invoiceId || f.id, f.date || '', f.studentId || '', f.studentName || '', f.branchId || 'HQ', f.category || 'Tuition Fee', f.amount || 0, f.discount || 0, f.finalPaid || f.amount || 0, f.paymentMethod || 'Cash', f.transactionRef || '', f.notes || '', f.status || 'PAID', f.createdAt || new Date().toISOString()));
  }

  if (data.expenses && Array.isArray(data.expenses)) {
    const insertExp = sqliteDb.prepare(`INSERT OR REPLACE INTO expenses (id, expenseId, date, category, vendor, description, amount, branchId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.expenses.forEach(e => insertExp.run(String(e.id || e.expenseId), e.expenseId || e.id, e.date || '', e.category || 'Equipment', e.vendor || '', e.description || '', e.amount || 0, e.branchId || 'HQ', e.status || 'paid', e.createdAt || new Date().toISOString()));
  }

  if (data.staffSalaries && Array.isArray(data.staffSalaries)) {
    const insertSal = sqliteDb.prepare(`INSERT OR REPLACE INTO staff_salaries (id, invoiceId, staffId, staffName, role, branchId, month, baseSalary, bonus, deductions, paidAmount, paymentDate, paymentMethod, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.staffSalaries.forEach(s => insertSal.run(String(s.id || s.invoiceId), s.invoiceId || s.id, s.staffId || '', s.staffName || '', s.role || 'Staff', s.branchId || 'HQ', s.month || '', s.baseSalary || 0, s.bonus || 0, s.deductions || 0, s.paidAmount || s.amount || 0, s.paymentDate || '', s.paymentMethod || 'Bank Transfer', s.status || 'PAID', s.createdAt || new Date().toISOString()));
  }

  if (data.activityLogs && Array.isArray(data.activityLogs)) {
    const insertLog = sqliteDb.prepare(`INSERT OR REPLACE INTO activity_logs (id, title, subtitle, timestamp, type, isRead) VALUES (?, ?, ?, ?, ?, ?)`);
    data.activityLogs.forEach(l => insertLog.run(String(l.id), l.title, l.subtitle, l.timestamp, l.type || 'system', l.isRead ? 1 : 0));
  }

  if (data.pendingAdmissions && Array.isArray(data.pendingAdmissions)) {
    const insertAdm = sqliteDb.prepare(`INSERT OR REPLACE INTO pending_admissions (id, applicationId, name, firstName, middleName, lastName, email, phone, branchId, gender, dob, belt, membershipPlan, medicalNotes, parentName, emergName, emergPhone, emergRelation, address, city, state, pincode, govIdType, govIdNumber, avatar, documentsJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.pendingAdmissions.forEach(a => insertAdm.run(String(a.id || a.applicationId), a.applicationId, a.name, a.firstName || '', a.middleName || '', a.lastName || '', a.email || '', a.phone || '', a.branchId || 'HQ', a.gender || 'Male', a.dob || '', a.belt || 'White Belt', a.membershipPlan || 'Monthly', a.medicalNotes || '', a.parentName || '', a.emergName || '', a.emergPhone || '', a.emergRelation || 'Parent / Guardian', a.address || '', a.city || 'Jaipur', a.state || 'Rajasthan', a.pincode || '', a.govIdType || 'Aadhaar Card', a.govIdNumber || '', a.avatar || '', JSON.stringify(a.documents || []), a.status || 'pending', a.createdAt || new Date().toISOString()));
  }

  if (data.pendingBeltExams && Array.isArray(data.pendingBeltExams)) {
    const insertExam = sqliteDb.prepare(`INSERT OR REPLACE INTO belt_exams (id, examAppId, studentId, candidateName, dojoBranch, joinDate, matHours, currentBelt, targetBelt, instructorRec, notes, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.pendingBeltExams.forEach(x => insertExam.run(String(x.id || x.examAppId), x.examAppId, x.studentId, x.candidateName, x.dojoBranch || 'HQ', x.joinDate || '', x.matHours || 0, x.currentBelt || 'White Belt', x.targetBelt || 'Yellow Belt', x.instructorRec || '', x.notes || '', x.status || 'pending', x.createdAt || new Date().toISOString()));
  }

  if (data.config) {
    const insertConfig = sqliteDb.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`);
    Object.keys(data.config).forEach(k => {
      insertConfig.run(k, typeof data.config[k] === 'object' ? JSON.stringify(data.config[k]) : String(data.config[k]));
    });
  }

  if (data.branches && Array.isArray(data.branches)) {
    const insertBranch = sqliteDb.prepare(`INSERT OR REPLACE INTO branches (id, name, code, city, address, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    data.branches.forEach(b => insertBranch.run(b.id, b.name, b.code, b.city, b.address, b.phone, b.status || 'active'));
  }
}

function readDbFile() {
  initSqliteTables();

  const users = sqliteDb.prepare('SELECT * FROM users').all();
  const students = sqliteDb.prepare('SELECT * FROM students').all();
  const financials = sqliteDb.prepare('SELECT * FROM financials').all();
  const attendance = sqliteDb.prepare('SELECT * FROM attendance').all();
  const expenses = sqliteDb.prepare('SELECT * FROM expenses').all();
  const staffSalaries = sqliteDb.prepare('SELECT * FROM staff_salaries').all();
  const activityLogs = sqliteDb.prepare('SELECT * FROM activity_logs ORDER BY id DESC').all().map(l => ({ ...l, isRead: Boolean(l.isRead) }));
  const pendingAdmissions = sqliteDb.prepare('SELECT * FROM pending_admissions').all().map(a => ({ ...a, documents: JSON.parse(a.documentsJson || '[]') }));
  const pendingBeltExams = sqliteDb.prepare('SELECT * FROM belt_exams').all();
  const branches = sqliteDb.prepare('SELECT * FROM branches').all();

  const configRows = sqliteDb.prepare('SELECT * FROM config').all();
  const config = {};
  configRows.forEach(r => {
    try {
      config[r.key] = JSON.parse(r.value);
    } catch (e) {
      config[r.key] = r.value === 'true' ? true : r.value === 'false' ? false : r.value;
    }
  });

  const sessionRows = sqliteDb.prepare('SELECT * FROM sessions').all();
  const sessions = sessionRows.map(s => ({ token: s.token, user: JSON.parse(s.userJson || '{}') }));

  return {
    users,
    students,
    financials,
    attendance,
    expenses,
    staffSalaries,
    activityLogs,
    pendingAdmissions,
    pendingBeltExams,
    branches,
    config,
    sessions
  };
}

function writeDbFile(data) {
  initSqliteTables();
  seedSqliteFromJson(data);
}

// Hydrate sessions from SQLite database
function hydrateActiveSessions() {
  activeSessions.clear();
  try {
    initSqliteTables();
    const rows = sqliteDb.prepare('SELECT * FROM sessions').all();
    rows.forEach(r => {
      if (r.token && r.userJson) {
        try {
          const user = JSON.parse(r.userJson);
          activeSessions.set(r.token, user);
        } catch (e) {}
      }
    });
    console.log(`[SQLite Server] Hydrated ${activeSessions.size} active sessions from SQLite database.`);
  } catch (e) {
    console.warn('[SQLite Server] Error hydrating sessions:', e.message);
  }
}

hydrateActiveSessions();

// Global CAPTCHA Store with 15-minute expiration
const captchaStore = new Map();

function generateCaptchaChallenge() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const sum = num1 + num2;
  const token = 'kai_cap_' + Math.random().toString(36).substring(2) + Date.now();
  captchaStore.set(token, { answer: String(sum), createdAt: Date.now() });

  // Cleanup stale captchas
  for (const [k, v] of captchaStore.entries()) {
    if (Date.now() - v.createdAt > 15 * 60 * 1000) captchaStore.delete(k);
  }

  return { token, question: `${num1} + ${num2}` };
}

function verifyCaptcha(token, answer) {
  if (!token || typeof answer === 'undefined') return false;
  const record = captchaStore.get(token);
  if (!record) return false;
  captchaStore.delete(token); // single-use token
  return String(record.answer).trim() === String(answer).trim();
}

// Requirement 1: Server-side Unique Student ID Generator (KAISTD + YYYY + 2-digit auto-increment sequence)
function generateServerStudentId(dbData) {
  const year = new Date().getFullYear();
  const prefix = `KAISTD${year}`;
  let maxSeq = 0;
  const idRegex = new RegExp(`^(?:KAISTD|KAI)${year}(\\d+)$`, 'i');

  (dbData.students || []).forEach(s => {
    if (s.studentId) {
      const match = String(s.studentId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  (dbData.pendingAdmissions || []).forEach(a => {
    if (a.assignedStudentId) {
      const match = String(a.assignedStudentId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(3, '0');
  return `${prefix}${seqStr}`;
}

// Unique Staff ID Generator (KAISTF + YYYY + 2-digit auto-increment sequence)
function generateServerStaffId(dbData) {
  const year = new Date().getFullYear();
  const prefix = `KAISTF${year}`;
  let maxSeq = 0;
  const idRegex = new RegExp(`^KAISTF${year}(\\d+)$`, 'i');

  (dbData.users || []).forEach(u => {
    if (u.staffId) {
      const match = String(u.staffId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = nextSeq < 100 ? String(nextSeq).padStart(2, '0') : String(nextSeq);
  return `${prefix}${seqStr}`;
}

// Requirement 2: Server-side Unique Invoice Number Generator (STUDENT_ID + ALPHABETIC AUTO-INCREMENT: KAISTD202601A, KAISTD202601B...)
function getLetterIndexFromSuffix(suffix) {
  if (!suffix || !/^[A-Z]+$/i.test(suffix)) return -1;
  const s = suffix.toUpperCase();
  let num = 0;
  for (let i = 0; i < s.length; i++) {
    num = num * 26 + (s.charCodeAt(i) - 65 + 1);
  }
  return num - 1;
}

function getLetterSuffixFromIndex(index) {
  if (index < 0) return 'A';
  let num = index + 1;
  let result = '';
  while (num > 0) {
    let remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result || 'A';
}

function generateServerInvoiceNo(studentId, dbData) {
  const cleanId = String(studentId || 'KAISTD202601').trim();
  const existingInvoices = (dbData.financials || []).filter(f => String(f.studentId) === cleanId || String(f.targetId) === cleanId);

  let maxLetterIndex = -1;
  existingInvoices.forEach(inv => {
    const invId = String(inv.id || '');
    if (invId.startsWith(cleanId)) {
      const suffix = invId.substring(cleanId.length);
      const letterIdx = getLetterIndexFromSuffix(suffix);
      if (letterIdx > maxLetterIndex) maxLetterIndex = letterIdx;
    }
  });

  const nextLetterIndex = maxLetterIndex + 1;
  const letterSuffix = getLetterSuffixFromIndex(nextLetterIndex);
  return `${cleanId}${letterSuffix}`;
}

function generateServerStaffInvoiceNo(staffId, dbData) {
  const cleanId = String(staffId || 'KAISTF202601').trim();
  const existingInvoices = (dbData.staffFinancials || dbData.financials || []).filter(f => String(f.staffId) === cleanId || String(f.studentId) === cleanId);

  let maxLetterIndex = -1;
  existingInvoices.forEach(inv => {
    const invId = String(inv.id || '');
    if (invId.startsWith(cleanId)) {
      const suffix = invId.substring(cleanId.length);
      const letterIdx = getLetterIndexFromSuffix(suffix);
      if (letterIdx > maxLetterIndex) maxLetterIndex = letterIdx;
    }
  });

  const nextLetterIndex = maxLetterIndex + 1;
  const letterSuffix = getLetterSuffixFromIndex(nextLetterIndex);
  return `${cleanId}${letterSuffix}`;
}

// PDF Receipt Buffer Generator for Immediate SMTP Email Attachment (Matches Student Profile Receipt Design)
function createPdfReceiptBuffer(invoiceObj) {
  if (!invoiceObj) return Buffer.from('Official Receipt PDF Document');
  const invId = String(invoiceObj.id || invoiceObj.invoiceId || 'KAISTD2026001A');
  const name = String(invoiceObj.studentName || invoiceObj.name || invoiceObj.staffName || 'Athlete / Student');
  const targetId = String(invoiceObj.studentId || invoiceObj.staffId || 'KAISTD2026001');
  const belt = String(invoiceObj.belt || invoiceObj.studentBelt || 'Karate Athlete');
  const origAmount = String(invoiceObj.origAmount || invoiceObj.amount || invoiceObj.salary || '2500');
  const discount = String(invoiceObj.discount || '0');
  const amount = String(invoiceObj.finalPaid || invoiceObj.amount || invoiceObj.salary || '2500');
  const method = String(invoiceObj.paymentMethod || invoiceObj.method || 'Online / Transfer / Cash');
  const dateStr = String(invoiceObj.date || invoiceObj.dueDate || new Date().toISOString().split('T')[0]);
  const phone = String(invoiceObj.phone || invoiceObj.studentPhone || '+91 70409 25257');
  const email = String(invoiceObj.email || invoiceObj.studentEmail || 'info@karateacademyindia.com');

  const pdfText = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 6 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj
6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 1200>> stream
BT
/F1 18 Tf
40 800 TD
(KARATE ACADEMY INDIA) Tj
0 -20 TD
/F2 10 Tf
(Official Mat Portal Fee Payment Receipt) Tj
0 -15 TD
(Tel: +91 70409 25257  |  Email: info@karateacademyindia.com) Tj
0 -30 TD
/F1 12 Tf
(OFFICIAL PAID RECEIPT  -  INVOICE #: ${invId}) Tj
0 -18 TD
/F2 10 Tf
(Date: ${dateStr}) Tj
0 -30 TD
/F1 12 Tf
(BILLED TO ATHLETE:) Tj
0 -18 TD
/F1 11 Tf
(Name: ${name}) Tj
0 -15 TD
/F2 10 Tf
(Student ID: ${targetId}   |   Rank: ${belt}) Tj
0 -15 TD
(Phone: ${phone}   |   Email: ${email}) Tj
0 -35 TD
/F1 12 Tf
(FEE BREAKDOWN & PAYMENT DETAILS:) Tj
0 -20 TD
/F2 10 Tf
(Description: Tuition & Training Mat Dues) Tj
0 -15 TD
(Payment Method: ${method}) Tj
0 -15 TD
(Base Tuition Fee: Rs. ${origAmount}) Tj
0 -15 TD
(Concession / Discount: Rs. ${discount}) Tj
0 -18 TD
/F1 14 Tf
(TOTAL AMOUNT SETTLED: Rs. ${amount}) Tj
0 -30 TD
/F1 11 Tf
(STATUS: OFFICIAL PAID & VERIFIED) Tj
0 -40 TD
/F2 9 Tf
(Thank you for training with Karate Academy India!) Tj
0 -14 TD
(This is an officially generated computerised fee payment receipt.) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000237 00000 n 
0000000305 00000 n 
0000000385 00000 n 
trailer <</Size 7 /Root 1 0 R>>
startxref
1400
%%EOF`;

  return Buffer.from(pdfText, 'utf-8');
}

// PDF Payslip Buffer Generator for Immediate Staff Salary SMTP Email Attachment
function createPdfPayslipBuffer(salaryObj) {
  if (!salaryObj) return Buffer.from('Official Salary Payslip Document');
  const payslipId = String(salaryObj.id || 'PAYSLIP-' + Date.now());
  const name = String(salaryObj.staffName || salaryObj.name || 'Staff Member');
  const staffId = String(salaryObj.staffId || 'KAISTF2026001');
  const role = String(salaryObj.role || salaryObj.designation || 'Staff Instructor');
  const month = String(salaryObj.month || new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
  const amount = String(salaryObj.paidAmount || salaryObj.amount || salaryObj.salary || '0');
  const method = String(salaryObj.paymentMethod || 'Bank Transfer');
  const ref = String(salaryObj.paymentRef || 'N/A');
  const dateStr = String(salaryObj.paymentDate || new Date().toISOString().split('T')[0]);

  const pdfText = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 6 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj
6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 1200>> stream
BT
/F1 18 Tf
40 800 TD
(KARATE ACADEMY INDIA) Tj
0 -20 TD
/F2 10 Tf
(Official Monthly Staff Salary Payslip) Tj
0 -15 TD
(Tel: +91 70409 25257  |  Email: info@karateacademyindia.com) Tj
0 -30 TD
/F1 12 Tf
(CONFIDENTIAL SALARY PAYSLIP  -  PERIOD: ${month}) Tj
0 -18 TD
/F2 10 Tf
(Payslip Ref: ${payslipId}   |   Payment Date: ${dateStr}) Tj
0 -30 TD
/F1 12 Tf
(STAFF MEMBER DETAILS:) Tj
0 -18 TD
/F1 11 Tf
(Name: ${name}) Tj
0 -15 TD
/F2 10 Tf
(Staff ID: ${staffId}   |   Designation: ${role}) Tj
0 -35 TD
/F1 12 Tf
(PAYMENT & SALARY BREAKDOWN:) Tj
0 -20 TD
/F2 10 Tf
(Salary Period: ${month}) Tj
0 -15 TD
(Payment Method: ${method}) Tj
0 -15 TD
(Transaction Ref / UTR: ${ref}) Tj
0 -18 TD
/F1 14 Tf
(NET SALARY PAID: Rs. ${amount}) Tj
0 -30 TD
/F1 11 Tf
(STATUS: PAID & VERIFIED) Tj
0 -40 TD
/F2 9 Tf
(Thank you for your service and dedication to Karate Academy India!) Tj
0 -14 TD
(This is an officially generated computerised salary payslip document.) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000237 00000 n 
0000000305 00000 n 
0000000385 00000 n 
trailer <</Size 7 /Root 1 0 R>>
startxref
1400
%%EOF`;

  return Buffer.from(pdfText, 'utf-8');
}

// PDF Financial Ledger Statement Generator
function createPdfFinancialLedgerBuffer(dbData, filterBranch = 'all') {
  const cfg = dbData.config || {};
  const appTitle = cfg.appTitle || 'KAI Manager';
  const orgName = cfg.receiptHeader || 'KARATE ACADEMY INDIA';
  const phone = cfg.contactPhone || '+91 70409 25257';
  const email = cfg.contactEmail || 'info@karateacademyindia.com';

  let financials = dbData.financials || [];
  let expenses = dbData.expenses || [];
  let salaries = dbData.staffSalaries || [];

  if (filterBranch && filterBranch !== 'all') {
    financials = financials.filter(f => !f.branchId || String(f.branchId) === String(filterBranch));
    expenses = expenses.filter(e => String(e.branchId) === String(filterBranch));
    salaries = salaries.filter(s => String(s.branchId) === String(filterBranch));
  }

  const totalIncome = financials.reduce((sum, f) => sum + (parseInt(f.finalPaid || f.amount || f.finalAmount || 0)), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount || 0)), 0);
  const totalSalaries = salaries.reduce((sum, s) => sum + (parseInt(s.paidAmount || s.amount || 0)), 0);
  const netBalance = totalIncome - totalExpenses - totalSalaries;
  const genDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const pdfText = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 6 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj
6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 1300>> stream
BT
/F1 18 Tf
40 800 TD
(${orgName.toUpperCase()}) Tj
0 -20 TD
/F2 10 Tf
(FINANCIAL LEDGER & AUDIT STATEMENT) Tj
0 -15 TD
(Generated: ${genDate}   |   Branch Scope: ${filterBranch.toUpperCase()}) Tj
0 -15 TD
(Tel: ${phone}   |   Email: ${email}) Tj
0 -30 TD
/F1 12 Tf
(FINANCIAL SUMMARY & BALANCE SHEET:) Tj
0 -20 TD
/F2 10 Tf
(Total Gross Income Received: Rs. ${totalIncome.toLocaleString('en-IN')}) Tj
0 -15 TD
(Total Operational Expenses: Rs. ${totalExpenses.toLocaleString('en-IN')}) Tj
0 -15 TD
(Total Staff Salaries Disbursed: Rs. ${totalSalaries.toLocaleString('en-IN')}) Tj
0 -20 TD
/F1 14 Tf
(NET CLOSING CASH BALANCE: Rs. ${netBalance.toLocaleString('en-IN')}) Tj
0 -30 TD
/F1 12 Tf
(KEY TRANSACTIONS LOG:) Tj
0 -20 TD
/F2 9 Tf
(Ref ID          Type        Recipient / Note            Amount (Rs.)    Status) Tj
0 -15 TD
(--------------------------------------------------------------------------------) Tj
0 -15 TD
${financials.slice(0, 15).map(f => `(${String(f.id || 'N/A').substring(0, 15)}  Income   ${String(f.studentName || 'Student').substring(0, 20)}  Rs.${String(f.finalPaid || f.amount || 0)}  Paid)`).join('\n0 -15 TD\n')}
0 -30 TD
/F1 10 Tf
(END OF STATEMENT - CONFIDENTIAL FINANCIAL REPORT) Tj
0 -14 TD
/F2 9 Tf
(Page 1 of 1 - Computerized Statement Issued by ${appTitle}) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000237 00000 n 
0000000305 00000 n 
0000000385 00000 n 
trailer <</Size 7 /Root 1 0 R>>
startxref
1500
%%EOF`;

  return Buffer.from(pdfText, 'utf-8');
}

// Robust Authenticated SMTP Transporter Helper (Universal support for Gmail, Hostinger, Zoho, Outlook, cPanel, Custom SMTP)
function createSmtpTransporter(smtpConfig) {
  if (!smtpConfig || !smtpConfig.host) return null;
  const rawHost = String(smtpConfig.host).trim();
  const hostLower = rawHost.toLowerCase();
  let port = parseInt(smtpConfig.port || 587);
  let encryption = String(smtpConfig.encryption || 'tls').toLowerCase().trim();

  // Intelligent port & encryption auto-alignment
  if (port === 465) {
    encryption = 'ssl';
  } else if (port === 587 || port === 25 || port === 2525) {
    if (encryption === 'ssl') port = 465;
    else encryption = 'tls';
  }

  const isSecure = (encryption === 'ssl' || port === 465);

  let rawPass = String(smtpConfig.password || '').trim();
  if (!rawPass || rawPass === '••••••••') {
    const dbData = readDbFile();
    rawPass = String(dbData.config?.smtp?.password || '').trim();
  }

  // If it's a 16-character Google App Password with spaces (e.g. "abcd efgh ijkl mnop"), strip spaces
  if ((hostLower.includes('gmail') || hostLower.includes('google')) && rawPass.includes(' ')) {
    rawPass = rawPass.replace(/\s+/g, '');
  }

  const cleanUser = String(smtpConfig.username || '').trim();

  const transportOptions = {
    host: rawHost,
    port: port,
    secure: isSecure,
    auth: {
      user: cleanUser,
      pass: rawPass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  };

  // If using port 587 / TLS, enable STARTTLS requirement
  if (!isSecure && port === 587) {
    transportOptions.requireTLS = true;
  }

  return nodemailer.createTransport(transportOptions);
}

function formatSmtpError(err, host = '', port = '', encryption = '') {
  if (!err) return 'Unknown SMTP mail error';
  const msg = err.message || String(err);
  const hostLower = String(host || '').toLowerCase();
  const isGmail = hostLower.includes('gmail') || hostLower.includes('google');

  if (isGmail && (msg.includes('534-5.7.9') || msg.includes('Application-specific password required') || msg.includes('BadCredentials'))) {
    return 'Gmail / Google Workspace requires an Application-Specific Password. Please generate a 16-character App Password under your Google Account Security settings (myaccount.google.com/apppasswords) and enter it as the SMTP Password.';
  }

  if (msg.includes('535') || msg.includes('authentication failed') || msg.includes('Invalid login') || msg.includes('BadCredentials')) {
    if (isGmail) {
      return 'Gmail Authentication Failed (535): Invalid username or password. If 2-Step Verification is enabled on your Google Account, please generate and use a 16-character Google App Password.';
    }
    return `SMTP Authentication Failed (Code 535): Invalid login credentials for ${host || 'SMTP server'}. Please check your username, password, port (${port || '587/465'}), and encryption mode (${encryption || 'TLS/SSL'}).`;
  }

  if (msg.includes('534')) {
    if (isGmail) {
      return 'Gmail Security Alert (534): Application-specific password required. Please generate a Google App Password.';
    }
    return `SMTP Authentication Required (Code 534): Your email service provider (${host || 'SMTP Server'}) may require an App-Specific Password or special SMTP permissions in your account settings.`;
  }

  if (msg.includes('550') || msg.includes('553') || msg.includes('Relay access denied') || msg.includes('Sender rejected')) {
    return `SMTP Sender Error (Code 550/553): Sender address rejected or relay denied by ${host || 'SMTP server'}. Ensure the 'From Email' matches your authenticated SMTP username.`;
  }

  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ESOCKETTIMEDOUT')) {
    return `Could not connect to SMTP server (${host || 'host'}:${port || 'port'}). Please verify the host server address and ensure port ${port || '587/465'} is open and reachable.`;
  }

  if (msg.includes('self-signed certificate') || msg.includes('CERT_HAS_EXPIRED') || msg.includes('certificate')) {
    return `SSL/TLS Certificate Notice from ${host || 'SMTP server'}: ${msg}`;
  }

  return `SMTP Mail Error: ${msg}`;
}

// Standardized KAI Email Design System (Category-Specific Color Accents & Responsive Layout)
function renderKaiEmailHtml({ title, subtitle, studentName, contentHtml, callToActionUrl, callToActionText, category = 'general' }) {
  const logo = "https://www.karateacademyindia.com/logo.png";

  const categoryAccents = {
    'present': '#16a34a',
    'absent': '#dc2626',
    'paid': '#16a34a',
    'fee': '#16a34a',
    'receipt': '#16a34a',
    'due': '#ea580c',
    'overdue': '#dc2626',
    'advanced_payment': '#0d9488',
    'payslip': '#2563eb',
    'staff_salary': '#2563eb',
    'announcement': '#475569',
    'admission_submitted': '#2563eb',
    'admission_approved': '#16a34a',
    'admission_rejected': '#dc2626',
    'id_card': '#2563eb',
    'general': '#dc2626'
  };

  const accentColor = categoryAccents[String(category).toLowerCase()] || '#dc2626';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #0f172a; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
    .header { background-color: #ffffff; padding: 28px 24px 20px 24px; text-align: center; border-top: 5px solid ${accentColor}; border-bottom: 1px solid #f1f5f9; }
    .header img { height: 48px; margin-bottom: 10px; }
    .header h1 { color: #0f172a; font-size: 19px; margin: 0; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
    .header p { color: ${accentColor}; font-size: 11px; margin: 5px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .body { padding: 28px 24px; }
    .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .content { font-size: 13px; line-height: 1.65; color: #334155; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 18px 0; }
    .table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
    .table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .table td.label { color: #64748b; font-weight: 600; }
    .table td.value { font-weight: 700; text-align: right; color: #0f172a; }
    .badge-paid { background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-block; }
    .badge-due { background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-block; }
    .badge-overdue { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-block; }
    .badge-present { background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-block; }
    .badge-absent { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-block; }
    .cta-btn { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-weight: 800; font-size: 13px; margin-top: 18px; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logo}" alt="KAI Logo"/>
      <h1>KARATE ACADEMY INDIA</h1>
      <p>${subtitle || 'Official Mat Portal Notification'}</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${studentName || 'Athlete / Parent / Staff'},</div>
      <div class="content">
        ${contentHtml}
      </div>
      ${callToActionUrl ? `<div style="text-align: center;"><a href="${callToActionUrl}" class="cta-btn">${callToActionText || 'View Details'}</a></div>` : ''}
    </div>
    <div class="footer">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Karate Academy India</div>
      <div style="color: #64748b; font-size: 11px;">Support: +91 70409 25257 • info@karateacademyindia.com</div>
    </div>
  </div>
</body>
</html>
  `;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@') || !clean.includes('.')) return false;

  const invalidDomains = ['example.com', 'test.com', 'dummy.com', 'placeholder.com', 'domain.com'];
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];

  if (invalidDomains.includes(domain)) return false;
  if (clean.startsWith('applicant_') && clean.endsWith('@example.com')) return false;

  return true;
}

// Centralized Automated Email Dispatcher & Log Manager
async function dispatchAutomatedEmail({
  category = 'general',
  targetEmail,
  targetName,
  subject,
  subtitle = 'Official Mat Portal Notification',
  contentHtml,
  callToActionUrl = '',
  callToActionText = '',
  triggeredBy = 'System Automation',
  preventDuplicateMinutes = 5,
  meta = {}
}) {
  if (!validateEmail(targetEmail)) {
    const dbData = readDbFile();
    dbData.emailLogs = dbData.emailLogs || [];
    const logId = Date.now() + Math.floor(Math.random() * 1000);
    const emailLogEntry = {
      id: logId,
      category,
      recipientEmail: targetEmail || 'N/A',
      recipientName: targetName || 'Recipient',
      subject: subject || 'Notification from Karate Academy India',
      subtitle: subtitle || 'Skipped - Invalid Email',
      contentHtml: contentHtml || '',
      status: 'failed',
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      triggeredBy,
      error: 'Invalid or placeholder recipient email address (example.com/dummy rejected).'
    };
    dbData.emailLogs.unshift(emailLogEntry);
    writeDbFile(dbData);
    return { success: false, error: 'Invalid or dummy recipient email address. Dispatch skipped.', logId };
  }

  const cleanTargetEmail = String(targetEmail).trim().toLowerCase();
  const cleanTargetName = String(targetName || 'Athlete / Parent').trim();
  const dbData = readDbFile();
  dbData.emailLogs = dbData.emailLogs || [];

  // Duplicate suppression check if enabled
  if (preventDuplicateMinutes > 0) {
    const cutoffTime = Date.now() - (preventDuplicateMinutes * 60 * 1000);
    const existingRecent = dbData.emailLogs.find(log =>
      log.recipientEmail === cleanTargetEmail &&
      log.category === category &&
      log.status === 'sent' &&
      ((meta.studentId && meta.date && String(log.meta?.studentId) === String(meta.studentId) && String(log.meta?.date) === String(meta.date)) ||
       (log.subject === subject && log.id > cutoffTime))
    );
    if (existingRecent) {
      return { success: true, message: 'Notification already dispatched for this session/event (duplicate suppressed).', logId: existingRecent.id, duplicate: true };
    }
  }

  const logId = Date.now() + Math.floor(Math.random() * 1000);
  const formattedDate = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  const smtpConfig = dbData.config?.smtp;

  const emailLogEntry = {
    id: logId,
    category,
    recipientEmail: cleanTargetEmail,
    recipientName: cleanTargetName,
    subject: subject || 'Notification from Karate Academy India',
    subtitle,
    contentHtml,
    callToActionUrl,
    callToActionText,
    status: 'pending',
    timestamp: formattedDate,
    triggeredBy,
    retryCount: 0,
    error: null,
    meta
  };

  dbData.emailLogs.unshift(emailLogEntry);
  if (dbData.emailLogs.length > 500) {
    dbData.emailLogs = dbData.emailLogs.slice(0, 500);
  }
  writeDbFile(dbData);

  if (!smtpConfig || !smtpConfig.host) {
    emailLogEntry.status = 'failed';
    emailLogEntry.error = 'SMTP server is not configured in Admin settings.';
    writeDbFile(dbData);
    return { success: false, error: emailLogEntry.error, logId };
  }

  try {
    const transporter = createSmtpTransporter(smtpConfig);
    if (!transporter) {
      throw new Error('Could not create SMTP transporter.');
    }

    const htmlBody = renderKaiEmailHtml({
      title: subject,
      subtitle,
      studentName: cleanTargetName,
      contentHtml,
      callToActionUrl,
      callToActionText,
      category
    });

    let attachments = [];
    if (meta && (meta.salaryObj || category === 'payslip' || category === 'staff_salary')) {
      const salObj = meta.salaryObj || meta.salaryData || { id: 'PAYSLIP-' + Date.now(), staffName: cleanTargetName, paidAmount: meta.amount || 0 };
      const pdfBuf = createPdfPayslipBuffer(salObj);
      const filename = `${salObj.id || 'Payslip'}_Payslip.pdf`;
      attachments.push({
        filename: filename,
        content: pdfBuf,
        contentType: 'application/pdf'
      });
    } else if (meta && (meta.invoiceObj || meta.invoiceData || category === 'receipt' || category === 'admission_approved' || category === 'id_card' || category === 'due' || category === 'overdue' || category === 'fee')) {
      const invObj = meta.invoiceObj || meta.invoiceData || { id: meta.invoiceId || 'KAISTD2026001A', studentName: cleanTargetName, finalPaid: meta.amount || 2500 };
      const pdfBuf = createPdfReceiptBuffer(invObj);
      const filename = `${invObj.id || 'Receipt'}_Receipt.pdf`;
      attachments.push({
        filename: filename,
        content: pdfBuf,
        contentType: 'application/pdf'
      });
    }

    const mailOptions = {
      from: `"${smtpConfig.fromName || 'Karate Academy India'}" <${smtpConfig.fromEmail || smtpConfig.username}>`,
      to: cleanTargetEmail,
      replyTo: smtpConfig.replyTo || smtpConfig.fromEmail || smtpConfig.username,
      subject,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined
    };

    await transporter.sendMail(mailOptions);

    emailLogEntry.status = 'sent';
    emailLogEntry.error = null;
    writeDbFile(dbData);

    return { success: true, message: `Email dispatched successfully to ${cleanTargetEmail}`, logId };
  } catch (err) {
    const formattedErr = formatSmtpError(err, smtpConfig?.host, smtpConfig?.port, smtpConfig?.encryption);
    emailLogEntry.status = 'failed';
    emailLogEntry.error = formattedErr;
    writeDbFile(dbData);
    return { success: false, error: formattedErr, logId };
  }
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API Endpoints
  if (req.url.startsWith('/api/')) {
    // 0. Auth Logout Endpoint
    if (req.url === '/api/logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        activeSessions.delete(token);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Session logged out and server token invalidated' }));
      return;
    }

    // 1. Auth Login Endpoint
    if (req.url === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body);
          const cleanUser = String(username || '').trim();
          const cleanPass = String(password || '').trim();

          const dbData = readDbFile();
          const usersList = dbData.users || [];

          console.log('[Server] Login attempt for:', cleanUser);

          // Find matching user in db.json
          let foundUser = usersList.find(u => {
            if (!u || u.status === 'disabled') return false;
            const uName = (u.username || '').toLowerCase();
            const uEmail = (u.email || '').toLowerCase();
            const target = cleanUser.toLowerCase();

            const isMatch = (uName === target) || (uEmail === target);
            return isMatch && u.password === cleanPass;
          });

          // Fallback: Check role-based default credentials
          if (!foundUser) {
            const lowerUser = cleanUser.toLowerCase();
            const defaultUsers = {
              'admin': { role: 'admin', name: 'KAI Administrator', pass: 'admin' },
              'manager': { role: 'manager', name: 'KAI Manager', pass: '123' },
              'receptionist': { role: 'receptionist', name: 'KAI Receptionist', pass: '123' },
              'viewer': { role: 'viewer', name: 'KAI Portal Viewer', pass: '123' }
            };

            const defaultUser = defaultUsers[lowerUser];
            if (defaultUser && cleanPass === defaultUser.pass) {
              // Check if user exists in db
              foundUser = usersList.find(u => u.role === defaultUser.role);
              if (!foundUser) {
                // Create user if it doesn't exist
                const newUser = {
                  id: Date.now(),
                  username: lowerUser,
                  password: defaultUser.pass,
                  name: defaultUser.name,
                  email: `${lowerUser}@karateacademyindia.com`,
                  role: defaultUser.role,
                  status: 'active'
                };
                dbData.users.push(newUser);
                writeDbFile(dbData);
                foundUser = newUser;
                console.log('[Server] Created default user:', lowerUser);
              } else {
                // Ensure password matches default
                if (foundUser.password !== defaultUser.pass) {
                  foundUser.password = defaultUser.pass;
                  writeDbFile(dbData);
                }
              }
            }
          }

          if (foundUser) {
            const token = 'kai_sec_token_' + Math.random().toString(36).substring(2) + Date.now();
            const sessionUser = {
              name: foundUser.name || 'User',
              username: foundUser.username,
              email: foundUser.email || '',
              role: (foundUser.role || 'viewer').toLowerCase()
            };

            activeSessions.set(token, sessionUser);

            // Persist session to SQLite database
            try {
              sqliteDb.prepare(`INSERT OR REPLACE INTO sessions (token, userJson, createdAt) VALUES (?, ?, ?)`).run(token, JSON.stringify(sessionUser), new Date().toISOString());
            } catch (e) {
              console.warn('[SQLite Session Insert Warning]', e.message);
            }

            console.log('[SQLite Server] Login successful for:', sessionUser.username, 'role:', sessionUser.role);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              token: token,
              user: sessionUser,
              buildId: SERVER_BUILD_ID
            }));
          } else {
            console.log('[Server] Login failed for:', cleanUser);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid username or password' }));
          }
        } catch (e) {
          console.error('[Server] Login error:', e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    // 1b. Version & Build Token Endpoint (`/api/version`)
    if (req.url === '/api/version' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, buildId: SERVER_BUILD_ID, version: '2.1.0' }));
      return;
    }

    // 2. Session Verification Endpoint (`/api/verify-session`)
    if (req.url === '/api/verify-session' && (req.method === 'GET' || req.method === 'POST')) {
      const authHeader = req.headers['authorization'] || '';
      let token = authHeader.replace('Bearer ', '').trim();

      if (!token && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            token = parsed.token || '';
            verifyAndRespondSession(token, res);
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: false, error: 'Invalid request' }));
          }
        });
        return;
      }

      verifyAndRespondSession(token, res);
      return;
    }

    function verifyAndRespondSession(token, responseObj) {
      if (!token) {
        responseObj.writeHead(401, { 'Content-Type': 'application/json' });
        responseObj.end(JSON.stringify({ valid: false, error: 'No session token provided' }));
        return;
      }

      let sessionUser = activeSessions.get(token);
      if (!sessionUser) {
        // Fallback: check db.json sessions
        const dbData = readDbFile();
        const found = (dbData.sessions || []).find(s => s.token === token);
        if (found && found.user) {
          sessionUser = found.user;
          activeSessions.set(token, sessionUser);
        }
      }

      if (sessionUser) {
        responseObj.writeHead(200, { 'Content-Type': 'application/json' });
        responseObj.end(JSON.stringify({
          valid: true,
          user: sessionUser
        }));
      } else {
        responseObj.writeHead(401, { 'Content-Type': 'application/json' });
        responseObj.end(JSON.stringify({ valid: false, error: 'Session expired or invalid' }));
      }
    }

    // Auth Middleware helper
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    let sessionUser = activeSessions.get(token);
    if (!sessionUser && token) {
      const dbData = readDbFile();
      const found = (dbData.sessions || []).find(s => s.token === token);
      if (found && found.user) {
        sessionUser = found.user;
        activeSessions.set(token, sessionUser);
      }
    }

    // 3. Protected Database GET (Masks SMTP Password & Hides Root Admin for Non-Admins)
    if (req.url === '/api/db' && req.method === 'GET') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized. Please login.' }));
        return;
      }

      try {
        const dbObj = JSON.parse(JSON.stringify(readDbFile()));

        // Mask SMTP password for non-admin roles
        if (sessionUser.role !== 'admin' && dbObj.config && dbObj.config.smtp) {
          if (dbObj.config.smtp.password) {
            dbObj.config.smtp.password = '••••••••';
          }
        }

        // Hide Root Admin for Non-Admins
        if (sessionUser.role !== 'admin' && Array.isArray(dbObj.users)) {
          dbObj.users = dbObj.users.filter(u => u.username !== 'admin' && u.role !== 'admin');
        }

        // Sort data for clean presentation
        if (Array.isArray(dbObj.students)) {
          dbObj.students.sort((a, b) => (b.studentId || '').localeCompare(a.studentId || ''));
        }
        if (Array.isArray(dbObj.financials)) {
          dbObj.financials.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));
        }
        if (Array.isArray(dbObj.activityLogs)) {
          dbObj.activityLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        }

        dbObj.buildId = SERVER_BUILD_ID;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dbObj));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process database data: ' + e.message }));
      }
      return;
    }

    // 4. Protected Database POST (Strict RBAC Enforcement)
    if (req.url === '/api/db' && req.method === 'POST') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized. Access restricted.' }));
        return;
      }

      if (sessionUser.role === 'viewer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Viewer role is read-only.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const currentDb = readDbFile();

          // Enforce Receptionist restrictions on server-side DB save
          if (sessionUser.role === 'receptionist') {
            currentDb.attendance = parsed.attendance || currentDb.attendance;
            if (parsed.students && Array.isArray(parsed.students)) {
              currentDb.students.forEach(existingStudent => {
                const updated = parsed.students.find(s => String(s.id) === String(existingStudent.id));
                if (updated && typeof updated.matHours !== 'undefined') {
                  existingStudent.matHours = updated.matHours;
                }
              });
            }
            writeDbFile(currentDb);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Attendance state synchronized' }));
            return;
          }

          // Preserve SMTP password if non-admin is posting db with masked password
          if (sessionUser.role !== 'admin' && parsed.config && parsed.config.smtp && parsed.config.smtp.password === '••••••••') {
            if (currentDb.config && currentDb.config.smtp) {
              parsed.config.smtp.password = currentDb.config.smtp.password;
            }
          }

          // Preserve root admin user if non-admin posts database
          if (sessionUser.role !== 'admin' && Array.isArray(parsed.users)) {
            const rootAdmin = currentDb.users.find(u => u.username === 'admin');
            if (rootAdmin && !parsed.users.some(u => u.username === 'admin')) {
              parsed.users.unshift(rootAdmin);
            }
          }

          writeDbFile(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Database saved' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // 5. Admin SMTP Config Endpoint (`/api/admin/smtp-config`)
    if (req.url === '/api/admin/smtp-config' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Admin can configure SMTP.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const smtpConfig = JSON.parse(body);
          const dbData = readDbFile();
          dbData.config = dbData.config || {};
          dbData.config.smtp = smtpConfig;

          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: 'SMTP Configuration Updated',
            subtitle: `Host: ${smtpConfig.host}:${smtpConfig.port} (${smtpConfig.encryption})`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'system'
          });

          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'SMTP settings updated successfully.'
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    // 6. Admin Send Test Email Endpoint (`/api/admin/test-email`)
    if (req.url === '/api/admin/test-email' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Admin can test SMTP.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        let host = '';
        let port = '587';
        let encryption = 'tls';
        try {
          const parsed = JSON.parse(body);
          host = parsed.host || '';
          port = parsed.port || '587';
          encryption = parsed.encryption || 'tls';
          const { testEmail, username, password, fromName, fromEmail } = parsed;

          let rawPass = String(password || '').trim();
          if (!rawPass || rawPass === '••••••••') {
            const dbData = readDbFile();
            rawPass = String(dbData.config?.smtp?.password || '').trim();
          }

          const smtpObj = { host, port, encryption, username, password: rawPass, fromName, fromEmail };
          const transporter = createSmtpTransporter(smtpObj);

          if (!transporter) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Incomplete SMTP configuration details.' }));
            return;
          }

          const mailOptions = {
            from: `"${fromName || 'KAI Admin'}" <${fromEmail || username}>`,
            to: testEmail || sessionUser.email || 'info@karateacademyindia.com',
            subject: 'Karate Academy India - SMTP Configuration Test',
            html: renderKaiEmailHtml({
              title: 'SMTP Connection Verified',
              subtitle: 'System Configuration Test',
              studentName: 'Administrator',
              contentHtml: `<p>Your SMTP mail configuration for <strong>Karate Academy India Portal</strong> has been verified successfully!</p>
                <div class="card">
                  <table class="table">
                    <tr><td class="label">SMTP Host:</td><td class="value">${host}:${port}</td></tr>
                    <tr><td class="label">Encryption:</td><td class="value">${(encryption || 'TLS').toUpperCase()}</td></tr>
                    <tr><td class="label">Sender Address:</td><td class="value">${fromEmail || username}</td></tr>
                    <tr><td class="label">Status:</td><td class="value"><span class="badge-paid">ACTIVE</span></td></tr>
                  </table>
                </div>`
            })
          };

          await transporter.sendMail(mailOptions);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Test email sent successfully to ${mailOptions.to}`
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: formatSmtpError(err, host, port, encryption) }));
        }
      });
      return;
    }

    // 7. Generic Send Email Endpoint (`/api/send-email`) for Admin, Manager & Receptionist
    if (req.url === '/api/send-email' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager' && sessionUser.role !== 'receptionist')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only authorized staff can send emails.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { category, targetEmail, targetName, customSubject, customBody, invoiceData, studentData } = JSON.parse(body);

          let subject = customSubject || `Notification from Karate Academy India`;
          let htmlBody = `<p>${customBody || 'You have received an update from Karate Academy India.'}</p>`;
          let subtitle = 'Official Portal Notification';

          if (category === 'receipt' && invoiceData) {
            subject = customSubject || `Official Fee Payment Receipt #${invoiceData.id} - Karate Academy India`;
            subtitle = 'Official Fee Receipt';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>Thank you for training with <strong>Karate Academy India</strong>. Your tuition fee payment has been successfully received and recorded.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Invoice / Receipt #:</td><td class="value">${invoiceData.id}</td></tr>
                  <tr><td class="label">Student Name:</td><td class="value">${invoiceData.studentName} (${invoiceData.studentId || ''})</td></tr>
                  <tr><td class="label">Payment Date:</td><td class="value">${invoiceData.dueDate || new Date().toLocaleDateString('en-IN')}</td></tr>
                  <tr><td class="label">Payment Method:</td><td class="value">${invoiceData.paymentMethod || 'UPI / Cash'}</td></tr>
                  <tr><td class="label">Membership Period:</td><td class="value">${invoiceData.startDate || 'Current'} to ${invoiceData.endDate || 'Next Renewal'}</td></tr>
                  <tr><td class="label">Amount Paid:</td><td class="value"><span class="badge-paid">₹${(invoiceData.finalPaid || invoiceData.amount || 0).toLocaleString('en-IN')}</span></td></tr>
                </table>
              </div>
              <p>Please keep this receipt for your records.</p>
            `;
          } else if (category === 'due') {
            subject = customSubject || `Upcoming Tuition Fee Payment Due - Karate Academy India`;
            subtitle = 'Fee Payment Notice';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>This is a polite reminder that your monthly tuition fee is upcoming.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Due Amount:</td><td class="value"><span class="badge-due">₹${(invoiceData?.amount || 2500).toLocaleString('en-IN')}</span></td></tr>
                  <tr><td class="label">Due Date:</td><td class="value">${invoiceData?.nextDueDate || 'Upcoming'}</td></tr>
                </table>
              </div>
              <p>Please complete your payment on or before the due date to ensure uninterrupted training access.</p>
            `;
          } else if (category === 'overdue') {
            subject = customSubject || `URGENT: Fee Payment Overdue Notice - Karate Academy India`;
            subtitle = 'Overdue Alert';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>Our records indicate that your tuition fee payment is currently <strong>OVERDUE</strong>.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Outstanding Amount:</td><td class="value"><span class="badge-overdue">₹${(invoiceData?.amount || 2500).toLocaleString('en-IN')}</span></td></tr>
                  <tr><td class="label">Status:</td><td class="value"><span class="badge-overdue">OVERDUE</span></td></tr>
                </table>
              </div>
              <p>Please settle the outstanding balance immediately at reception or via UPI to maintain active membership status.</p>
            `;
          } else if (category === 'id_card') {
            subject = customSubject || `Official Digital ID Card & Mat Pass - Karate Academy India`;
            subtitle = 'Digital ID Card Delivery';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>Here is your official <strong>Karate Academy India</strong> Digital ID Card and Mat Access Pass.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Student ID:</td><td class="value"><span class="badge-paid">${studentData?.studentId || 'KAI Student'}</span></td></tr>
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Belt Rank:</td><td class="value">${studentData?.belt || 'White Belt'}</td></tr>
                  <tr><td class="label">Account Status:</td><td class="value"><span class="badge-paid">ACTIVE</span></td></tr>
                </table>
              </div>
              <p>You can use your Student ID for QR attendance check-in at the dojo kiosk.</p>
            `;
          } else if (category === 'attendance_present') {
            subject = customSubject || `Attendance Confirmation: Present on Mat - Karate Academy India`;
            subtitle = 'Mat Attendance Alert';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>This is to confirm that <strong>${targetName}</strong> has safely checked in and is <strong>PRESENT</strong> for today's karate training session.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Check-In Date:</td><td class="value">${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
                  <tr><td class="label">Check-In Time:</td><td class="value">${new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })}</td></tr>
                  <tr><td class="label">Status:</td><td class="value"><span class="badge-paid">PRESENT</span></td></tr>
                </table>
              </div>
            `;
          } else if (category === 'attendance_absent') {
            subject = customSubject || `Attendance Notice: Absent from Session - Karate Academy India`;
            subtitle = 'Mat Absence Notice';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>This is a notification that <strong>${targetName}</strong> was marked <strong>ABSENT</strong> for today's scheduled training session (${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}).</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Date:</td><td class="value">${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
                  <tr><td class="label">Status:</td><td class="value"><span class="badge-overdue">ABSENT</span></td></tr>
                </table>
              </div>
              <p>If this was due to illness or personal reasons, please let our reception team know.</p>
            `;
          } else if (category === 'belt_exam') {
            subject = customSubject || `Belt Promotion Evaluation Notice - Karate Academy India`;
            subtitle = 'Belt Grading & Assessment';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>Congratulations! <strong>${targetName}</strong> has been selected as an eligible candidate for the upcoming Belt Promotion Evaluation.</p>
              <p>Please ensure all syllabus forms (Kihon, Kata, and Kumite) are practiced thoroughly prior to the assessment day.</p>
            `;
          } else if (category === 'inquiry') {
            subject = customSubject || `Welcome to Karate Academy India - Program Information`;
            subtitle = 'Inquiry & Trial Class Information';
            htmlBody = customBody ? `<p>${customBody}</p>` : `
              <p>Thank you for your interest in Karate Academy India!</p>
              <p>We offer traditional martial arts training, physical fitness, discipline, and self-defense for all age groups.</p>
              <p>We look forward to welcoming you on the tatami mat for your trial session.</p>
            `;
          } else if (category === 'announcement' || category === 'custom') {
            subject = customSubject || `Official Academy Announcement - Karate Academy India`;
            subtitle = 'Academy Announcement';
            htmlBody = customBody ? `<p>${customBody}</p>` : `<p>Please take note of the latest official announcement from the academy administration.</p>`;
          }

          const result = await dispatchAutomatedEmail({
            category,
            targetEmail,
            targetName,
            subject,
            subtitle,
            contentHtml: htmlBody,
            triggeredBy: `${sessionUser.name} (${sessionUser.username})`,
            preventDuplicateMinutes: 0,
            meta: { invoiceData, studentData }
          });

          // Log in activity logs
          const dbData = readDbFile();
          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `Email Dispatched (${category.toUpperCase()})`,
            subtitle: `Sent to ${targetEmail} by ${sessionUser.name} (${result.success ? 'Delivered' : 'Failed'})`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'system'
          });
          writeDbFile(dbData);

          if (result.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: result.message || `Email dispatched successfully to ${targetEmail}`, logId: result.logId }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error || 'Failed to dispatch email.' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7.1 Email History & Logs API Endpoint (`/api/emails/logs`)
    if (req.url === '/api/emails/logs' && req.method === 'GET') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      const dbData = readDbFile();
      const logs = dbData.emailLogs || [];
      const total = logs.length;
      const sent = logs.filter(l => l.status === 'sent').length;
      const failed = logs.filter(l => l.status === 'failed').length;
      const pending = logs.filter(l => l.status === 'pending').length;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        logs: logs.slice(0, 200),
        stats: { total, sent, failed, pending }
      }));
      return;
    }

    // 7.2 Email Retry Endpoint (`/api/emails/retry`)
    if (req.url === '/api/emails/retry' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Manager or Admin can retry email dispatch.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { logId } = JSON.parse(body);
          const dbData = readDbFile();
          const logEntry = (dbData.emailLogs || []).find(l => String(l.id) === String(logId));

          if (!logEntry) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Email log record not found.' }));
            return;
          }

          logEntry.retryCount = (logEntry.retryCount || 0) + 1;
          logEntry.status = 'pending';
          writeDbFile(dbData);

          const result = await dispatchAutomatedEmail({
            category: logEntry.category,
            targetEmail: logEntry.recipientEmail,
            targetName: logEntry.recipientName,
            subject: logEntry.subject,
            subtitle: logEntry.subtitle,
            contentHtml: logEntry.contentHtml,
            callToActionUrl: logEntry.callToActionUrl,
            callToActionText: logEntry.callToActionText,
            triggeredBy: `Retry by ${sessionUser.name}`,
            preventDuplicateMinutes: 0,
            meta: logEntry.meta || {}
          });

          if (result.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Email retry successful to ${logEntry.recipientEmail}` }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error || 'Retry attempt failed.' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7.3 Email Clear Logs Endpoint (`/api/emails/clear-logs`)
    if (req.url === '/api/emails/clear-logs' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Root Admin can clear email logs.' }));
        return;
      }

      const dbData = readDbFile();
      dbData.emailLogs = [];
      writeDbFile(dbData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Email logs cleared successfully.' }));
      return;
    }

    // 7.4 Automated ID Card Email Endpoint (`/api/students/idcard-email`)
    if (req.url === '/api/students/idcard-email' && req.method === 'POST') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { studentId, targetEmail, targetName, belt } = JSON.parse(body);
          const result = await dispatchAutomatedEmail({
            category: 'id_card',
            targetEmail,
            targetName: targetName || 'Student Athlete',
            subject: `Official Digital ID Card & Mat Pass (${studentId}) - Karate Academy India`,
            subtitle: 'Digital ID Card Delivery',
            contentHtml: `
              <p>Welcome to <strong>Karate Academy India</strong>! Your official student registration is complete and your Digital Mat Pass is now active.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Student ID:</td><td class="value"><span class="badge-paid">${studentId}</span></td></tr>
                  <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                  <tr><td class="label">Belt Rank:</td><td class="value">${belt || 'White Belt'}</td></tr>
                  <tr><td class="label">Status:</td><td class="value"><span class="badge-paid">ACTIVE</span></td></tr>
                </table>
              </div>
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Scan your Student ID or QR Pass at the reception kiosk on each mat session.</li>
                <li>Ensure your Karate Gi (uniform) and protective gear are prepared for training.</li>
              </ul>
            `,
            triggeredBy: `${sessionUser.name} (${sessionUser.username})`,
            preventDuplicateMinutes: 1,
            meta: { studentId, belt }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7.5 Automated Attendance Notification Endpoint (`/api/attendance/notify`)
    if (req.url === '/api/attendance/notify' && req.method === 'POST') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { studentId, studentName, studentEmail, status, date, time } = JSON.parse(body);
          const dbData = readDbFile();

          const foundStudent = (dbData.students || []).find(s => String(s.studentId) === String(studentId) || String(s.id) === String(studentId));
          const targetName = studentName || foundStudent?.name || 'Athlete';
          const primaryEmail = (studentEmail || foundStudent?.contactEmail || foundStudent?.contact?.email || foundStudent?.email || '').trim();

          // Missing Primary Email handling (Requirement 9)
          if (!primaryEmail || !primaryEmail.includes('@')) {
            const isPresent = status === 'present';
            const logEntry = {
              id: Date.now(),
              category: isPresent ? 'attendance_present' : 'attendance_absent',
              recipientEmail: 'N/A',
              recipientName: targetName,
              subject: `Attendance Notification (Skipped - Missing Primary Email)`,
              subtitle: 'Skipped - Missing Primary Email',
              contentHtml: `<p>Attendance marked as <strong>${status.toUpperCase()}</strong> for ${targetName} (${studentId}) on ${date}, but no valid primary email was configured.</p>`,
              status: 'failed',
              timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
              triggeredBy: `Attendance Engine (${sessionUser.username})`,
              error: 'No primary communication email registered for student.',
              meta: { studentId, status, date }
            };
            dbData.emailLogs = dbData.emailLogs || [];
            dbData.emailLogs.unshift(logEntry);
            writeDbFile(dbData);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, note: 'No primary communication email address registered for student. Logged in email audit trail.', logId: logEntry.id }));
            return;
          }

          const isPresent = status === 'present';
          const category = isPresent ? 'attendance_present' : 'attendance_absent';
          const subject = isPresent
            ? `Attendance Confirmation: Present on Mat - Karate Academy India`
            : `Attendance Notice: Absent from Session - Karate Academy India`;
          const subtitle = isPresent ? 'Mat Check-In Confirmation' : 'Mat Absence Notice';

          // Standard Professional Template (No Emojis)
          const contentHtml = isPresent ? `
            <p>This is to confirm that <strong>${targetName}</strong> has safely checked in and is <strong>PRESENT</strong> for scheduled training on the tatami mat.</p>
            <div class="card">
              <table class="table">
                <tr><td class="label">Student ID:</td><td class="value">${studentId}</td></tr>
                <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                <tr><td class="label">Check-In Date:</td><td class="value">${date || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
                <tr><td class="label">Check-In Time:</td><td class="value">${time || new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })}</td></tr>
                <tr><td class="label">Attendance Status:</td><td class="value"><span class="badge-paid">PRESENT</span></td></tr>
              </table>
            </div>
            <p>Thank you for training with Karate Academy India.</p>
          ` : `
            <p>This is a notification that <strong>${targetName}</strong> was marked <strong>ABSENT</strong> for scheduled training on ${date || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}.</p>
            <div class="card">
              <table class="table">
                <tr><td class="label">Student ID:</td><td class="value">${studentId}</td></tr>
                <tr><td class="label">Athlete Name:</td><td class="value">${targetName}</td></tr>
                <tr><td class="label">Date:</td><td class="value">${date || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</td></tr>
                <tr><td class="label">Status:</td><td class="value"><span class="badge-overdue">ABSENT</span></td></tr>
              </table>
            </div>
            <p>If this absence was due to illness or personal reasons, please inform our administration office.</p>
          `;

          const result = await dispatchAutomatedEmail({
            category,
            targetEmail: primaryEmail,
            targetName,
            subject,
            subtitle,
            contentHtml,
            triggeredBy: `Attendance Engine (${sessionUser.username})`,
            preventDuplicateMinutes: 1440, // 24 hours per attendance event
            meta: { studentId, status, date }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7.6 Staff Salary Disbursement & Automatic PDF Payslip Endpoint (`/api/staff-salary`)
    if (req.url === '/api/staff-salary' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Managers and Admins can manage staff salaries.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { staffId, staffName, staffEmail, month, paidAmount, paymentDate, paymentMethod, paymentRef, notes, branchId } = JSON.parse(body);

          const dbData = readDbFile();
          dbData.staffSalaries = dbData.staffSalaries || [];

          // Prevent duplicate payslip/email for the same staff member and month
          const cleanMonth = String(month || '').trim();
          const cleanStaffId = String(staffId || '').trim();
          const existingSalary = dbData.staffSalaries.find(s => String(s.staffId) === cleanStaffId && String(s.month).toLowerCase() === cleanMonth.toLowerCase() && s.status === 'Paid');

          if (existingSalary) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Salary payslip for ${staffName} (${cleanMonth}) has already been paid and processed.` }));
            return;
          }

          const salaryId = 'SAL-' + Date.now();
          const salaryRecord = {
            id: salaryId,
            staffId: cleanStaffId,
            staffName: staffName || 'Staff Member',
            staffEmail: staffEmail || 'staff@karateacademyindia.com',
            month: cleanMonth,
            paidAmount: parseInt(paidAmount || 0),
            paymentDate: paymentDate || new Date().toISOString().split('T')[0],
            paymentMethod: paymentMethod || 'Bank Transfer',
            paymentRef: paymentRef || 'N/A',
            notes: notes || '',
            branchId: branchId || 'HQ',
            status: 'Paid',
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
          };

          dbData.staffSalaries.unshift(salaryRecord);

          // Record expense transaction in financials
          dbData.financials = dbData.financials || [];
          dbData.financials.unshift({
            id: salaryId,
            type: 'Expense',
            category: 'Salaries',
            description: `Staff Salary Disbursed: ${staffName} (${cleanMonth})`,
            finalPaid: parseInt(paidAmount || 0),
            amount: parseInt(paidAmount || 0),
            date: salaryRecord.paymentDate,
            paymentMethod: paymentRecordMethod = paymentMethod || 'Bank Transfer',
            branchId: branchId || 'HQ',
            status: 'Paid'
          });

          writeDbFile(dbData);

          // Dispatch automatic Email with attached PDF Payslip
          let emailResult = { success: true, message: 'Salary recorded without email.' };
          if (staffEmail && staffEmail.includes('@')) {
            emailResult = await dispatchAutomatedEmail({
              category: 'payslip',
              targetEmail: staffEmail,
              targetName: staffName,
              subject: `Official Monthly Salary Payslip (${cleanMonth}) - Karate Academy India`,
              subtitle: 'Monthly Staff Salary Payslip',
              contentHtml: `
                <div class="card">
                  <h4 style="margin:0 0 10px 0; color:#0f172a; font-size:15px;">Monthly Salary Disbursement</h4>
                  <p style="margin:0 0 8px 0; font-size:13px; color:#334155;">Dear <strong>${staffName}</strong>,</p>
                  <p style="margin:0 0 14px 0; font-size:13px; color:#334155;">Your salary payment for <strong>${cleanMonth}</strong> has been processed successfully. Attached to this email is your official computerized PDF payslip statement.</p>
                  <table class="table">
                    <tr><td class="label">Staff ID</td><td class="value">${cleanStaffId}</td></tr>
                    <tr><td class="label">Salary Month</td><td class="value">${cleanMonth}</td></tr>
                    <tr><td class="label">Net Amount Paid</td><td class="value">₹${parseInt(paidAmount || 0).toLocaleString('en-IN')}</td></tr>
                    <tr><td class="label">Payment Method</td><td class="value">${paymentMethod || 'Bank Transfer'}</td></tr>
                    <tr><td class="label">Status</td><td class="value"><span class="badge-paid">PAID & VERIFIED</span></td></tr>
                  </table>
                </div>
              `,
              triggeredBy: `${sessionUser.name} (${sessionUser.username})`,
              preventDuplicateMinutes: 1,
              meta: { salaryObj: salaryRecord }
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Salary paid & payslip emailed successfully.', salaryRecord, emailResult }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 7.7 Multiple Branch Management Endpoint (`/api/branches`)
    if (req.url.startsWith('/api/branches')) {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      if (req.method === 'GET') {
        const dbData = readDbFile();
        const defaultBranches = [
          { id: 'HQ', name: 'Main Honbu Dojo', code: 'HQ', city: 'Jaipur', address: 'Central Dojo HQ', phone: '+91 70409 25257', status: 'active' },
          { id: 'NORTH', name: 'North Branch Dojo', code: 'NORTH', city: 'Jaipur', address: 'North Martial Arts Center', phone: '+91 70409 25257', status: 'active' },
          { id: 'SOUTH', name: 'South Branch Dojo', code: 'SOUTH', city: 'Jaipur', address: 'South Training Arena', phone: '+91 70409 25257', status: 'active' }
        ];
        dbData.branches = (dbData.branches && dbData.branches.length > 0) ? dbData.branches : defaultBranches;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, branches: dbData.branches }));
        return;
      }

      // Branch mutation methods (POST, PUT, DELETE) strictly restricted to Admin
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        if (sessionUser.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '403 Forbidden. Only Administrators can create, edit, or delete branches.' }));
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const dbData = readDbFile();
            dbData.branches = dbData.branches || [];

            if (req.method === 'DELETE') {
              const urlParts = req.url.split('/');
              const branchId = urlParts[urlParts.length - 1];
              dbData.branches = dbData.branches.filter(b => String(b.id) !== String(branchId) && String(b.code) !== String(branchId));
              writeDbFile(dbData);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, branches: dbData.branches, message: 'Branch deleted successfully.' }));
              return;
            }

            const branchObj = body ? JSON.parse(body) : {};
            const existingIdx = dbData.branches.findIndex(b => String(b.id) === String(branchObj.id) || (branchObj.code && String(b.code) === String(branchObj.code)));
            
            if (existingIdx >= 0) {
              dbData.branches[existingIdx] = { ...dbData.branches[existingIdx], ...branchObj };
            } else {
              const newBranch = {
                id: branchObj.code || 'BRANCH_' + Date.now(),
                name: branchObj.name || 'New Branch',
                code: (branchObj.code || 'BR').toUpperCase(),
                city: branchObj.city || 'Jaipur',
                address: branchObj.address || '',
                phone: branchObj.phone || '+91 70409 25257',
                status: branchObj.status || 'active'
              };
              dbData.branches.push(newBranch);
            }
            writeDbFile(dbData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, branches: dbData.branches }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload' }));
          }
        });
        return;
      }
    }

    // 7.8 Expense Management Endpoint (`/api/expenses`)
    if (req.url.startsWith('/api/expenses')) {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      if (req.method === 'GET') {
        const dbData = readDbFile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, expenses: dbData.expenses || [] }));
        return;
      }

      if (req.method === 'POST') {
        if (sessionUser.role !== 'admin' && sessionUser.role !== 'manager') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '403 Forbidden.' }));
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const exp = JSON.parse(body);
            const dbData = readDbFile();
            dbData.expenses = dbData.expenses || [];

            const expId = exp.id || ('EXP-' + Date.now());
            const expRecord = {
              id: expId,
              branchId: exp.branchId || 'HQ',
              category: exp.category || 'Utilities',
              amount: parseInt(exp.amount || 0),
              paymentMethod: exp.paymentMethod || 'UPI',
              vendor: exp.vendor || 'Vendor',
              description: exp.description || '',
              referenceNo: exp.referenceNo || 'N/A',
              date: exp.date || new Date().toISOString().split('T')[0],
              status: exp.status || 'Approved',
              createdBy: sessionUser.name,
              timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
            };

            const idx = dbData.expenses.findIndex(e => String(e.id) === String(expId));
            if (idx >= 0) dbData.expenses[idx] = expRecord;
            else dbData.expenses.unshift(expRecord);

            writeDbFile(dbData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, expense: expRecord, expenses: dbData.expenses }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload' }));
          }
        });
        return;
      }
    }

    // 7.9 Financial Ledger PDF Report Generator (`/api/reports/financial-ledger-pdf`)
    if (req.url.startsWith('/api/reports/financial-ledger-pdf') && req.method === 'GET') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const branch = urlObj.searchParams.get('branch') || 'all';

      const dbData = readDbFile();
      const pdfBuf = createPdfFinancialLedgerBuffer(dbData, branch);

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Financial_Ledger_Statement_${branch}.pdf"`
      });
      res.end(pdfBuf);
      return;
    }

    // 8. Transactional User Deletion API Endpoint (`/api/users/delete`)
    if (req.url === '/api/users/delete' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Root Admin can delete user accounts.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { userId, username } = JSON.parse(body);
          if (username === 'admin') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Cannot delete root admin account.' }));
            return;
          }

          const dbData = readDbFile();
          dbData.users = (dbData.users || []).filter(u => String(u.id) !== String(userId) && u.username !== username);

          for (const [sessToken, userObj] of activeSessions.entries()) {
            if (userObj.username === username) {
              activeSessions.delete(sessToken);
            }
          }

          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `User Deleted: ${username}`,
            subtitle: `Deleted by Admin (${sessionUser.username})`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'user'
          });

          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `User ${username} deleted successfully and session invalidated.`,
            deletedUser: username
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    // 9. Backend Email Receipt Endpoint (`/api/email-receipt`)
    if (req.url === '/api/email-receipt' && req.method === 'POST') {
      if (!sessionUser) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '401 Unauthorized.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { invoiceId, studentEmail, studentName, invoiceObj } = JSON.parse(body);
          const inv = invoiceObj || { id: invoiceId, studentName: studentName || 'Student', finalPaid: 2500, dueDate: new Date().toLocaleDateString('en-IN') };

          const result = await dispatchAutomatedEmail({
            category: 'receipt',
            targetEmail: studentEmail,
            targetName: inv.studentName || studentName,
            subject: `Official Fee Payment Receipt #${inv.id} - Karate Academy India`,
            subtitle: 'Official Payment Receipt',
            contentHtml: `
              <p>Thank you for training with <strong>Karate Academy India</strong>. Your tuition fee payment has been successfully received and recorded.</p>
              <div class="card">
                <table class="table">
                  <tr><td class="label">Invoice / Receipt #:</td><td class="value">${inv.id}</td></tr>
                  <tr><td class="label">Student Name:</td><td class="value">${inv.studentName} (${inv.studentId || ''})</td></tr>
                  <tr><td class="label">Payment Date:</td><td class="value">${inv.dueDate || new Date().toLocaleDateString('en-IN')}</td></tr>
                  <tr><td class="label">Payment Method:</td><td class="value">${inv.paymentMethod || 'Verified Payment'}</td></tr>
                  <tr><td class="label">Membership Period:</td><td class="value">${inv.startDate || 'Current'} to ${inv.endDate || 'Next Renewal'}</td></tr>
                  <tr><td class="label">Amount Paid:</td><td class="value"><span class="badge-paid">₹${(inv.finalPaid || inv.amount || 0).toLocaleString('en-IN')}</span></td></tr>
                </table>
              </div>
              <p>Please keep this receipt for your records.</p>
            `,
            triggeredBy: `Payment Engine (${sessionUser.username})`,
            preventDuplicateMinutes: 1,
            meta: { invoiceId: inv.id }
          });

          const dbData = readDbFile();
          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `Email Receipt Dispatched: ${invoiceId}`,
            subtitle: `Sent to ${studentEmail || 'N/A'} for ${studentName || 'Student'} (${result.success ? 'Delivered' : 'Failed'})`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'payment'
          });
          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

// Secure Public Reference Generator (Masked, Non-Sensitive Tokens for Public Contexts)
function getStudentPublicRef(student) {
  if (!student) return 'KAISTDXXXX';
  if (student.publicRef) return student.publicRef;
  const idStr = String(student.studentId || student.id || '');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
    hash |= 0;
  }
  const token = Math.abs(hash).toString(36).toUpperCase().padStart(4, 'X').slice(-4);
  return `KAISTD-${token}`;
}

    // 10. Public CAPTCHA Challenge Endpoint (`/api/public/captcha`)
    if (req.url === '/api/public/captcha' && req.method === 'GET') {
      const challenge = generateCaptchaChallenge();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        token: challenge.token,
        question: challenge.question
      }));
      return;
    }

    // 10.1 Public Athlete Verification Endpoint (`/api/public/verify-athlete`)
    if (req.url.startsWith('/api/public/verify-athlete') && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const ref = urlObj.searchParams.get('ref') || urlObj.searchParams.get('token') || '';

      const dbData = readDbFile();
      const foundStudent = (dbData.students || []).find(s =>
        getStudentPublicRef(s) === ref || String(s.publicRef) === ref || String(s.studentId) === ref || String(s.id) === ref
      );

      if (!foundStudent) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Athlete verification record not found.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        verification: {
          publicRef: getStudentPublicRef(foundStudent),
          maskedId: 'KAISTDXXXX',
          name: foundStudent.name,
          belt: foundStudent.belt || 'White Belt',
          status: foundStudent.accountStatus === 'inactive' ? 'Inactive' : 'Active Pass',
          avatar: foundStudent.avatar || '',
          academyName: 'Karate Academy India',
          verifiedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 11. Public Student Admission Submission Endpoint (`/api/public/admissions`)
    if ((req.url === '/api/public/admissions' || req.url === '/api/admissions') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 25 * 1024 * 1024) { // 25MB max payload guard
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload exceeds maximum limit (25MB)' }));
          req.destroy();
        }
      });

      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const {
            name, firstName, middleName, lastName, gender, dob, medicalNotes,
            belt, membershipPlan, parentName, phone, email,
            emergName, emergPhone, emergRelation,
            address, city, state, pincode,
            govIdType, govIdNumber, avatar, documents,
            captchaToken, captchaAnswer
          } = payload;

          // CAPTCHA Verification
          if (!verifyCaptcha(captchaToken, captchaAnswer)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Security CAPTCHA verification failed. Please try again.' }));
            return;
          }

          // Mandatory Field Validation
          const cleanName = String(name || `${firstName || ''} ${lastName || ''}`).trim();
          const cleanPhone = String(phone || '').trim();
          const cleanEmail = String(email || '').trim();

          if (!cleanName || !cleanPhone || !cleanEmail || !gender || !dob) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing mandatory personal or contact details.' }));
            return;
          }

          // Photo Validation
          if (!avatar || (!String(avatar).startsWith('data:image') && !String(avatar).startsWith('http'))) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'A valid passport-size photo is mandatory for the Digital ID Card.' }));
            return;
          }

          // Document Validation (1 Mandatory, up to 4 optional, max 5 total)
          const docs = Array.isArray(documents) ? documents : [];
          if (docs.length < 1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'At least 1 valid document attachment (e.g. Aadhaar Card / ID Proof) is mandatory.' }));
            return;
          }
          if (docs.length > 5) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Maximum 5 document attachments allowed.' }));
            return;
          }

          const dbData = readDbFile();
          dbData.pendingAdmissions = dbData.pendingAdmissions || [];

          const year = new Date().getFullYear();
          const countForYear = (dbData.pendingAdmissions.length + 1);
          const applicationId = `KAIADM${year}${String(countForYear).padStart(3, '0')}`;

          const newAdmission = {
            id: applicationId,
            status: 'pending', // 'pending' | 'approved' | 'rejected'
            submittedAt: new Date().toISOString(),
            name: cleanName,
            firstName: firstName || cleanName.split(' ')[0] || '',
            middleName: middleName || '',
            lastName: lastName || cleanName.split(' ').slice(1).join(' ') || '',
            gender: gender || 'Male',
            dob: dob || '',
            medicalNotes: medicalNotes || '',
            belt: belt || 'White Belt',
            membershipPlan: membershipPlan || 'Monthly',
            parentName: parentName || cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            emergName: emergName || parentName || 'Emergency Contact',
            emergPhone: emergPhone || cleanPhone,
            emergRelation: emergRelation || 'Parent / Guardian',
            address: address || '',
            city: city || 'Pune',
            state: state || 'MH',
            pincode: pincode || '411033',
            govIdType: govIdType || 'Aadhaar Card',
            govIdNumber: govIdNumber || 'N/A',
            avatar: avatar,
            documents: docs.map((d, i) => ({
              id: `doc_${Date.now()}_${i}`,
              name: d.name || `Document_${i + 1}`,
              type: d.type || 'application/pdf',
              size: d.size || 0,
              data: d.data
            }))
          };

          dbData.pendingAdmissions.unshift(newAdmission);

          // Audit log
          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `New Online Admission Application: ${cleanName}`,
            subtitle: `Application #${applicationId} submitted via public portal for Manager verification`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'enrollment'
          });

          writeDbFile(dbData);

          // Automated Application Received Acknowledgement Email
          if (cleanEmail) {
            dispatchAutomatedEmail({
              category: 'admission_received',
              targetEmail: cleanEmail,
              targetName: cleanName,
              subject: `Admission Application Received (${applicationId}) - Karate Academy India`,
              subtitle: 'Application Acknowledgement',
              contentHtml: `
                <p>Thank you for submitting your admission application to <strong>Karate Academy India</strong>.</p>
                <div class="card">
                  <table class="table">
                    <tr><td class="label">Application Reference:</td><td class="value"><span class="badge-paid">${applicationId}</span></td></tr>
                    <tr><td class="label">Applicant Name:</td><td class="value">${cleanName}</td></tr>
                    <tr><td class="label">Selected Belt:</td><td class="value">${belt || 'White Belt'}</td></tr>
                    <tr><td class="label">Membership Plan:</td><td class="value">${membershipPlan || 'Monthly'}</td></tr>
                    <tr><td class="label">Submission Date:</td><td class="value">${new Date().toLocaleDateString('en-IN')}</td></tr>
                    <tr><td class="label">Current Status:</td><td class="value"><span class="badge-due">UNDER MANAGER REVIEW</span></td></tr>
                  </table>
                </div>
                <p>Our Academy Manager is reviewing your verification documents. Once approved, your official Student ID and Digital Mat Pass will be activated.</p>
              `,
              triggeredBy: 'Online Admission Portal',
              preventDuplicateMinutes: 5,
              meta: { applicationId }
            }).catch(() => { });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            applicationId: applicationId,
            applicantName: cleanName,
            message: 'Your admission application has been successfully submitted! Our Academy Manager will review and verify your details shortly.'
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid admission submission payload: ${e.message}` }));
        }
      });
      return;
    }

    // 11.1 Public Candidate Details Lookup Endpoint (`/api/public/candidate-details`)
    if (req.url.startsWith('/api/public/candidate-details') && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const studentId = (urlObj.searchParams.get('studentId') || '').trim();

      const dbData = readDbFile();
      const student = (dbData.students || []).find(s => 
        String(s.studentId).toLowerCase() === studentId.toLowerCase() || 
        String(s.id) === studentId || 
        String(s.phone) === studentId
      );

      if (!student) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Candidate Student ID not found in database.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        candidate: {
          studentId: student.studentId,
          name: student.name,
          belt: student.belt || 'White Belt',
          branchId: student.branchId || 'HQ',
          joinDate: student.joinDate || 'N/A',
          matHours: student.matHours || 0,
          status: student.accountStatus || 'active',
          avatar: student.avatar || ''
        }
      }));
      return;
    }

    // 11.2 Public Belt Exam Application Endpoint (`/api/public/belt-exam`)
    if ((req.url === '/api/public/belt-exam' || req.url === '/api/belt-exam') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const dbData = readDbFile();
          
          // Activation Check
          if (dbData.config && dbData.config.beltExamEnabled === false) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Belt Examination Applications are currently closed by Academy Management.' }));
            return;
          }

          const payload = JSON.parse(body);
          const { studentId, targetBelt, instructorRec, notes, captchaToken, captchaAnswer } = payload;

          if (!verifyCaptcha(captchaToken, captchaAnswer)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Security CAPTCHA verification failed.' }));
            return;
          }

          const student = (dbData.students || []).find(s => 
            String(s.studentId).toLowerCase() === String(studentId || '').trim().toLowerCase() ||
            String(s.id) === String(studentId || '').trim()
          );

          if (!student) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Student record not found for Student ID provided.' }));
            return;
          }

          dbData.pendingBeltExams = dbData.pendingBeltExams || [];
          const year = new Date().getFullYear();
          const examAppId = `KAIBELT${year}${String(dbData.pendingBeltExams.length + 1).padStart(3, '0')}`;

          const application = {
            id: examAppId,
            studentId: student.studentId,
            candidateName: student.name,
            currentBelt: student.belt || 'White Belt',
            targetBelt: targetBelt || 'Yellow Belt',
            branchId: student.branchId || 'HQ',
            instructorRec: instructorRec || 'Recommended',
            notes: notes || '',
            submittedAt: new Date().toISOString(),
            status: 'pending'
          };

          dbData.pendingBeltExams.unshift(application);

          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            timestamp: new Date().toLocaleString('en-US', { hour12: true }),
            type: 'system',
            user: student.name,
            action: `Belt Exam Application submitted: ${student.name} (${student.studentId}) for ${application.targetBelt}`,
            isRead: false
          });

          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            examAppId: examAppId,
            candidateName: student.name,
            currentBelt: student.belt,
            targetBelt: application.targetBelt,
            message: 'Belt Examination Application submitted successfully and queued for Evaluation.'
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Belt Exam Application payload: ' + e.message }));
        }
      });
      return;
    }

    // 11.3 Mark All Logs Read Endpoint (`/api/logs/mark-all-read`)
    if (req.url === '/api/logs/mark-all-read' && req.method === 'POST') {
      const dbData = readDbFile();
      if (Array.isArray(dbData.activityLogs)) {
        dbData.activityLogs.forEach(l => l.isRead = true);
      }
      writeDbFile(dbData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'All system activity logs marked as read.' }));
      return;
    }

    // 12. Protected Pending Admissions List Endpoint (`/api/admissions/pending`)
    if (req.url === '/api/admissions/pending' && req.method === 'GET') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Manager permission required.' }));
        return;
      }

      const dbData = readDbFile();
      const pending = (dbData.pendingAdmissions || []).filter(a => a.status === 'pending');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: pending.length, admissions: pending }));
      return;
    }

    // 13. Protected Admission Approval Endpoint (`/api/admissions/approve`)
    if (req.url === '/api/admissions/approve' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Managers and Admins can approve admissions.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const { admissionId, initialFee, belt } = JSON.parse(body);
          const dbData = readDbFile();
          const admission = (dbData.pendingAdmissions || []).find(a => a.id === admissionId);

          if (!admission) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Admission application not found.' }));
            return;
          }

          if (admission.status === 'approved') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Admission application is already approved.' }));
            return;
          }

          const studentId = generateServerStudentId(dbData);
          const beltRank = belt || admission.belt || 'White Belt';
          const feeAmount = parseInt(initialFee || admission.monthlyFee || dbData.config?.monthlyFee || 2500);
          const regFee = parseInt(dbData.config?.regFee || 1000);
          const finalFee = feeAmount + regFee;
          const invoiceId = generateServerInvoiceNo(studentId, dbData);

          const newStudent = {
            id: Date.now(),
            studentId: studentId,
            name: admission.name,
            belt: beltRank,
            dob: admission.dob,
            gender: admission.gender || 'Male',
            medicalNotes: admission.medicalNotes || '',
            membershipPlan: admission.membershipPlan || 'Monthly',
            parentName: admission.parentName || admission.name,
            phone: admission.phone,
            email: admission.email,
            emergName: admission.emergName || admission.parentName || 'Emergency Contact',
            emergPhone: admission.emergPhone || admission.phone,
            address: admission.address || '',
            city: admission.city || 'Pune',
            state: admission.state || 'MH',
            pincode: admission.pincode || '411033',
            govIdType: admission.govIdType || 'Aadhaar Card',
            govIdNumber: admission.govIdNumber || 'N/A',
            avatar: admission.avatar,
            monthlyFee: feeAmount,
            status: 'present',
            accountStatus: 'active',
            joinDate: new Date().toISOString().split('T')[0],
            matHours: 0,
            admissionRef: admission.id
          };

          dbData.students.push(newStudent);

          dbData.financials.unshift({
            id: invoiceId,
            studentId: studentId,
            studentName: admission.name,
            origAmount: finalFee,
            discount: 0,
            finalPaid: finalFee,
            dueDate: new Date().toISOString().split('T')[0],
            status: 'Paid',
            paymentMethod: 'Admission Enrolment'
          });

          admission.status = 'approved';
          admission.approvedAt = new Date().toISOString();
          admission.approvedBy = `${sessionUser.name} (${sessionUser.username})`;
          admission.assignedStudentId = studentId;

          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `Admission Approved: ${admission.name}`,
            subtitle: `Assigned Student ID ${studentId} • ${beltRank} by ${sessionUser.name}`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'enrollment'
          });

          writeDbFile(dbData);

          // Automated ID Card & Welcome Email Delivery with PDF Payment Receipt Attachment
          if (admission.email) {
            const invoiceObj = {
              id: invoiceId,
              studentId: studentId,
              studentName: admission.name,
              origAmount: finalFee,
              discount: 0,
              finalPaid: finalFee,
              dueDate: new Date().toISOString().split('T')[0],
              status: 'Paid',
              paymentMethod: 'Admission Enrolment'
            };

            dispatchAutomatedEmail({
              category: 'admission_approved',
              targetEmail: admission.email,
              targetName: admission.name,
              subject: `Admission Approved! Official Student ID Card (${studentId}) & Payment Receipt - Karate Academy India`,
              subtitle: 'Official Admission & Digital ID Card Delivery',
              contentHtml: `
                <p>Congratulations! Your admission to <strong>Karate Academy India</strong> has been officially approved and verified by the Academy Manager.</p>
                <div class="card">
                  <table class="table">
                    <tr><td class="label">Assigned Student ID:</td><td class="value"><span class="badge-paid">${studentId}</span></td></tr>
                    <tr><td class="label">Athlete Name:</td><td class="value">${admission.name}</td></tr>
                    <tr><td class="label">Belt Rank:</td><td class="value">${beltRank}</td></tr>
                    <tr><td class="label">Initial Receipt #:</td><td class="value">${invoiceId}</td></tr>
                    <tr><td class="label">Amount Paid:</td><td class="value"><span class="badge-paid">₹${finalFee.toLocaleString('en-IN')}</span></td></tr>
                    <tr><td class="label">Enrolment Date:</td><td class="value">${new Date().toLocaleDateString('en-IN')}</td></tr>
                    <tr><td class="label">Account Status:</td><td class="value"><span class="badge-paid">ACTIVE</span></td></tr>
                  </table>
                </div>
                <p><strong>Payment Receipt Attached:</strong> Your official payment receipt PDF for ₹${finalFee.toLocaleString('en-IN')} is attached to this email.</p>
                <p><strong>Next Steps:</strong></p>
                <ul>
                  <li>Your Digital Mat Pass is now active. Present your Student ID (<strong>${studentId}</strong>) at the reception kiosk for automatic attendance check-in.</li>
                  <li>Collect your physical syllabus booklet from the dojo front desk on your next training session.</li>
                </ul>
              `,
              triggeredBy: `Manager Approval (${sessionUser.username})`,
              preventDuplicateMinutes: 1,
              meta: { studentId, invoiceId, admissionId: admission.id, invoiceObj }
            }).catch(() => { });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Admission for ${admission.name} successfully approved! Assigned ID ${studentId}.`,
            student: newStudent,
            invoiceId: invoiceId
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Approval failed: ${e.message}` }));
        }
      });
      return;
    }

    // 14. Protected Admission Rejection Endpoint (`/api/admissions/reject`)
    if (req.url === '/api/admissions/reject' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Managers and Admins can reject admissions.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { admissionId, rejectionReason } = JSON.parse(body);
          const dbData = readDbFile();
          const admission = (dbData.pendingAdmissions || []).find(a => a.id === admissionId);

          if (!admission) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Admission application not found.' }));
            return;
          }

          admission.status = 'rejected';
          admission.rejectedAt = new Date().toISOString();
          admission.rejectedBy = `${sessionUser.name} (${sessionUser.username})`;
          admission.rejectionReason = rejectionReason || 'Application details did not meet requirements.';

          dbData.activityLogs = dbData.activityLogs || [];
          dbData.activityLogs.unshift({
            id: Date.now(),
            title: `Admission Rejected: ${admission.name}`,
            subtitle: `Application #${admission.id} rejected by ${sessionUser.name} (${admission.rejectionReason})`,
            timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            type: 'enrollment'
          });

          writeDbFile(dbData);

          // Automated Rejection Notice Email
          if (admission.email) {
            dispatchAutomatedEmail({
              category: 'admission_rejected',
              targetEmail: admission.email,
              targetName: admission.name,
              subject: `Admission Application Status Update (${admission.id}) - Karate Academy India`,
              subtitle: 'Application Status Update',
              contentHtml: `
                <p>Thank you for your interest in <strong>Karate Academy India</strong>.</p>
                <p>Regarding your online admission application #${admission.id}, our administration team has reviewed the submitted details.</p>
                <div class="card">
                  <table class="table">
                    <tr><td class="label">Applicant Name:</td><td class="value">${admission.name}</td></tr>
                    <tr><td class="label">Status:</td><td class="value"><span class="badge-overdue">NOT APPROVED</span></td></tr>
                    <tr><td class="label">Reason / Remarks:</td><td class="value">${admission.rejectionReason}</td></tr>
                  </table>
                </div>
                <p>If you have any questions or wish to re-submit with updated documentation, please contact our academy front desk at +91 70409 25257 or visit our center.</p>
              `,
              triggeredBy: `Manager Rejection (${sessionUser.username})`,
              preventDuplicateMinutes: 1,
              meta: { admissionId: admission.id }
            }).catch(() => { });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Admission #${admissionId} marked as rejected.`
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Rejection failed: ${e.message}` }));
        }
      });
      return;
    }

    // 15. Staff User Creation & Payroll Endpoint (`/api/staff`)
    if (req.url === '/api/staff' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only Managers and Admins can create staff accounts.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { username, password, name, email, role, permissions, monthlySalary } = JSON.parse(body);
          if (!username || !password || !name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username, password, and full name are required.' }));
            return;
          }

          const dbData = readDbFile();
          dbData.users = dbData.users || [];

          const existing = dbData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
          if (existing) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username already exists.' }));
            return;
          }

          const staffId = generateServerStaffId(dbData);
          const newStaff = {
            id: Date.now(),
            staffId: staffId,
            username,
            password,
            name,
            email: email || `${username}@karateacademyindia.com`,
            role: role || 'receptionist',
            permissions: permissions || ['attendance', 'directory'],
            monthlySalary: parseInt(monthlySalary || 15000),
            status: 'active',
            createdAt: new Date().toISOString().split('T')[0]
          };

          dbData.users.push(newStaff);
          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Staff member ${name} created successfully! Assigned Staff ID ${staffId}.`,
            staff: newStaff
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Staff creation failed: ${e.message}` }));
        }
      });
      return;
    }

    // 16.1 Staff Account Status Toggle (`/api/staff/status`)
    if (req.url === '/api/staff/status' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only Managers and Admins can modify staff account status.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { staffId, status } = JSON.parse(body);
          const dbData = readDbFile();
          const staff = (dbData.users || []).find(u => u.staffId === staffId || String(u.id) === String(staffId));

          if (!staff) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Staff member record not found.' }));
            return;
          }

          staff.status = status === 'disabled' ? 'disabled' : 'active';
          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Staff account ${staff.name} status updated to ${staff.status.toUpperCase()}.`,
            staff
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to update status: ${e.message}` }));
        }
      });
      return;
    }

    // 16.2 Staff Deletion Endpoint (`/api/staff/delete` - Admin Only)
    if (req.url === '/api/staff/delete' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '403 Forbidden. Only Root Administrators can delete staff accounts.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { staffId } = JSON.parse(body);
          const dbData = readDbFile();
          const idx = (dbData.users || []).findIndex(u => u.staffId === staffId || String(u.id) === String(staffId));

          if (idx < 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Staff member record not found.' }));
            return;
          }

          const target = dbData.users[idx];
          if (target.username === 'admin') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Cannot delete primary root administrator account.' }));
            return;
          }

          dbData.users.splice(idx, 1);
          writeDbFile(dbData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Staff account ${target.name} (${target.staffId || target.username}) deleted successfully.`
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Staff deletion failed: ${e.message}` }));
        }
      });
      return;
    }

    // 16. Staff Salary Invoice Generation Endpoint (`/api/staff/invoice`)
    if (req.url === '/api/staff/invoice' && req.method === 'POST') {
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only Managers and Admins can generate staff salary invoices.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { staffId, month, amount } = JSON.parse(body);
          const dbData = readDbFile();
          const staff = (dbData.users || []).find(u => u.staffId === staffId || String(u.id) === String(staffId));

          if (!staff) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Staff member record not found.' }));
            return;
          }

          const invoiceId = generateServerStaffInvoiceNo(staff.staffId || 'KAISTF202601', dbData);
          const salaryPaid = parseInt(amount || staff.monthlySalary || 15000);
          const monthStr = month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

          const payslipEntry = {
            id: invoiceId,
            staffId: staff.staffId || 'KAISTF202601',
            staffName: staff.name,
            salary: salaryPaid,
            month: monthStr,
            date: new Date().toISOString().split('T')[0],
            status: 'Paid',
            paymentMethod: 'Bank Direct Transfer'
          };

          dbData.staffFinancials = dbData.staffFinancials || [];
          dbData.staffFinancials.unshift(payslipEntry);
          writeDbFile(dbData);

          // Dispatch Payslip Email with PDF Attachment
          if (staff.email) {
            dispatchAutomatedEmail({
              category: 'staff_salary',
              targetEmail: staff.email,
              targetName: staff.name,
              subject: `Official Monthly Salary Payslip (${invoiceId}) - Karate Academy India`,
              subtitle: 'Official Monthly Payroll Payslip',
              contentHtml: `
                <p>Your monthly salary payment has been processed and credited by Karate Academy India administration.</p>
                <div class="card">
                  <table class="table">
                    <tr><td class="label">Staff ID:</td><td class="value">${staff.staffId || 'KAISTF202601'}</td></tr>
                    <tr><td class="label">Payslip Ref #:</td><td class="value">${invoiceId}</td></tr>
                    <tr><td class="label">Payroll Period:</td><td class="value">${monthStr}</td></tr>
                    <tr><td class="label">Net Salary Paid:</td><td class="value"><span class="badge-paid">Rs. ${salaryPaid.toLocaleString('en-IN')}</span></td></tr>
                    <tr><td class="label">Disbursement Method:</td><td class="value">Bank Direct Transfer</td></tr>
                  </table>
                </div>
                <p>An official PDF payslip receipt is attached to this email for your financial records.</p>
              `,
              triggeredBy: `Payroll Generation (${sessionUser.username})`,
              preventDuplicateMinutes: 0,
              meta: { invoiceObj: payslipEntry }
            }).catch(() => { });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Generated salary invoice ${invoiceId} for ${staff.name}.`,
            invoice: payslipEntry
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Staff invoice generation failed: ${e.message}` }));
        }
      });
      return;
    }

    // 17. Holiday Attendance Notification Endpoint (`/api/attendance/holiday`)
    if (req.url === '/api/attendance/holiday' && req.method === 'POST') {
      if (!sessionUser || sessionUser.role === 'viewer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Permission denied.' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { holidayName, date, notes } = JSON.parse(body);
          const dbData = readDbFile();
          const activeStudents = (dbData.students || []).filter(s => s.accountStatus !== 'inactive' && (s.contactEmail || s.email));

          const dateStr = date || new Date().toISOString().split('T')[0];
          const reasonStr = holidayName || 'Academy General Holiday';

          activeStudents.forEach(s => {
            const recipientEmail = s.contactEmail || s.email;
            if (recipientEmail) {
              dispatchAutomatedEmail({
                category: 'holiday_notice',
                targetEmail: recipientEmail,
                targetName: s.name,
                subject: `Academy Holiday Notice (${dateStr}) - Karate Academy India`,
                subtitle: 'Academy Holiday Notice',
                contentHtml: `
                  <p>Please note that <strong>Karate Academy India</strong> training sessions will be closed on <strong>${dateStr}</strong> due to <strong>${reasonStr}</strong>.</p>
                  <p>${notes || 'Regular training sessions will resume as per schedule on the next working day.'}</p>
                `,
                triggeredBy: `Holiday Notice (${sessionUser.username})`,
                preventDuplicateMinutes: 60,
                meta: { holidayName: reasonStr, date: dateStr }
              }).catch(() => { });
            }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: `Dispatched holiday notices for ${reasonStr} on ${dateStr} to ${activeStudents.length} active athletes.`
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Holiday notice dispatch failed: ${e.message}` }));
        }
      });
      return;
    }

    // Unmatched API endpoint fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }

  // Extract clean pathname without query strings
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const normalizedUrl = pathname.toLowerCase();

  // Restrict direct static file serving for db.json
  if (normalizedUrl === '/db.json' || normalizedUrl.endsWith('/db.json')) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>403 Forbidden</h1><p>Direct database file access is restricted.</p>', 'utf-8');
    return;
  }

  // Handle /admission route directly to serve admission.html
  if (normalizedUrl === '/admission' || normalizedUrl === '/admission.html') {
    const admissionPath = path.join(__dirname, 'admission.html');
    fs.readFile(admissionPath, (err, content) => {
      if (!err) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content, 'utf-8');
      } else {
        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, (idxErr, idxContent) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(idxContent, 'utf-8');
        });
      }
    });
    return;
  }

  // Static File Serving with Single Page Application (SPA) Fallback
  let relativePath = (pathname === '/' || pathname === '') ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.join(__dirname, relativePath);
  const ext = path.extname(filePath);
  let contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        if (ext && ext !== '.html' && ext !== '.htm') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }

        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, (indexErr, indexContent) => {
          if (!indexErr) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent, 'utf-8');
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>', 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] KAI Manager RBAC & SMTP Server running at http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
  console.log('[Server] Default login credentials:');
  console.log('  Admin: admin / admin');
  console.log('  Manager: manager / 123');
  console.log('  Receptionist: receptionist / 123');
  console.log('  Viewer: viewer / 123');
});