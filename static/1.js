const API_BASE = 'http://localhost:8000/tasks';

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskPriority = document.getElementById('taskPriority');
const taskDue = document.getElementById('taskDue');
const taskDesc = document.getElementById('taskDesc');
const tasksList = document.getElementById('tasksList');
const tasksHeading = document.getElementById('tasksHeading');
const statsBadge = document.getElementById('statsBadge');
const btnClearCompleted = document.getElementById('btnClearCompleted');
const toastContainer = document.getElementById('toastContainer');
const filterChips = document.querySelectorAll('.filter-chip');
const navLinks = document.querySelectorAll('.nav-link');

let tasks = [];
let currentNav = 'all';
let currentFilter = 'all';

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function isDateOverdue(dateStr) {
    if (!dateStr) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(dateStr + 'T00:00:00') < today;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getFilteredTasks() {
    let filtered = [...tasks];
    if (currentNav === 'active') filtered = filtered.filter(t => !t.completed);
    else if (currentNav === 'completed') filtered = filtered.filter(t => t.completed);
    else if (currentNav === 'high') filtered = filtered.filter(t => t.priority === 'high' && !t.completed);
    if (currentFilter === 'high') filtered = filtered.filter(t => t.priority === 'high');
    else if (currentFilter === 'medium') filtered = filtered.filter(t => t.priority === 'medium');
    else if (currentFilter === 'low') filtered = filtered.filter(t => t.priority === 'low');
    else if (currentFilter === 'overdue') {
        filtered = filtered.filter(t => !t.completed && t.due && isDateOverdue(t.due));
    }
    filtered.sort((a,b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const order = { high:0, medium:1, low:2 };
        return order[a.priority] - order[b.priority] || (a.due||'').localeCompare(b.due||'') || b.created_at - a.created_at;
    });
    return filtered;
}

function createTaskElement(task, index) {
    const div = document.createElement('div');
    div.className = 'task-item' + (task.completed ? ' completed' : '');
    div.style.animationDelay = (index * 0.04) + 's';
    const dueDateFormatted = formatDate(task.due);
    const isOverdue = !task.completed && task.due && isDateOverdue(task.due);
    div.innerHTML = `
        <div class="task-checkbox">${task.completed ? '✓' : ''}</div>
        <div class="task-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
                <span class="badge badge-${task.priority}">${{high:'Высокий',medium:'Средний',low:'Низкий'}[task.priority]}</span>
                <span class="task-due${isOverdue?' overdue':''}">${isOverdue?'⚠️ ':''}📅 ${dueDateFormatted}${isOverdue?' (просрочено)':''}</span>
                ${task.description ? `<span>💬 ${escapeHtml(task.description)}</span>` : ''}
            </div>
        </div>
        <div class="task-actions">
            <button class="btn-sm edit-btn">✏️</button>
            <button class="btn-sm danger delete-btn">🗑️</button>
        </div>`;
    div.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
    div.querySelector('.edit-btn').addEventListener('click', () => editTask(task));
    div.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
    return div;
}

function renderTasks() {
    const filtered = getFilteredTasks();
    tasksList.innerHTML = '';
    if (filtered.length === 0) {
        tasksList.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>Задач пока нет</h3><p>Добавьте первую задачу через форму выше!</p></div>`;
    } else {
        filtered.forEach((task, idx) => tasksList.appendChild(createTaskElement(task, idx)));
    }
    statsBadge.textContent = `${tasks.filter(t=>!t.completed).length} активно / ${tasks.length} всего`;
    tasksHeading.textContent = { all:'Все задачи', active:'Активные задачи', completed:'Завершённые задачи', high:'Срочные задачи' }[currentNav] || 'Все задачи';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function loadTasks() {
    try {
        const resp = await fetch(API_BASE);
        if (!resp.ok) throw new Error();
        tasks = await resp.json();
        renderTasks();
    } catch (err) {
        showToast('Ошибка загрузки задач', 'danger');
        tasks = [];
        renderTasks();
    }
}

async function addTask(title, priority, due, desc) {
    try {
        const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title.trim(), description: desc.trim(), priority, due: due || null, completed: false })
        });
        if (!resp.ok) throw new Error();
        const newTask = await resp.json();
        tasks.unshift(newTask);
        renderTasks();
        showToast('Задача добавлена!', 'success');
    } catch (err) {
        showToast('Не удалось добавить задачу', 'danger');
    }
}

async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
        const resp = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !task.completed })
        });
        if (!resp.ok) throw new Error();
        const updated = await resp.json();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx !== -1) tasks[idx] = updated;
        renderTasks();
        showToast(updated.completed ? 'Задача выполнена! 🎉' : 'Задача возвращена', 'success');
    } catch (err) {
        showToast('Ошибка обновления', 'danger');
    }
}

async function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Удалить "${task.title}"?`)) return;
    try {
        const resp = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error();
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
        showToast('Задача удалена', 'info');
    } catch (err) {
        showToast('Ошибка удаления', 'danger');
    }
}

async function editTask(task) {
    const newTitle = prompt('Название:', task.title);
    if (!newTitle || !newTitle.trim()) return;
    const newDesc = prompt('Описание:', task.description || '');
    const newDue = prompt('Дата (ГГГГ-ММ-ДД):', task.due || '');
    const newPriority = prompt('Приоритет (high/medium/low):', task.priority);
    if (newPriority && !['high','medium','low'].includes(newPriority.toLowerCase())) {
        showToast('Приоритет должен быть high/medium/low', 'info');
        return;
    }
    const update = {
        title: newTitle.trim(),
        description: newDesc?.trim() || '',
        due: newDue?.trim() || null,
        priority: newPriority?.toLowerCase() || task.priority
    };
    try {
        const resp = await fetch(`${API_BASE}/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update)
        });
        if (!resp.ok) throw new Error();
        const updated = await resp.json();
        const idx = tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) tasks[idx] = updated;
        renderTasks();
        showToast('Задача обновлена', 'success');
    } catch (err) {
        showToast('Ошибка обновления', 'danger');
    }
}

async function clearCompleted() {
    const completed = tasks.filter(t => t.completed);
    if (completed.length === 0) {
        showToast('Нет завершённых задач', 'info');
        return;
    }
    if (!confirm(`Удалить ${completed.length} завершённых задач?`)) return;
    for (const task of completed) {
        await fetch(`${API_BASE}/${task.id}`, { method: 'DELETE' });
    }
    tasks = tasks.filter(t => !t.completed);
    renderTasks();
    showToast(`Удалено ${completed.length} задач`, 'success');
}

taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) return showToast('Введите название', 'info');
    addTask(title, taskPriority.value, taskDue.value, taskDesc.value);
    taskForm.reset();
    taskPriority.value = 'medium';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    taskDue.value = tomorrow.toISOString().slice(0,10);
    taskTitle.focus();
});

btnClearCompleted.addEventListener('click', clearCompleted);

navLinks.forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentNav = link.dataset.nav;
        currentFilter = 'all';
        filterChips.forEach(c => c.classList.remove('active'));
        document.querySelector('.filter-chip[data-filter="all"]').classList.add('active');
        renderTasks();
    });
});

filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderTasks();
    });
});

loadTasks();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
if (taskDue) taskDue.value = tomorrow.toISOString().slice(0,10);