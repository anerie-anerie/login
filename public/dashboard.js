let selectedColor = '#FFA09F'; // matches the first swatch, which starts with class="active"
let editingCourseIndex = null; // Track if we are editing an existing course
let editingAssignmentIndex = null; // Track if we are editing an existing assignment

let calendarView = false;
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
    setupDragAndDrop();
    highlightToday();

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

// Escapes text first, then converts two kinds of links:
//   1. [display text](https://example.com)  -> a hyperlink showing custom text, like Google Sheets' HYPERLINK()
//   2. any bare https://... or www.... URL   -> still auto-linked as-is
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

function todayIsoDate() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Adds a highlight class to whichever day-card matches today's weekday name.
// Matches by reading each card's <h4> text, so no extra IDs need to be added to dashboard.hbs.
function highlightToday() {
    const todayName = DAY_NAMES[(new Date().getDay() + 6) % 7]; // getDay() is Sun-first; DAY_NAMES is Mon-first
    document.querySelectorAll('.day-card').forEach(card => {
        const heading = card.querySelector('h4');
        if (heading && heading.textContent.trim() === todayName) {
            card.classList.add('today-card');
        } else {
            card.classList.remove('today-card');
        }
    });
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

    const todayStr = todayIsoDate();

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
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cell.className = 'calendar-cell' + (dateStr === todayStr ? ' today-cell' : '');

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
    DAY_NAMES.forEach(day => {
        const deadlinesContainer = document.getElementById(`${day}-deadlines`);
        const homeworkContainer = document.getElementById(`${day}-homework`);
        if (!deadlinesContainer || !homeworkContainer) return;

        deadlinesContainer.innerHTML = '';
        homeworkContainer.innerHTML = '';

        // 1. FILTERED ASSIGNMENTS FOR CURRENT WEEK (With Checkbox & Completion State) - draggable to another day
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
            div.draggable = true;
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'assignment', index }));
            });
            div.innerHTML = `
                <input type="checkbox" ${assignment.completed ? 'checked' : ''} onchange="toggleAssignmentCompletion(${index})">
                <span>${linkify(assignment.name)}</span>
                <button class="delete-task-btn" onclick="deleteAssignment(${index})" title="Delete Assignment">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 2. MANUAL DEADLINES (double-click text to edit; drag to move to another day or reorder within this one)
        (appData.schedule[day]?.deadlines || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item deadline-item ${task.completed ? 'completed' : ''}`;
            attachManualDragHandlers(div, day, 'deadlines', idx);
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'deadlines', ${idx})">
                <span ondblclick="startEditManualTask('${day}', 'deadlines', ${idx}, this)">${linkify(task.text)}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'deadlines', ${idx})">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 3. MANUAL HOMEWORK (double-click text to edit; drag to move to another day or reorder within this one)
        (appData.schedule[day]?.homework || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item ${task.completed ? 'completed' : ''}`;
            attachManualDragHandlers(div, day, 'homework', idx);
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'homework', ${idx})">
                <span ondblclick="startEditManualTask('${day}', 'homework', ${idx}, this)">${linkify(task.text)}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'homework', ${idx})">×</button>
            `;
            homeworkContainer.appendChild(div);
        });

        updateProgress(day);
    });

    highlightToday();
}

// Wires up a manual task item to be draggable, and to accept drops that reorder it
// relative to itself (drop on the top half = insert before, bottom half = insert after).
function attachManualDragHandlers(div, day, type, idx) {
    div.draggable = true;

    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'manual', day, type, index: idx }));
    });

    div.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation(); // don't let the container's own dragover also fire
        const rect = div.getBoundingClientRect();
        const isAfter = (e.clientY - rect.top) > rect.height / 2;
        div.classList.toggle('drop-indicator-top', !isAfter);
        div.classList.toggle('drop-indicator-bottom', isAfter);
        div.dataset.dropPosition = isAfter ? 'after' : 'before';
    });

    div.addEventListener('dragleave', () => {
        div.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
    });

    div.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation(); // don't let the container's own drop also fire and double-move the task
        div.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
        handleItemDrop(e, day, type, idx, div.dataset.dropPosition || 'before');
    });
}

// Reorders (or moves, if coming from a different day) a manual task to sit directly
// before or after the item it was dropped on.
function handleItemDrop(e, targetDay, targetType, targetIndex, position) {
    let payload;
    try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
        return;
    }
    if (!payload || payload.kind !== 'manual' || payload.type !== targetType) return;

    const sourceList = appData.schedule[payload.day]?.[payload.type];
    if (!sourceList || !sourceList[payload.index]) return;

    const [task] = sourceList.splice(payload.index, 1);

    // account for the array shrinking by one if we removed from earlier in the same list
    let insertIndex = targetIndex;
    if (payload.day === targetDay && payload.index < targetIndex) {
        insertIndex -= 1;
    }
    if (position === 'after') insertIndex += 1;

    if (!appData.schedule[targetDay]) appData.schedule[targetDay] = { deadlines: [], homework: [] };
    appData.schedule[targetDay][targetType].splice(insertIndex, 0, task);

    saveData();
    renderSchedule();
}

// Wires up drag-and-drop onto each day's list containers, for dropping onto empty space
// (appends to the end) rather than onto a specific item (handled by attachManualDragHandlers above).
// Container divs are static in dashboard.hbs and never get replaced, only their contents
// change on re-render, so these listeners stay valid across renders.
function setupDragAndDrop() {
    DAY_NAMES.forEach(day => {
        const deadlinesContainer = document.getElementById(`${day}-deadlines`);
        const homeworkContainer = document.getElementById(`${day}-homework`);

        [[deadlinesContainer, 'deadlines'], [homeworkContainer, 'homework']].forEach(([container, type]) => {
            if (!container) return;

            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over');
            });
            container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                handleContainerDrop(e, day, type);
            });
        });
    });
}

// Handles dropping onto empty space in a day's list (not onto a specific item).
// Manual tasks get appended to the end of that list; assignment-linked deadlines get their due date changed.
function handleContainerDrop(e, targetDay, targetType) {
    let payload;
    try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
        return;
    }
    if (!payload) return;

    if (payload.kind === 'manual') {
        if (payload.type !== targetType) return; // don't let a deadline turn into homework or vice versa
        if (payload.day === targetDay) return; // dropped back in the same list with no specific position - no-op

        const sourceList = appData.schedule[payload.day]?.[payload.type];
        if (!sourceList || !sourceList[payload.index]) return;
        const [task] = sourceList.splice(payload.index, 1);

        if (!appData.schedule[targetDay]) appData.schedule[targetDay] = { deadlines: [], homework: [] };
        appData.schedule[targetDay][targetType].push(task);

        saveData();
        renderSchedule();
    } else if (payload.kind === 'assignment' && targetType === 'deadlines') {
        const assignment = appData.assignments[payload.index];
        if (!assignment) return;

        const { monday } = getCurrentWeekRange();
        const dayOffsets = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
        const newDate = new Date(monday);
        newDate.setDate(monday.getDate() + dayOffsets[targetDay]);
        assignment.dueDate = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

        saveData();
        renderAll();
    }
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
    DAY_NAMES.forEach(day => {
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