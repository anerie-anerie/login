let selectedColor = '#e74c3c'; // matches the first swatch, which starts with class="active"
let editingCourseIndex = null; // Track if we are editing an existing course

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
    return course && course.color ? course.color : '#e74c3c';
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
        // Update existing course
        appData.courses[editingCourseIndex] = { code, name, desc, technique, color: selectedColor };
        editingCourseIndex = null;

        // Reset submit button text
        const submitBtn = document.querySelector('#courseForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Course';
    } else {
        // Add new course
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

    // Fill form fields
    document.getElementById('courseCode').value = course.code;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseDesc').value = course.desc || '';
    document.getElementById('courseTechnique').value = course.technique || '';
    selectedColor = course.color || '#e74c3c';

    // Set editing state
    editingCourseIndex = index;

    // Update button text to give feedback
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
            <td><span class="color-badge" style="background-color: ${c.color || '#e74c3c'};"></span></td>
            <td>${c.code}</td>
            <td>${c.name}</td>
            <td>${c.desc || '-'}</td>
            <td>${c.technique || '-'}</td>
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

    appData.assignments.push({ subject, name, dueDate, completed: false });
    saveData();
    renderAll();
    e.target.reset();
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
    if (!tbody) return;

    tbody.innerHTML = '';

    appData.assignments.forEach((a, idx) => {
        const courseColor = getCourseColor(a.subject);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="subject-tag" style="background-color: ${courseColor};">${a.subject}</span></td>
            <td>${a.name}</td>
            <td>${a.dueDate}</td>
            <td>
                <button onclick="deleteAssignment(${idx})" class="btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
                <span>${assignment.name}</span>
                <button class="delete-task-btn" onclick="deleteAssignment(${index})" title="Delete Assignment">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 2. MANUAL DEADLINES
        (appData.schedule[day]?.deadlines || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item ${task.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'deadlines', ${idx})">
                <span>${task.text}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'deadlines', ${idx})">×</button>
            `;
            deadlinesContainer.appendChild(div);
        });

        // 3. MANUAL HOMEWORK
        (appData.schedule[day]?.homework || []).forEach((task, idx) => {
            const div = document.createElement('div');
            div.className = `task-item ${task.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${day}', 'homework', ${idx})">
                <span>${task.text}</span>
                <button class="delete-task-btn" onclick="removeManualTask('${day}', 'homework', ${idx})">×</button>
            `;
            homeworkContainer.appendChild(div);
        });

        updateProgress(day);
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