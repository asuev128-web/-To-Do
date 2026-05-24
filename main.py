from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import date

# ---------- FastAPI app ----------
app = FastAPI(title="TaskFlow API", version="1.0")

# Разрешаем CORS для фронтенда (чтобы можно было обращаться с localhost:3000 или просто открытого HTML)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # для разработки; в продакшене замените на конкретный адрес
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Модели данных (Pydantic) ----------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"   # low, medium, high
    due: Optional[str] = None  # дата в формате YYYY-MM-DD
    completed: bool = False

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due: Optional[str] = None
    completed: Optional[bool] = None

class Task(TaskCreate):
    id: str                  # строковый ID, как в localStorage (task_...)
    created_at: int          # timestamp

# ---------- SQLite ----------
DB_NAME = "database.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL,
                due TEXT,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        """)
        conn.commit()

def get_task_or_404(task_id: str) -> dict:
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        return dict(row)

def row_to_task(row: dict) -> Task:
    return Task(
        id=row["id"],
        title=row["title"],
        description=row["description"] or "",
        priority=row["priority"],
        due=row["due"],
        completed=bool(row["completed"]),
        created_at=row["created_at"]
    )

# ---------- API endpoints ----------
@app.on_event("startup")
def startup():
    init_db()

@app.get("/tasks", response_model=List[Task])
def get_all_tasks():
    """Получить список всех задач."""
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [row_to_task(row) for row in rows]

@app.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate):
    """Создать новую задачу."""
    import time
    task_id = f"task_{int(time.time()*1000)}_{id(task)}"  # уникальный ID
    created_at = int(time.time() * 1000)
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO tasks (id, title, description, priority, due, completed, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (task_id, task.title, task.description, task.priority, task.due, int(task.completed), created_at)
        )
        conn.commit()
    # вернуть созданную задачу
    return get_task_or_404(task_id)  # get_task_or_404 уже возвращает dict, но нам надо как Task

@app.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, task_update: TaskUpdate):
    existing = get_task_or_404(task_id)
    # обновляем только переданные поля
    new_title = task_update.title if task_update.title is not None else existing["title"]
    new_description = task_update.description if task_update.description is not None else existing["description"]
    new_priority = task_update.priority if task_update.priority is not None else existing["priority"]
    new_due = task_update.due if task_update.due is not None else existing["due"]
    new_completed = int(task_update.completed) if task_update.completed is not None else existing["completed"]
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE tasks SET title=?, description=?, priority=?, due=?, completed=?
               WHERE id=?""",
            (new_title, new_description, new_priority, new_due, new_completed, task_id)
        )
        conn.commit()
    return get_task_or_404(task_id)

@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str):
    get_task_or_404(task_id)  # проверим существование
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()

# ---------- Статика (отдача фронтенда) ----------
# Положите свои HTML/CSS/JS в папку static
app.mount("/", StaticFiles(directory="static", html=True), name="static")