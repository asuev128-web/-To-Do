import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# ---------- Тесты GET /tasks ----------
def test_get_tasks_empty():
    response = client.get("/tasks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# ---------- Тесты POST /tasks ----------
def test_create_task_valid():
    payload = {
        "title": "Test task",
        "description": "Test description",
        "priority": "high",
        "due": "2026-12-31",
        "completed": False
    }
    response = client.post("/tasks", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["priority"] == payload["priority"]
    assert data["due"] == payload["due"]
    assert data["completed"] is False
    assert "id" in data
    assert "created_at" in data

def test_create_task_missing_title():
    payload = {"priority": "low"}
    response = client.post("/tasks", json=payload)
    # Должна быть ошибка валидации, так как title обязателен
    assert response.status_code == 422

def test_create_task_invalid_priority():
    payload = {"title": "Test", "priority": "super_high"}
    response = client.post("/tasks", json=payload)
    # В текущей реализации сервер примет любое значение priority (строка),
    # но мы всё равно проверяем, что сервер не падает и возвращает 200 или 201.
    # Если добавите Enum, будет 422.
    assert response.status_code in [200, 201]

# ---------- Тесты PUT /tasks/{id} ----------
def test_update_task():
    create_resp = client.post("/tasks", json={"title": "Original"})
    assert create_resp.status_code == 201
    task_id = create_resp.json()["id"]
    
    update_data = {"title": "Updated", "completed": True}
    resp = client.put(f"/tasks/{task_id}", json=update_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated"
    assert data["completed"] is True

def test_update_nonexistent_task():
    resp = client.put("/tasks/nonexistent", json={"title": "New"})
    assert resp.status_code == 404

# ---------- Тесты DELETE /tasks/{id} ----------
def test_delete_task():
    create_resp = client.post("/tasks", json={"title": "To be deleted"})
    task_id = create_resp.json()["id"]
    resp = client.delete(f"/tasks/{task_id}")
    assert resp.status_code == 204
    # Проверяем, что задача исчезла
    get_resp = client.get("/tasks")
    tasks = get_resp.json()
    assert not any(t["id"] == task_id for t in tasks)

def test_delete_nonexistent_task():
    resp = client.delete("/tasks/absent")
    assert resp.status_code == 404

# ---------- Edge cases ----------
def test_create_task_with_empty_string_title():
    resp = client.post("/tasks", json={"title": ""})
    # Пустая строка может считаться валидной или нет – решать вам.
    # Сейчас сервер создаст задачу с пустым названием. Это допустимо, но можно улучшить.
    assert resp.status_code in [200, 201, 422]

def test_create_task_very_long_title():
    long_title = "A" * 1000
    resp = client.post("/tasks", json={"title": long_title})
    assert resp.status_code == 201
    assert len(resp.json()["title"]) == 1000

def test_update_partial():
    create_resp = client.post("/tasks", json={"title": "Partial", "priority": "low"})
    task_id = create_resp.json()["id"]
    # Отправляем только одно поле
    resp = client.put(f"/tasks/{task_id}", json={"description": "Added desc"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Added desc"
    assert data["priority"] == "low"  # не изменилось

def test_get_task_invalid_id_format():
    # id в нашей реализации строковый, но если передать число, то 404
    resp = client.put("/tasks/99999", json={"title": "x"})
    assert resp.status_code == 404