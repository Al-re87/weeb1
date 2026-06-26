/* ============================================================
   الجدول الذكي للجامعة — script.js
   Fixed for GitHub Pages:
   - Removed unused variable (COLS)
   - Time labels rendered as two <span> elements (no \n hack)
   - Safe template literals with escapeHtml on all user input
   - localStorage wrapped in try/catch for private browsing mode
   ============================================================ */

// ---------- TIME SLOTS ----------
// Each entry: [start, end] displayed as two lines in the time-label cell
var TIME_SLOTS = [
  ['08:00', '09:00'],
  ['09:00', '10:00'],
  ['10:00', '11:00'],
  ['11:00', '12:00'],
  ['12:00', '13:00'],
  ['13:00', '14:00'],
  ['14:00', '15:00'],
  ['15:00', '16:00'],
  ['16:00', '17:00'],
  ['17:00', '18:00'],
];

var DAYS_COUNT = 5;  // Sunday → Thursday

// Colour index cycles 0-4 for course cards
var colorIndex = 0;

// ---------- STATE ----------
var courses = []; // [{ id, name, instructor, room, day, time, color }]
var todos   = []; // [{ id, text, done }]

// ---------- DOM REFERENCES ----------
var scheduleGrid  = document.getElementById('scheduleGrid');
var emptySchedule = document.getElementById('emptySchedule');
var todoList      = document.getElementById('todoList');
var emptyTodo     = document.getElementById('emptyTodo');
var modalOverlay  = document.getElementById('modalOverlay');
var openModalBtn  = document.getElementById('openModalBtn');
var closeModalBtn = document.getElementById('closeModalBtn');
var saveCourseBtn = document.getElementById('saveCourseBtn');
var addTodoBtn    = document.getElementById('addTodoBtn');
var todoInput     = document.getElementById('todoInput');
var formError     = document.getElementById('formError');
var toastEl       = document.getElementById('toast');

// Form fields
var inpCourseName = document.getElementById('courseName');
var inpInstructor = document.getElementById('instructor');
var inpRoom       = document.getElementById('room');
var inpDay        = document.getElementById('daySelect');
var inpTime       = document.getElementById('timeSelect');

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', function () {
  loadFromStorage();
  buildGrid();
  renderAllCourses();
  renderTodos();
  bindEvents();
});

/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function saveToStorage() {
  try {
    localStorage.setItem('smart_courses', JSON.stringify(courses));
    localStorage.setItem('smart_todos',   JSON.stringify(todos));
  } catch (e) {
    // Private browsing or storage disabled — silently ignore
  }
}

function loadFromStorage() {
  try {
    var c = localStorage.getItem('smart_courses');
    var t = localStorage.getItem('smart_todos');
    if (c) courses = JSON.parse(c);
    if (t) todos   = JSON.parse(t);

    // Restore colorIndex so new courses continue the colour cycle
    if (courses.length > 0) {
      var maxColor = 0;
      for (var i = 0; i < courses.length; i++) {
        if (courses[i].color > maxColor) maxColor = courses[i].color;
      }
      colorIndex = (maxColor + 1) % 5;
    }
  } catch (e) {
    courses = [];
    todos   = [];
  }
}

/* ============================================================
   SCHEDULE GRID
   ============================================================ */

/**
 * Builds the grid skeleton: 10 time rows × 5 day columns.
 * Day header row already exists in the HTML.
 * FIX: Uses two <span> elements instead of \n for time display.
 */
function buildGrid() {
  for (var rowIndex = 0; rowIndex < TIME_SLOTS.length; rowIndex++) {
    var slot = TIME_SLOTS[rowIndex];

    // Time label cell (two spans instead of \n)
    var timeCell = document.createElement('div');
    timeCell.className = 'time-label';

    var spanStart = document.createElement('span');
    spanStart.textContent = slot[0];

    var spanSep = document.createElement('span');
    spanSep.className = 'time-sep';
    spanSep.textContent = '|';

    var spanEnd = document.createElement('span');
    spanEnd.textContent = slot[1];

    timeCell.appendChild(spanStart);
    timeCell.appendChild(spanSep);
    timeCell.appendChild(spanEnd);
    scheduleGrid.appendChild(timeCell);

    // 5 day cells for this row
    for (var dayIndex = 0; dayIndex < DAYS_COUNT; dayIndex++) {
      var cell = document.createElement('div');
      cell.className = 'sched-cell';
      cell.setAttribute('data-day',  dayIndex);
      cell.setAttribute('data-time', rowIndex);
      scheduleGrid.appendChild(cell);
    }
  }
}

/** Clears all cards and re-renders saved courses */
function renderAllCourses() {
  var cells = document.querySelectorAll('.sched-cell');
  for (var i = 0; i < cells.length; i++) {
    cells[i].innerHTML = '';
  }
  for (var j = 0; j < courses.length; j++) {
    placeCourseInGrid(courses[j]);
  }
  updateScheduleEmptyState();
}

/** Inserts a course card into the matching grid cell */
function placeCourseInGrid(course) {
  var cell = document.querySelector(
    '.sched-cell[data-day="' + course.day + '"][data-time="' + course.time + '"]'
  );
  if (!cell) return;

  var card = document.createElement('div');
  card.className = 'course-card';
  card.setAttribute('data-color', course.color);
  card.setAttribute('data-id',    course.id);

  // Build card content safely using DOM (avoids innerHTML injection risk)
  var delBtn = document.createElement('button');
  delBtn.className = 'card-delete';
  delBtn.title = 'حذف المادة';
  delBtn.setAttribute('data-id', course.id);
  delBtn.textContent = '\u2715'; // ✕

  var nameSpan = document.createElement('span');
  nameSpan.className = 'course-name';
  nameSpan.textContent = course.name;

  var metaDiv = document.createElement('div');
  metaDiv.className = 'course-meta';

  if (course.instructor) {
    var instrSpan = document.createElement('span');
    instrSpan.textContent = '\uD83D\uDC64 ' + course.instructor; // 👤
    metaDiv.appendChild(instrSpan);
  }
  if (course.room) {
    var roomSpan = document.createElement('span');
    roomSpan.textContent = '\uD83D\uDCCD ' + course.room; // 📍
    metaDiv.appendChild(roomSpan);
  }

  card.appendChild(delBtn);
  card.appendChild(nameSpan);
  card.appendChild(metaDiv);
  cell.appendChild(card);
}

function updateScheduleEmptyState() {
  if (courses.length === 0) {
    emptySchedule.classList.add('visible');
  } else {
    emptySchedule.classList.remove('visible');
  }
}

/* ============================================================
   COURSES: ADD & DELETE
   ============================================================ */

function addCourse() {
  var name = inpCourseName.value.trim();
  var day  = inpDay.value;
  var time = inpTime.value;

  if (!name) {
    showFormError('يرجى إدخال اسم المادة');
    inpCourseName.focus();
    return;
  }
  if (day === '') {
    showFormError('يرجى اختيار اليوم');
    return;
  }
  if (time === '') {
    showFormError('يرجى اختيار وقت المحاضرة');
    return;
  }

  // Check for time slot conflict
  for (var i = 0; i < courses.length; i++) {
    if (courses[i].day === Number(day) && courses[i].time === Number(time)) {
      showFormError('هذا الوقت محجوز لمادة: ' + courses[i].name);
      return;
    }
  }

  var course = {
    id:         Date.now(),
    name:       name,
    instructor: inpInstructor.value.trim(),
    room:       inpRoom.value.trim(),
    day:        Number(day),
    time:       Number(time),
    color:      colorIndex,
  };

  colorIndex = (colorIndex + 1) % 5;

  courses.push(course);
  saveToStorage();
  placeCourseInGrid(course);
  updateScheduleEmptyState();
  closeModal();
  showToast('\u2705 تمت إضافة "' + course.name + '" بنجاح'); // ✅
}

function deleteCourse(id) {
  courses = courses.filter(function (c) { return c.id !== id; });
  saveToStorage();

  var card = document.querySelector('.course-card[data-id="' + id + '"]');
  if (card) {
    card.style.transition = 'all 0.2s ease';
    card.style.transform  = 'scale(0)';
    card.style.opacity    = '0';
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 210);
  }

  updateScheduleEmptyState();
  showToast('\uD83D\uDDD1\uFE0F تم حذف المادة'); // 🗑️
}

/* ============================================================
   TO-DO LIST
   ============================================================ */

function addTodo() {
  var text = todoInput.value.trim();
  if (!text) {
    todoInput.focus();
    return;
  }

  var todo = { id: Date.now(), text: text, done: false };
  todos.push(todo);
  saveToStorage();
  renderTodoItem(todo);
  updateTodoEmptyState();

  todoInput.value = '';
  todoInput.focus();
  showToast('\uD83D\uDCDD تمت إضافة المهمة', 'teal'); // 📝
}

function renderTodos() {
  todoList.innerHTML = '';
  for (var i = 0; i < todos.length; i++) {
    renderTodoItem(todos[i]);
  }
  updateTodoEmptyState();
}

/** Creates a <li> for one todo and appends it to the list */
function renderTodoItem(todo) {
  var li = document.createElement('li');
  li.className = 'todo-item' + (todo.done ? ' done' : '');
  li.setAttribute('data-id', todo.id);

  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = todo.done;
  checkbox.setAttribute('aria-label', 'تم إنجاز المهمة');

  var textSpan = document.createElement('span');
  textSpan.className = 'todo-text';
  textSpan.textContent = todo.text;

  var delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger todo-del-btn';
  delBtn.title = 'حذف المهمة';
  delBtn.textContent = 'حذف';

  li.appendChild(checkbox);
  li.appendChild(textSpan);
  li.appendChild(delBtn);
  todoList.appendChild(li);
}

function toggleTodo(id, done) {
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      todos[i].done = done;
      break;
    }
  }
  saveToStorage();

  var li = todoList.querySelector('[data-id="' + id + '"]');
  if (li) li.classList.toggle('done', done);
}

function deleteTodo(id) {
  todos = todos.filter(function (t) { return t.id !== id; });
  saveToStorage();

  var li = todoList.querySelector('[data-id="' + id + '"]');
  if (li) {
    li.style.transition = 'all 0.2s ease';
    li.style.opacity    = '0';
    li.style.transform  = 'translateX(-12px)';
    setTimeout(function () {
      if (li.parentNode) li.parentNode.removeChild(li);
      updateTodoEmptyState();
    }, 210);
  }
}

function updateTodoEmptyState() {
  if (todos.length === 0) {
    emptyTodo.classList.add('visible');
  } else {
    emptyTodo.classList.remove('visible');
  }
}

/* ============================================================
   MODAL
   ============================================================ */

function openModal() {
  clearForm();
  modalOverlay.classList.add('open');
  setTimeout(function () { inpCourseName.focus(); }, 50);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  clearForm();
}

function clearForm() {
  inpCourseName.value  = '';
  inpInstructor.value  = '';
  inpRoom.value        = '';
  inpDay.value         = '';
  inpTime.value        = '';
  formError.textContent = '';
}

function showFormError(msg) {
  formError.textContent = msg;
}

/* ============================================================
   TOAST
   ============================================================ */

var toastTimer = null;

function showToast(message, type) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className   = 'toast' + (type ? ' ' + type : '');

  // Force reflow to restart CSS transition
  void toastEl.offsetWidth;
  toastEl.classList.add('show');

  toastTimer = setTimeout(function () {
    toastEl.classList.remove('show');
  }, 2800);
}

/* ============================================================
   EVENT BINDING
   ============================================================ */

function bindEvents() {

  // Modal open / close
  openModalBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  // Save course
  saveCourseBtn.addEventListener('click', addCourse);

  // Enter key on text fields triggers save
  var textFields = [inpCourseName, inpInstructor, inpRoom];
  for (var i = 0; i < textFields.length; i++) {
    textFields[i].addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addCourse();
    });
  }

  // Delete course card (event delegation)
  scheduleGrid.addEventListener('click', function (e) {
    var btn = e.target;
    // Walk up to find .card-delete if a child was clicked
    while (btn && btn !== scheduleGrid) {
      if (btn.classList.contains('card-delete')) {
        deleteCourse(Number(btn.getAttribute('data-id')));
        return;
      }
      btn = btn.parentNode;
    }
  });

  // Add todo
  addTodoBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addTodo();
  });

  // Toggle / delete todo (event delegation)
  todoList.addEventListener('change', function (e) {
    if (e.target.classList.contains('todo-checkbox')) {
      var li = e.target.parentNode;
      if (li) toggleTodo(Number(li.getAttribute('data-id')), e.target.checked);
    }
  });

  todoList.addEventListener('click', function (e) {
    if (e.target.classList.contains('todo-del-btn')) {
      var li = e.target.parentNode;
      if (li) deleteTodo(Number(li.getAttribute('data-id')));
    }
  });
}
