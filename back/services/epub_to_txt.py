from pathlib import Path
from services.epub_service import extract_all_text, clean_book_text


def find_first_epub(epub_dir: Path) -> Path:
    epubs = sorted(epub_dir.rglob("*.epub"))
    if not epubs:
        raise FileNotFoundError(f"No se encontró ningún .epub dentro de: {epub_dir}")
    return epubs[0]


def main():
    base = Path(__file__).resolve().parents[1]  # back/
    epub_dir = base / "epub"
    out_path = base / "book.txt"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    epub_path = find_first_epub(epub_dir)
    print(f"📚 EPUB encontrado: {epub_path}")

    raw = extract_all_text(str(epub_path))
    clean = clean_book_text(raw)

    out_path.write_text(clean, encoding="utf-8")
    print(f"✅ Guardado: {out_path} ({len(clean)} chars)")


if __name__ == "__main__":
    main()
