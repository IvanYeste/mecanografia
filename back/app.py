from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from sqlalchemy.orm import Session

from services.epub_service import clean_book_text, split_into_lessons
from database import engine, get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
TXT_PATH = BASE_DIR / "book.txt"


def _load_book_text() -> str:
    if not TXT_PATH.exists():
        raise FileNotFoundError(
            f"No existe {TXT_PATH}. Ejecuta primero: python services/epub_to_txt.py"
        )
    return TXT_PATH.read_text(encoding="utf-8", errors="replace")


def _build_lessons(book_text: str):
    clean_text = clean_book_text(book_text)
    return split_into_lessons(clean_text)


try:
    book_text_cache = _load_book_text()
    LESSONS_CACHE = _build_lessons(book_text_cache)
except Exception as e:
    book_text_cache = ""
    LESSONS_CACHE = []
    STARTUP_ERROR = str(e)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "ok": True,
        "has_book": bool(book_text_cache),
        "lessons": len(LESSONS_CACHE),
        "error": globals().get("STARTUP_ERROR"),
    }


# ─── Lessons ──────────────────────────────────────────────────────────────────

@app.get("/lessons")
def get_lessons():
    if not LESSONS_CACHE:
        raise HTTPException(status_code=500, detail=globals().get("STARTUP_ERROR", "No lessons loaded"))
    return [{"id": i, "text": lesson} for i, lesson in enumerate(LESSONS_CACHE)]


@app.get("/lessons/count")
def get_lessons_count():
    if not LESSONS_CACHE:
        raise HTTPException(status_code=500, detail=globals().get("STARTUP_ERROR", "No lessons loaded"))
    return {"count": len(LESSONS_CACHE)}


@app.get("/lessons/{lesson_id}")
def get_lesson_by_id(lesson_id: int):
    if not LESSONS_CACHE:
        raise HTTPException(status_code=500, detail=globals().get("STARTUP_ERROR", "No lessons loaded"))
    if lesson_id < 0 or lesson_id >= len(LESSONS_CACHE):
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"id": lesson_id, "text": LESSONS_CACHE[lesson_id]}


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=schemas.Token)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = models.User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id)}


@app.post("/auth/login", response_model=schemas.Token)
def login(body: schemas.UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    return {"access_token": create_access_token(user.id)}


@app.get("/auth/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}


# ─── Progress ─────────────────────────────────────────────────────────────────

@app.get("/progress")
def get_progress(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(models.Progress).filter(models.Progress.user_id == current_user.id).all()
    return {
        row.lesson_id: {
            "lessonId": row.lesson_id,
            "bestWpm": row.best_wpm,
            "lastWpm": row.last_wpm,
            "lastAccuracy": row.last_accuracy,
            "lastTime": row.last_time,
            "completedAt": row.completed_at or "",
            "timesCompleted": row.times_completed,
        }
        for row in rows
    }


@app.post("/progress/{lesson_id}")
def save_progress(
    lesson_id: int,
    body: schemas.LessonProgressSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(models.Progress)
        .filter(models.Progress.user_id == current_user.id, models.Progress.lesson_id == lesson_id)
        .first()
    )
    if row:
        row.best_wpm = body.bestWpm
        row.last_wpm = body.lastWpm
        row.last_accuracy = body.lastAccuracy
        row.last_time = body.lastTime
        row.completed_at = body.completedAt
        row.times_completed = body.timesCompleted
    else:
        row = models.Progress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            best_wpm=body.bestWpm,
            last_wpm=body.lastWpm,
            last_accuracy=body.lastAccuracy,
            last_time=body.lastTime,
            completed_at=body.completedAt,
            times_completed=body.timesCompleted,
        )
        db.add(row)
    db.commit()
    return {"ok": True}


@app.post("/progress/bulk")
def save_progress_bulk(
    body: schemas.BulkProgressSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = {
        row.lesson_id: row
        for row in db.query(models.Progress)
        .filter(models.Progress.user_id == current_user.id)
        .all()
    }
    for item in body.lessons:
        row = existing.get(item.lessonId)
        if row:
            row.best_wpm = item.bestWpm
            row.last_wpm = item.lastWpm
            row.last_accuracy = item.lastAccuracy
            row.last_time = item.lastTime
            row.completed_at = item.completedAt
            row.times_completed = item.timesCompleted
        else:
            db.add(models.Progress(
                user_id=current_user.id,
                lesson_id=item.lessonId,
                best_wpm=item.bestWpm,
                last_wpm=item.lastWpm,
                last_accuracy=item.lastAccuracy,
                last_time=item.lastTime,
                completed_at=item.completedAt,
                times_completed=item.timesCompleted,
            ))
    db.commit()
    return {"ok": True, "saved": len(body.lessons)}


@app.delete("/progress")
def reset_progress(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.Progress).filter(models.Progress.user_id == current_user.id).delete()
    db.commit()
    return {"ok": True}
