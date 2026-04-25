const API = '';
let currentTab = 'students';
let editingId = null;
let editingType = null;

document.querySelectorAll('.nav__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav__btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    document.getElementById(`panel-${currentTab}`).classList.add('active');
    if (currentTab === 'enrollments') loadEnrollments();
  });
});

async function loadStudents() {
  try {
    const res = await fetch(`${API}/api/students`);
    const students = await res.json();
    const tbody = document.getElementById('students-tbody');
    const empty = document.getElementById('students-empty');
    document.getElementById('stat-total-students').textContent = students.length;

    if (students.length === 0) {
      tbody.innerHTML = '';
      empty.classList.add('visible');
      return;
    }
    empty.classList.remove('visible');
    tbody.innerHTML = students.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.email)}</td>
        <td>${esc(s.program || '—')}</td>
        <td>${s.semester || '—'}</td>
        <td class="action-btns">
          <button class="btn btn--sm btn--edit" onclick="editStudent(${s.id})">Edit</button>
          <button class="btn btn--sm btn--danger" onclick="deleteStudent(${s.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast('Failed to load students', 'error'); }
}

async function loadCourses() {
  try {
    const res = await fetch(`${API}/api/courses`);
    const courses = await res.json();
    const tbody = document.getElementById('courses-tbody');
    const empty = document.getElementById('courses-empty');
    document.getElementById('stat-total-courses').textContent = courses.length;

    if (courses.length === 0) {
      tbody.innerHTML = '';
      empty.classList.add('visible');
      return;
    }
    empty.classList.remove('visible');
    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${esc(c.title)}</td>
        <td>${c.credits || '—'}</td>
        <td>${esc(c.instructor || '—')}</td>
        <td class="action-btns">
          <button class="btn btn--sm btn--edit" onclick="editCourse(${c.id})">Edit</button>
          <button class="btn btn--sm btn--danger" onclick="deleteCourse(${c.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast('Failed to load courses', 'error'); }
}

async function loadEnrollments() {
  try {
    const res = await fetch(`${API}/api/enrollments`);
    const enrollments = await res.json();
    const tbody = document.getElementById('enrollments-tbody');
    const empty = document.getElementById('enrollments-empty');

    if (enrollments.length === 0) {
      tbody.innerHTML = '';
      empty.classList.add('visible');
      return;
    }
    empty.classList.remove('visible');
    tbody.innerHTML = enrollments.map(e => `
      <tr>
        <td>${e.student ? esc(e.student.name) : '<em>Deleted</em>'}</td>
        <td>${e.course ? `${esc(e.course.code)} — ${esc(e.course.title)}` : '<em>Deleted</em>'}</td>
        <td>${new Date(e.enrolledAt).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</td>
        <td class="action-btns">
          <button class="btn btn--sm btn--danger" onclick="deleteEnrollment(${e.id})">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { showToast('Failed to load enrollments', 'error'); }
}

function openModal(type, data = null) {
  editingType = type;
  editingId = data ? data.id : null;
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (type === 'student') {
    title.textContent = data ? 'Edit Student' : 'Add Student';
    body.innerHTML = `
      <div class="form-group"><label>Full Name</label><input id="f-name" required value="${data ? esc(data.name) : ''}" placeholder="e.g. John Doe"></div>
      <div class="form-group"><label>Email</label><input id="f-email" type="email" required value="${data ? esc(data.email) : ''}" placeholder="john@example.com"></div>
      <div class="form-group"><label>Program</label><input id="f-program" value="${data ? esc(data.program||'') : ''}" placeholder="e.g. Computer Science"></div>
      <div class="form-group"><label>Semester</label><input id="f-semester" type="number" min="1" max="12" value="${data ? data.semester||'' : ''}" placeholder="e.g. 4"></div>
    `;
  } else if (type === 'course') {
    title.textContent = data ? 'Edit Course' : 'Add Course';
    body.innerHTML = `
      <div class="form-group"><label>Course Code</label><input id="f-code" required value="${data ? esc(data.code) : ''}" placeholder="e.g. CS-301"></div>
      <div class="form-group"><label>Title</label><input id="f-title" required value="${data ? esc(data.title) : ''}" placeholder="e.g. Data Structures"></div>
      <div class="form-group"><label>Credits</label><input id="f-credits" type="number" min="1" max="6" value="${data ? data.credits||'' : ''}" placeholder="e.g. 3"></div>
      <div class="form-group"><label>Instructor</label><input id="f-instructor" value="${data ? esc(data.instructor||'') : ''}" placeholder="e.g. Dr. Smith"></div>
    `;
  } else if (type === 'enrollment') {
    title.textContent = 'Enroll Student';
    body.innerHTML = `
      <div class="form-group"><label>Student</label><select id="f-student" required><option value="">Loading…</option></select></div>
      <div class="form-group"><label>Course</label><select id="f-course" required><option value="">Loading…</option></select></div>
    `;
    populateEnrollmentDropdowns();
  }
  overlay.classList.add('open');
  setTimeout(() => { const first = body.querySelector('input, select'); if (first) first.focus(); }, 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null; editingType = null;
}

async function populateEnrollmentDropdowns() {
  try {
    const [studentsRes, coursesRes] = await Promise.all([
      fetch(`${API}/api/students`), fetch(`${API}/api/courses`)
    ]);
    const students = await studentsRes.json();
    const courses = await coursesRes.json();

    const ss = document.getElementById('f-student');
    ss.innerHTML = '<option value="">Select student…</option>' + students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.email)})</option>`).join('');

    const cs = document.getElementById('f-course');
    cs.innerHTML = '<option value="">Select course…</option>' + courses.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('');
  } catch (err) { showToast('Failed to load dropdown data', 'error'); }
}

async function handleSubmit(e) {
  e.preventDefault();
  try {
    let url, method, payload;
    if (editingType === 'student') {
      payload = {
        name: document.getElementById('f-name').value,
        email: document.getElementById('f-email').value,
        program: document.getElementById('f-program').value,
        semester: parseInt(document.getElementById('f-semester').value) || 1
      };
      url = editingId ? `${API}/api/students/${editingId}` : `${API}/api/students`;
      method = editingId ? 'PUT' : 'POST';
    } else if (editingType === 'course') {
      payload = {
        code: document.getElementById('f-code').value,
        title: document.getElementById('f-title').value,
        credits: parseInt(document.getElementById('f-credits').value) || 3,
        instructor: document.getElementById('f-instructor').value
      };
      url = editingId ? `${API}/api/courses/${editingId}` : `${API}/api/courses`;
      method = editingId ? 'PUT' : 'POST';
    } else if (editingType === 'enrollment') {
      payload = {
        student: document.getElementById('f-student').value,
        course: document.getElementById('f-course').value
      };
      url = `${API}/api/enrollments`;
      method = 'POST';
    }

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }

    closeModal();
    showToast(editingId ? 'Updated successfully!' : 'Created successfully!', 'success');
    loadStudents(); loadCourses();
    if (currentTab === 'enrollments') loadEnrollments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editStudent(id) {
  const res = await fetch(`${API}/api/students`);
  const students = await res.json();
  const s = students.find(x => x.id === id);
  if (s) openModal('student', s);
}

async function editCourse(id) {
  const res = await fetch(`${API}/api/courses`);
  const courses = await res.json();
  const c = courses.find(x => x.id === id);
  if (c) openModal('course', c);
}

async function deleteStudent(id) {
  if (!confirm('Delete this student?')) return;
  await fetch(`${API}/api/students/${id}`, { method: 'DELETE' });
  showToast('Student deleted', 'success');
  loadStudents();
}

async function deleteCourse(id) {
  if (!confirm('Delete this course?')) return;
  await fetch(`${API}/api/courses/${id}`, { method: 'DELETE' });
  showToast('Course deleted', 'success');
  loadCourses();
}

async function deleteEnrollment(id) {
  if (!confirm('Remove this enrollment?')) return;
  await fetch(`${API}/api/enrollments/${id}`, { method: 'DELETE' });
  showToast('Enrollment removed', 'success');
  loadEnrollments();
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

loadStudents();
loadCourses();
