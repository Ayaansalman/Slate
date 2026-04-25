const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'slate.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      program TEXT DEFAULT '',
      semester INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      credits INTEGER DEFAULT 3,
      instructor TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(student_id, course_id)
    )
  `);

  saveDB();
  console.log('✅ SQLite database ready at', DB_PATH);
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function runSQL(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

app.get('/api/students', (req, res) => {
  const students = queryAll('SELECT * FROM students ORDER BY created_at DESC');
  res.json(students);
});

app.post('/api/students', (req, res) => {
  try {
    const { name, email, program, semester } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
    runSQL('INSERT INTO students (name, email, program, semester) VALUES (?, ?, ?, ?)', [name, email, program || '', semester || 1]);
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    const student = queryOne('SELECT * FROM students WHERE id = ?', [id]);
    res.status(201).json(student);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/students/:id', (req, res) => {
  try {
    const { name, email, program, semester } = req.body;
    const existing = queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    runSQL('UPDATE students SET name=?, email=?, program=?, semester=? WHERE id=?', [name, email, program || '', semester || 1, req.params.id]);
    const student = queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', (req, res) => {
  const existing = queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Student not found' });
  runSQL('DELETE FROM enrollments WHERE student_id = ?', [req.params.id]);
  runSQL('DELETE FROM students WHERE id = ?', [req.params.id]);
  res.json({ message: 'Student deleted' });
});

app.get('/api/courses', (req, res) => {
  const courses = queryAll('SELECT * FROM courses ORDER BY created_at DESC');
  res.json(courses);
});

app.post('/api/courses', (req, res) => {
  try {
    const { code, title, credits, instructor } = req.body;
    if (!code || !title) return res.status(400).json({ error: 'Code and title are required' });
    runSQL('INSERT INTO courses (code, title, credits, instructor) VALUES (?, ?, ?, ?)', [code, title, credits || 3, instructor || '']);
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [id]);
    res.status(201).json(course);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Course code already exists' });
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/courses/:id', (req, res) => {
  try {
    const { code, title, credits, instructor } = req.body;
    const existing = queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Course not found' });
    runSQL('UPDATE courses SET code=?, title=?, credits=?, instructor=? WHERE id=?', [code, title, credits || 3, instructor || '', req.params.id]);
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/courses/:id', (req, res) => {
  const existing = queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Course not found' });
  runSQL('DELETE FROM enrollments WHERE course_id = ?', [req.params.id]);
  runSQL('DELETE FROM courses WHERE id = ?', [req.params.id]);
  res.json({ message: 'Course deleted' });
});

app.get('/api/enrollments', (req, res) => {
  const enrollments = queryAll(`
    SELECT e.id, e.enrolled_at,
           s.id as student_id, s.name as student_name, s.email as student_email,
           c.id as course_id, c.code as course_code, c.title as course_title
    FROM enrollments e
    LEFT JOIN students s ON e.student_id = s.id
    LEFT JOIN courses c ON e.course_id = c.id
    ORDER BY e.enrolled_at DESC
  `);

  res.json(enrollments.map(e => ({
    id: e.id,
    enrolledAt: e.enrolled_at,
    student: e.student_id ? { id: e.student_id, name: e.student_name, email: e.student_email } : null,
    course: e.course_id ? { id: e.course_id, code: e.course_code, title: e.course_title } : null
  })));
});

app.post('/api/enrollments', (req, res) => {
  try {
    const { student, course } = req.body;
    if (!student || !course) return res.status(400).json({ error: 'Student and course are required' });
    runSQL('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)', [student, course]);
    res.status(201).json({ message: 'Enrolled successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Student is already enrolled in this course' });
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/enrollments/:id', (req, res) => {
  const existing = queryOne('SELECT * FROM enrollments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Enrollment not found' });
  runSQL('DELETE FROM enrollments WHERE id = ?', [req.params.id]);
  res.json({ message: 'Enrollment removed' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Slate server running on http://localhost:${PORT}`);
  });
});
