from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from services.epub_service import clean_book_text, split_into_lessons

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent  # back/
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


# Cachea al arrancar
try:
    book_text_cache = _load_book_text()
    LESSONS_CACHE = _build_lessons(book_text_cache)
except Exception as e:
    # Si falla, arrancamos igual pero endpoints darán error útil
    book_text_cache = ""
    LESSONS_CACHE = []
    STARTUP_ERROR = str(e)


@app.get("/health")
def health():
    return {
        "ok": True,
        "has_book": bool(book_text_cache),
        "lessons": len(LESSONS_CACHE),
        "error": globals().get("STARTUP_ERROR")
    }


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


