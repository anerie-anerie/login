let selectedColor = '#e74c3c'; // Default selected rainbow color (Red)

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

const rainbowColors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];

// Replace the DOMContentLoaded listener and course functions in dashboard.js with these:

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
            customPicker?.parentElement.classList.remove('active');
            
            e.target.classList.add('active');
            selectedColor = e.target.getAttribute('data-color');
        }
    });

    // Custom Color Input Handler
    customPicker?.addEventListener('input', (e) => {
        document.querySelectorAll('#colorPalette .swatch').forEach(s => s.classList.remove('active'));
        customPicker.parentElement.classList.add('active');
        selectedColor = e.target.value;
    });
});

// Updated Inline Editing for Courses with Custom Color option
function editCourseInline(index) {
    const tbody = document.getElementById('courseTableBody');
    const row = tbody.rows[index];
    const item = appData.courses[index];

    const swatchesHtml = rainbowColors.map(col => `
        <button type="button" 
                class="swatch ${item.color === col ? 'active' : ''}" 
                style="background-color: ${col};" 
                onclick="setEditColor(${index}, '${col}', event)">
        </button>
    `).join('');

    const isCustom = !rainbowColors.includes(item.color);

    row.innerHTML = `
        <td>
            <div class="color-palette" id="edit-palette-${index}">
                ${swatchesHtml}
                <div class="custom-swatch-wrapper ${isCustom ? 'active' : ''}" title="Custom Color">
                    <input type="color" 
                           id="edit-custom-picker-${index}" 
                           value="${item.color || '#3498db'}" 
                           oninput="setEditCustomColor(${index}, this.value)">
                </div>
            </div>
            <input type="hidden" id="edit-color-${index}" value="${item.color || '#3498db'}">
        </td>
        <td><input type="text" id="edit-code-${index}" value="${item.code}"></td>
        <td><input type="text" id="edit-name-${index}" value="${item.name}"></td>
        <td><input type="text" id="edit-desc-${index}" value="${item.desc || ''}"></td>
        <td><input type="text" id="edit-tech-${index}" value="${item.technique || ''}"></td>
        <td>
            <button onclick="saveCourseInline(${index})" class="btn-save">Save</button>
            <button onclick="renderCourses()" class="btn-cancel">Cancel</button>
        </td>
    `;
}

function setEditColor(index, color, event) {
    document.getElementById(`edit-color-${index}`).value = color;
    const palette = document.getElementById(`edit-palette-${index}`);
    palette.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    palette.querySelector('.custom-swatch-wrapper').classList.remove('active');
    event.target.classList.add('active');
}

function setEditCustomColor(index, color) {
    document.getElementById(`edit-color-${index}`).value = color;
    const palette = document.getElementById(`edit-palette-${index}`);
    palette.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    palette.querySelector('.custom-swatch-wrapper').classList.add('active');
}

// ==========================================
// MONGO API INTEGRATION
// ==========================================

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
        console.error("Error saving data to MongoDB:", err);
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
        console.error("Error loading data from MongoDB:", err);
    }
    renderAll();
}

function renderAll() {
    renderCourses();
    renderAssignments();
    renderSchedule();
}

// Helper: Get Course Color
function getCourseColor(code) {
    const course = appData.courses.find(c => c.code === code);
    return course && course.color ? course.color : '#3498db';
}

// ==========================================
// DATE HELPERS
// ==========================================

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

// ==========================================
// COURSES
// ==========================================

function addCourse(e) {
    e.preventDefault();
    const code = document.getElementById('courseCode').value.trim();
    const name = document.getElementById('courseName').value.trim();
    const desc = document.getElementById('courseDesc').value.trim();
    const technique = document.getElementById('courseTechnique').value.trim();

    if (!code || !name) return;

    appData.courses.push({ code, name, desc, technique, color: selectedColor });
    saveData();
    renderAll();
    e.target.reset();
}

function editCourseInline(index) {
    const tbody = document.getElementById('courseTableBody');
    const row = tbody.rows[index];
    const item = appData.courses[index];

    const swatchesHtml = rainbowColors.map(col => `
        <button type="button" 
                class="swatch ${item.color === col ? 'active' : ''}" 
                style="background-color: ${col};" 
                onclick="setEditColor(${index}, '${col}')">
        </button>
    `).join('');

    row.innerHTML = `
        <td>
            <div class="color-palette" id="edit-palette-${index}">${swatchesHtml}</div>
            <input type="hidden" id="edit-color-${index}" value="${item.color || '#3498db'}">
        </td>
        <td><input type="text" id="edit-code-${index}" value="${item.code}"></td>
        <td><input type="text" id="edit-name-${index}" value="${item.name}"></td>
        <td><input type="text" id="edit-desc-${index}" value="${item.desc || ''}"></td>
        <td><input type="text" id="edit-tech-${index}" value="${item.technique || ''}"></td>
        <td>
            <button onclick="saveCourseInline(${index})" class="btn-save">Save</button>
            <button onclick="renderCourses()" class="btn-cancel">Cancel</button>
        </td>
    `;
}

function setEditColor(index, color) {
    document.getElementById(`edit-color-${index}`).value = color;
    const palette = document.getElementById(`edit-palette-${index}`);
    palette.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
}

function saveCourseInline(index) {
    const code = document.getElementById(`edit-code-${index}`).value.trim();
    const name = document.getElementById(`edit-name-${index}`).value.trim();
    const desc = document.getElementById(`edit-desc-${index}`).value.trim();
    const technique = document.getElementById(`edit-tech-${index}`).value.trim();
    const color = document.getElementById(`edit-color-${index}`).value;

    if (!code || !name) return;

    appData.courses[index] = { code, name, desc, technique, color };
    saveData();
    renderAll();
}

function deleteCourse(index) {
    appData.courses.splice(index, 1);
    saveData();
    renderAll();
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
            <td><span class="color-badge" style="background-color: ${c.color || '#3498db'};"></span></td>
            <td>${c.code}</td>
            <td>${c.name}</td>
            <td>${c.desc || '-'}</td>
            <td>${c.technique || '-'}</td>
            <td>
                <button onclick="editCourseInline(${idx})" class="btn-edit">Edit</button>
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

// ==========================================
// ASSIGNMENTS
// ==========================================

function addAssignment(e) {
    e.preventDefault();
    const subject = document.getElementById('assignSubject').value;
    const name = document.getElementById('assignName').value.trim();
    const dueDate = document.getElementById('assignDueDate').value;

    if (!subject || !name || !dueDate) return;

    appData.assignments.push({ subject, name, dueDate });
    saveData();
    renderAll();
    e.target.reset();
}

function editAssignmentInline(index) {
    const tbody = document.getElementById('assignmentTableBody');
    const row = tbody.rows[index];
    const item = appData.assignments[index];

    let courseOptions = appData.courses.map(c => 
        `<option value="${c.code}" ${c.code === item.subject ? 'selected' : ''}>${c.code}</option>`
    ).join('');

    row.innerHTML = `
        <td><select id="edit-assign-subj-${index}">${courseOptions}</select></td>
        <td><input type="text" id="edit-assign-name-${index}" value="${item.name}"></td>
        <td><input type="date" id="edit-assign-date-${index}" value="${item.dueDate}"></td>
        <td>
            <button onclick="saveAssignmentInline(${index})" class="btn-save">Save</button>
            <button onclick="renderAssignments()" class="btn-cancel">Cancel</button>
        </td>
    `;
}

function saveAssignmentInline(index) {
    const subject = document.getElementById(`edit-assign-subj-${index}`).value;
    const name = document.getElementById(`edit-assign-name-${index}`).value.trim();
    const dueDate = document.getElementById(`edit-assign-date-${index}`).value;

    if (!subject || !name || !dueDate) return;

    appData.assignments[index] = { subject, name, dueDate };
    saveData();
    renderAll();
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
                <button onclick="editAssignmentInline(${idx})" class="btn-edit">Edit</button>
                <button onclick="deleteAssignment(${idx})" class="btn-delete">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// WEEKLY SCHEDULE
// ==========================================

function renderSchedule() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    days.forEach(day => {
        const deadlinesContainer = document.getElementById(`${day}-deadlines`);
        const homeworkContainer = document.getElementById(`${day}-homework`);
        if (!deadlinesContainer || !homeworkContainer) return;

        deadlinesContainer.innerHTML = '';
        homeworkContainer.innerHTML = '';

        // 1. FILTERED ASSIGNMENTS FOR CURRENT WEEK (Solid color card, no subject text)
        const currentWeekAssignments = appData.assignments.filter(a => {
            return isDateInCurrentWeek(a.dueDate) && getDayNameFromDate(a.dueDate) === day;
        });

        currentWeekAssignments.forEach(a => {
            const courseColor = getCourseColor(a.subject);
            const div = document.createElement('div');
            div.className = 'task-item deadline-item auto-generated';
            div.style.backgroundColor = courseColor;
            div.innerHTML = `<span>${a.name}</span>`;
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

        // 3. MANUAL HOMEWORK / TASKS
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
    const autoDeadlinesCount = appData.assignments.filter(a => isDateInCurrentWeek(a.dueDate) && getDayNameFromDate(a.dueDate) === day).length;

    const totalTasks = dayData.deadlines.length + dayData.homework.length + autoDeadlinesCount;
    const completedTasks = dayData.deadlines.filter(t => t.completed).length + dayData.homework.filter(t => t.completed).length;

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
    window.location.href = "/login";
}