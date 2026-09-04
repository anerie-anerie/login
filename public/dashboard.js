let selectedColor = '#FFA09F'; // matches the first swatch, which starts with class="active"
let editingCourseIndex = null; // Track if we are editing an existing course
let editingAssignmentIndex = null; // Track if we are editing an existing assignment

let calendarView = false;
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();

let appData = {
    courses: [],
    assignments: [],
    schedule: {
        Monday: { deadlines: [], homework: [] },
        Tuesday: { deadlines: [], homework: [] },
        Wednesday: { deadlines: [], homework: [] },
        Thursday: { deadlines: [], homework: [] },
        Friday: { deadlines: [], homework: [] },
        Saturday: { deadlines: [], homework: [] },
        Sunday: { deadlines: [], homework: [] }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('courseForm')?.addEventListener('submit', addCourse);
    document.getElementById('assignmentForm')?.addEventListener('submit', addAssignment);

    const palette = document.getElementById('colorPalette');
    const customPicker = document.getElementById('customColorPicker');

    // Preset Swatch Click Handler
    palette?.addEventListener('click', (e) => {
        if (e.target.classList.contains('swatch')) {
            document.querySelectorAll('#colorPalette .swatch').forEach(s => s.classList.remove('active'));
            document.getElementById('customPickerWrapper')?.classList.remove('active');

            e.target.classList.add('active');
            selectedColor = e.target.getAttribute('data-color');
        }
    });

    // Custom Color Input (Color Wheel Emoji) Handler
    customPicker?.addEventListener('input', (e) => {
        document.querySelectorAll('#colorPalette .swatch').forEach(s => s.classList.remove('active'));
        document.getElementById('customPickerWrapper')?.classList.add('active');
        selectedColor = e.target.value;
    });
});

// ---------- text safety + hyperlink support ----------
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Escapes text first (so nothing typed can inject HTML), then turns any URL-looking
// substring into a real clickable link. Safe to use anywhere user-typed text is displayed.
function linkify(str) {
    const escaped = escapeHtml(str);
    const combinedRegex = /\[([^\[\]]+)\]\((https?:\/\/[^\s()]+|www\.[^\s()]+)\)|((?:https?:\/\/|www\.)[^\s<]+)/g;

    return escaped.replace(combinedRegex, (match, label, mdUrl, bareUrl) => {
        if (label && mdUrl) {
            const href = mdUrl.startsWith('http') ? mdUrl : `https://${mdUrl}`;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="task-link" onclick="event.stopPropagation()">${label}</a>`;
        }
        if (bareUrl) {
            const href = bareUrl.startsWith('http') ? bareUrl : `https://${bareUrl}`;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="task-link" onclick="event.stopPropagation()">${bareUrl}</a>`;
        }
        return match;
    });
}


async function saveData() {
    if (!window.currentUser) return;
    try {
        await fetch('/api/save-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: window.currentUser,
                appData: appData
            })
        });
    } catch (err) {
        console.error("Error saving data:", err);
    }
}

async function loadData() {
    if (!window.currentUser) return;
    try {
        const response = await fetch(`/api/user-data/${window.currentUser}`);
        if (response.ok) {
            const data = await response.json();
            if (data.courses) appData.courses = data.courses;
            if (data.assignments) appData.assignments = data.assignments;
            if (data.schedule && Object.keys(data.schedule).length > 0) {
                appData.schedule = { ...appData.schedule, ...data.schedule };
            }
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
    renderAll();
}

function renderAll() {
    renderCourses();
    renderAssignments();
    renderSchedule();
}

function getCourseColor(code) {
    const course = appData.courses.find(c => c.code === code);
    return course && course.color ? course.color : '#FFA09F';
}

function getCurrentWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
}

function isDateInCurrentWeek(dateStr) {
    if (!dateStr) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const { monday, sunday } = getCurrentWeekRange();
    return targetDate >= monday && targetDate <= sunday;
}

function getDayNameFromDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[targetDate.getDay()];
}

// COURSES
function addCourse(e) {
    e.preventDefault();
    const code = document.getElementById('courseCode').value.trim();
    const name = document.getElementById('courseName').value.trim();
    const desc = document.getElementById('courseDesc').value.trim();
    const technique = document.getElementById('courseTechnique').value.trim();

    if (!code || !name) return;

    if (editingCourseIndex !== null) {
        appData.courses[editingCourseIndex] = { code, name, desc, technique, color: selectedColor };
        editingCourseIndex = null;

        const submitBtn = document.querySelector('#courseForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Course';
    } else {
        appData.courses.push({ code, name, desc, technique, color: selectedColor });
    }

    saveData();
    renderAll();
    e.target.reset();
}

function deleteCourse(index) {
    appData.courses.splice(index, 1);
    saveData();
    renderAll();
}

function editCourse(index) {
    const course = appData.courses[index];
    if (!course) return;

    document.getElementById('courseCode').value = course.code;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseDesc').value = course.desc || '';
    document.getElementById('courseTechnique').value = course.technique || '';
    selectedColor = course.color || '#FFA09F';

    editingCourseIndex = index;

    const submitBtn = document.querySelector('#courseForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Course';
}

function renderCourses() {
    const tbody = document.getElementById('courseTableBody');
    const select = document.getElementById('assignSubject');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Select Course Code</option>';
    }

    appData.courses.forEach((c, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="course-code-badge" style="background-color: ${c.color || '#FFA09F'};">${escapeHtml(c.code)}</span></td>
            <td>${escapeHtml(c.name)}</td>
            <td>${c.desc ? linkify(c.desc) : '-'}</td>
            <td>${c.technique ? escapeHtml(c.technique) : '-'}</td>
            <td>
                <button onclick="editCourse(${idx})" class="btn btn-sm btn-edit">Edit</button>
                <button onclick="deleteCourse(${idx})" class="btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);

        if (select) {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = `${c.code} - ${c.name}`;
            select.appendChild(opt);
        }
    });
}

// ASSIGNMENTS
function addAssignment(e) {
    e.preventDefault();
    const subject = document.getElementById('assignSubject').value;
    const name = document.getElementById('assignName').value.trim();
    const dueDate = document.getElementById('assignDueDate').value;

    if (!subject || !name || !dueDate) return;

    if (editingAssignmentIndex !== null) {
        const prevCompleted = appData.assignments[editingAssignmentIndex].completed;
        appData.assignments[editingAssignmentIndex] = { subject, name, dueDate, completed: prevCompleted };
        editingAssignmentIndex = null;

        const submitBtn = document.querySelector('#assignmentForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Assignment';
    } else {
        appData.assignments.push({ subject, name, dueDate, completed: false });
    }

    saveData();
    renderAll();
    e.target.reset();
}

function editAssignment(index) {
    const a = appData.assignments[index];
    if (!a) return;

    document.getElementById('assignSubject').value = a.subject;
    document.getElementById('assignName').value = a.name;
    document.getElementById('assignDueDate').value = a.dueDate;

    editingAssignmentIndex = index;

    const submitBtn = document.querySelector('#assignmentForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Assignment';
}

function toggleAssignmentCompletion(index) {
    if (appData.assignments[index]) {
        appData.assignments[index].completed = !appData.assignments[index].completed;
        saveData();
        renderAll();
    }
}

function deleteAssignment(index) {
    appData.assignments.splice(index, 1);
    saveData();
    renderAll();
}

function renderAssignments() {
    const tbody = document.getElementById('assignmentTableBody');
    if (tbody) {
        tbody.innerHTML = '';

        // soonest due date first, furthest away last
        const sortedAssignments = [...appData.assignments].sort(
            (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
        );

        sortedAssignments.forEach((a) => {
            const idx = appData.assignments.indexOf(a); // real index, so edit/delete target the right item
            const courseColor = getCourseColor(a.subject);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="subject-tag" style="background-color: ${courseColor};">${escapeHtml(a.subject)}</span></td>
                <td>${linkify(a.name)}</td>
                <td>${a.dueDate}</td>
                <td>
                    <button onclick="editAssignment(${idx})" class="btn btn-sm btn-edit">Edit</button>
                    <button onclick="deleteAssignment(${idx})" class="btn-delete">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderCalendar();
}

function toggleAssignmentView(view) {
    calendarView = view === 'calendar';
    const listEl = document.getElementById('assignmentListView');
    const calEl = document.getElementById('assignmentCalendarView');
    if (listEl) listEl.style.display = calendarView ? 'none' : 'block';
    if (calEl) calEl.style.display = calendarView ? 'block' : 'none';

    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${view}-btn`)?.classList.add('active');

    if (calendarView) renderCalendar();
}

function changeCalendarMonth(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calendarMonthLabel');
    if (!grid || !label) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    label.textContent = `${monthNames[calMonth]} ${calYear}`;

    grid.innerHTML = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = d;
        grid.appendChild(h);
    });

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-cell empty';
        grid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayNum = document.createElement('div');
        dayNum.className = 'calendar-day-num';
        dayNum.textContent = day;
        cell.appendChild(dayNum);

        appData.assignments
            .filter(a => a.dueDate === dateStr)
            .forEach(a => {
                const chip = document.createElement('div');
                chip.className = 'calendar-chip' + (a.completed ? ' completed' : '');
                chip.style.backgroundColor = getCourseColor(a.subject);
                chip.title = `${a.subject} - ${a.name}`; // full text on hover, since the chip itself stays a fixed size
                chip.innerHTML = `<strong>${escapeHtml(a.subject)}</strong> ${linkify(a.name)}`;
                cell.appendChild(chip);
            });

        grid.appendChild(cell);
    }
}

// WEEKLY SCHEDULE
function renderSchedule() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    days.forEach(day => {
        const deadlinesContainer = document.getElementById(`${day}-deadlines`);
        const homeworkContainer = document.getElementById(`${day}-homework`);
        if (!deadlinesContainer || !homeworkContainer) return;

        deadlinesContainer.innerHTML = '';
        homeworkContainer.innerHTML = '';

        // 1. FILTERED ASSIGNMENTS FOR CURRENT WEEK (With Checkbox & Completion State)
        const currentWeekAssignments = appData.assignments
            .map((assignment, index) => ({ assignment, index }))
            .filter(({ assignment }) => {
                return isDateInCurrentWeek(assignment.dueDate) && getDayNameFromDate(assignment.dueDate) === day;
            });

        currentWeekAssignments.forEach(({ assignment, index }) => {
            const courseColor = getCourseColor(assignment.subject);
            const div = document.createElement('div');
            div.className = `task-item deadline-item auto-generated ${assignment.completed ? 'completed' : ''}`;
            div.style.backgroundColor = courseColor;
            div.innerHTML = `
                <input type="checkbox" ${assignment.completed ? 'checked' : ''} onchange="toggleAssignmentCompletion(${index})">
                <span>${linkify(assignment.name)}</span>
                <button class="delete-task-btn" onclick="deleteAssignment(${index})" title="Delete Assignment">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 2. MANUAL DEADLINES (double-click the text to edit it)
        (appData.schedule[day]?.deadlines || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item deadline-item ${task.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'deadlines', ${idx})">
                <span ondblclick="startEditManualTask('${day}', 'deadlines', ${idx}, this)">${linkify(task.text)}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'deadlines', ${idx})">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 3. MANUAL HOMEWORK (double-click the text to edit it)
        (appData.schedule[day]?.homework || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item ${task.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'homework', ${idx})">
                <span ondblclick="startEditManualTask('${day}', 'homework', ${idx}, this)">${linkify(task.text)}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'homework', ${idx})">×</button>
            `;
            homeworkContainer.appendChild(div);
        });

        updateProgress(day);
    });
}

// Turns a manual task's <span> into a text input so it can be edited in place.
// Saves on blur or Enter; pressing Escape cancels by just re-rendering the original text.
function startEditManualTask(day, type, index, spanEl) {
    const task = appData.schedule[day]?.[type]?.[index];
    if (!task) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.text;
    input.className = 'inline-edit-input';
    spanEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const commit = () => {
        if (finished) return;
        finished = true;
        const newText = input.value.trim();
        if (newText && newText !== task.text) {
            task.text = newText;
            saveData();
        }
        renderSchedule();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { finished = true; renderSchedule(); }
    });
}

function addManualTask(day, type) {
    const input = document.getElementById(`${day}-${type === 'deadlines' ? 'deadline' : 'homework'}-input`);
    if (!input || !input.value.trim()) return;

    if (!appData.schedule[day]) {
        appData.schedule[day] = { deadlines: [], homework: [] };
    }

    appData.schedule[day][type].push({ text: input.value.trim(), completed: false });
    input.value = '';

    saveData();
    renderSchedule();
}

function toggleTask(day, type, index) {
    if (appData.schedule[day] && appData.schedule[day][type][index]) {
        appData.schedule[day][type][index].completed = !appData.schedule[day][type][index].completed;
        saveData();
        renderSchedule();
    }
}

function removeManualTask(day, type, index) {
    if (appData.schedule[day] && appData.schedule[day][type]) {
        appData.schedule[day][type].splice(index, 1);
        saveData();
        renderSchedule();
    }
}

// Clears manually-added deadlines and homework across every day of the week.
// Assignment-based deadlines are untouched since those come from the Assignments tab.
function clearWeekTasks() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    days.forEach(day => {
        appData.schedule[day] = { deadlines: [], homework: [] };
    });
    saveData();
    renderSchedule();
}

function updateProgress(day) {
    const dayData = appData.schedule[day] || { deadlines: [], homework: [] };

    const weekAssignments = appData.assignments.filter(a => isDateInCurrentWeek(a.dueDate) && getDayNameFromDate(a.dueDate) === day);
    const completedAssignments = weekAssignments.filter(a => a.completed).length;

    const totalTasks = dayData.deadlines.length + dayData.homework.length + weekAssignments.length;
    const completedTasks = dayData.deadlines.filter(t => t.completed).length + dayData.homework.filter(t => t.completed).length + completedAssignments;

    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const fillElem = document.getElementById(`${day}-progress`);
    if (fillElem) {
        fillElem.style.width = `${percentage}%`;
    }
}

function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }

    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

function logout() {
    fetch('/logout', { method: 'POST' }).finally(() => {
        window.location.href = "/login";
    });
}

