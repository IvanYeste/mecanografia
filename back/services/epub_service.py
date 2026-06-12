import re
import html
import unicodedata
from typing import List, Dict, Any, Optional

from ebooklib import epub, ITEM_DOCUMENT
from bs4 import BeautifulSoup


# Huele a mojibake típico de UTF-8 leído como cp1252/latin1
_MOJIBAKE_HINT = re.compile(r"[âÃ€�œ™”–…]")


def fix_mojibake(text: str) -> str:
    """
    Repara texto del tipo: â€™ â€œ â€”
    (UTF-8 mal interpretado como latin1/cp1252).
    Solo lo intenta si detecta patrones.
    """
    if not text or not _MOJIBAKE_HINT.search(text):
        return text

    # 1) latin1 -> utf8 suele arreglar la mayoría
    try:
        repaired = text.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
        if repaired:
            return repaired
    except Exception:
        pass

    # 2) fallback cp1252
    try:
        repaired = text.encode("cp1252", errors="ignore").decode("utf-8", errors="ignore")
        if repaired:
            return repaired
    except Exception:
        pass

    return text


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\xa0", " ")
    return text


def _decode_item_bytes(raw: bytes) -> str:
    """
    Intenta decodificar bytes del XHTML del EPUB.
    """
    for enc in ("utf-8", "utf-16", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def item_to_text(item) -> str:
    """
    Convierte un ITEM_DOCUMENT del epub a texto con saltos.
    """
    raw = item.get_content()  # bytes
    decoded = _decode_item_bytes(raw)

    soup = BeautifulSoup(decoded, "lxml")
    txt = soup.get_text("\n")

    # Entidades HTML (&quot; etc.)
    txt = html.unescape(txt)

    # Arregla mojibake por si venía ya torcido
    txt = fix_mojibake(txt)

    # Normaliza unicode y espacios
    txt = normalize_text(txt)

    return txt.strip()


def extract_all_text(epub_path: str, min_len: int = 50) -> str:
    book = epub.read_epub(epub_path)

    parts = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        txt = item_to_text(item)
        if len(txt) >= min_len:
            parts.append(txt)

    return "\n\n".join(parts)


def extract_chapters(epub_path: str, min_len: int = 300) -> List[Dict[str, Any]]:
    """
    Devuelve lista de 'capítulos' basados en ITEM_DOCUMENT.
    """
    book = epub.read_epub(epub_path)

    chapters = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        txt = item_to_text(item)
        if len(txt) >= min_len:
            chapters.append({"title": item.get_name(), "text": txt})

    return chapters


def clean_book_text(text: str) -> str:
    """
    Limpieza general para convertir en texto usable (mecanografía / lecciones).
    """
    # Normaliza saltos
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = fix_mojibake(text)
    text = normalize_text(text)

    # Quita bullets sueltos
    text = re.sub(r"\n[ \t]*•[ \t]*\n", "\n\n", text)

    # Quita tags basura si se han colado (a veces pasa)
    text = re.sub(r"</?p\s*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"/p>", "", text, flags=re.IGNORECASE)

    # Normaliza comillas y guiones (opcional, pero ayuda)
    text = (text
            .replace("’", "'").replace("‘", "'")
            .replace("“", '"').replace("”", '"')
            .replace("—", "-").replace("–", "-"))

    # Quita guiones de corte de línea tipo "imagina-\ntion" => "imagination"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    lines = text.split("\n")
    cleaned = []

    skip_patterns = [
        r"^\s*$",
        r"^•$",
        r"^\d+$",
        r"^PART\s+[A-Z]+",
        r"^ACKNOWLEDGMENTS$",
        r"^ARS ARCANUM$",
        r"^MISTBORN$",
    ]

    for line in lines:
        raw = line.rstrip()
        stripped = raw.strip()
        if any(re.match(p, stripped) for p in skip_patterns):
            continue
        cleaned.append(raw)

    text = "\n".join(cleaned)

    # 🔥 MAGIA 1: junta letras separadas por saltos: "P\nR\nO\nL..." => "PROL..."
    text = re.sub(r"(?:\b[A-Za-z]\n){3,}[A-Za-z]\b", lambda m: m.group(0).replace("\n", ""), text)

    # 🔥 MAGIA 2: junta letras separadas por espacios: "P R O L..." => "PROL..."
    text = re.sub(r"\b(?:[A-Za-z] ){3,}[A-Za-z]\b", lambda m: m.group(0).replace(" ", ""), text)

    # 🔥 MAGIA 3: une saltos “de maquetación” dentro de frase
    text = re.sub(r"([^\n\.\!\?\:])\n([^\n])", r"\1 \2", text)

    # Normaliza muchos saltos
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def split_into_lessons(text: str, min_chars: int = 400, max_chars: int = 700) -> List[str]:
    lessons = []
    i = 0
    n = len(text)

    while i < n:
        if n - i <= max_chars:
            lessons.append(text[i:].strip())
            break

        window = text[i:i + max_chars]

        cut_candidates = [
            window.rfind("\n\n"),
            window.rfind("."),
            window.rfind("!"),
            window.rfind("?"),
            window.rfind("\n"),
            window.rfind(" "),
        ]

        valid_cuts = [c for c in cut_candidates if c >= min_chars]
        cut = max(valid_cuts) if valid_cuts else max_chars

        lessons.append(text[i:i + cut + 1].strip())
        i += cut + 1

    return lessons
