import re
import html
import unicodedata
from typing import List, Dict, Any, Optional

from ebooklib import epub, ITEM_DOCUMENT
from bs4 import BeautifulSoup


def normalize_text(text):
    text = unicodedata.normalize("NFC", text)
    text = text.replace(chr(0xa0), " ")
    return text


def _decode_item_bytes(raw):
    for enc in ("utf-8", "utf-16", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def item_to_text(item):
    raw = item.get_content()
    decoded = _decode_item_bytes(raw)
    soup = BeautifulSoup(decoded, "lxml")
    txt = soup.get_text(chr(10))
    txt = html.unescape(txt)
    txt = normalize_text(txt)
    return txt.strip()


def extract_all_text(epub_path, min_len=50):
    book = epub.read_epub(epub_path)
    parts = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        txt = item_to_text(item)
        if len(txt) >= min_len:
            parts.append(txt)
    return (chr(10) + chr(10)).join(parts)


def extract_chapters(epub_path, min_len=300):
    book = epub.read_epub(epub_path)
    chapters = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        txt = item_to_text(item)
        if len(txt) >= min_len:
            chapters.append({"title": item.get_name(), "text": txt})
    return chapters


def clean_book_text(text):
    NL = chr(10)
    text = text.replace(chr(13) + chr(10), NL).replace(chr(13), NL)
    text = normalize_text(text)

    # Quita caracteres de reemplazo Unicode (bytes corruptos del epub)
    text = text.replace(chr(0xFFFD), "")

    # Quita numeros de pagina pegados al inicio de palabra: "1limited" -> "limited"
    text = re.sub(r"(?<!\w)\d{1,4}(?=[a-zA-Z])", "", text)

    # Quita bullets sueltos
    text = re.sub(NL + r"[ 	]*" + chr(0x2022) + r"[ 	]*" + NL, NL + NL, text)

    # Quita tags basura
    text = re.sub(r"</?p\s*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"/p>", "", text, flags=re.IGNORECASE)

    # Repara mojibake de comillas Windows-1252 doblemente codificados
    A_TM  = chr(0x00E2) + chr(0x2122)  # apostrofe
    A_OE  = chr(0x00E2) + chr(0x0153)  # comilla izq
    A_CTL = chr(0x00E2) + chr(0x009D)  # comilla der
    A_RDQ = chr(0x00E2) + chr(0x201D)  # guion largo
    A_EUR = chr(0x00E2) + chr(0x20AC)  # guion
    A_TLD = chr(0x00E2) + chr(0x02DC)  # espacio
    text = (text
            .replace(A_TM, "'")
            .replace(A_OE, '"')
            .replace(A_CTL, '"')
            .replace(A_RDQ, "-")
            .replace(A_EUR, "-")
            .replace(A_TLD, " ")
            )

    # Normaliza comillas tipograficas y guiones a ASCII
    text = (text
            .replace(chr(0x2018), "'").replace(chr(0x2019), "'")
            .replace(chr(0x201C), '"').replace(chr(0x201D), '"')
            .replace(chr(0x2014), "-").replace(chr(0x2013), "-")
            )

    # Quita guiones de corte de linea
    text = re.sub(r"(\w)-" + NL + r"(\w)", r"", text)

    lines = text.split(NL)
    cleaned = []
    skip_patterns = [
        r"^\s*$",
        r"^" + chr(0x2022) + r"$",
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

    text = NL.join(cleaned)

    # MAGIA 1: junta letras separadas por saltos
    text = re.sub(r"(?:[A-Za-z]" + NL + r"){3,}[A-Za-z]",
                  lambda m: m.group(0).replace(NL, ""), text)

    # MAGIA 2: junta letras separadas por espacios
    text = re.sub(r"(?:[A-Za-z] ){3,}[A-Za-z]",
                  lambda m: m.group(0).replace(" ", ""), text)

    # MAGIA 3: une saltos de maquetacion dentro de frase
    text = re.sub(r"([^" + NL + r"\.\!\?\:])" + NL + r"([^" + NL + r"])",
                  r" ", text)

    # Normaliza multiples saltos
    text = re.sub(NL + r"{3,}", NL + NL, text)

    return text.strip()


def split_into_lessons(text, min_chars=400, max_chars=700):
    lessons = []
    i = 0
    n = len(text)

    while i < n:
        if n - i <= max_chars:
            lessons.append(text[i:].strip())
            break

        window = text[i:i + max_chars]

        cut_candidates = [
            window.rfind(chr(10) + chr(10)),
            window.rfind("."),
            window.rfind("!"),
            window.rfind("?"),
            window.rfind(chr(10)),
            window.rfind(" "),
        ]

        valid_cuts = [c for c in cut_candidates if c >= min_chars]
        cut = max(valid_cuts) if valid_cuts else max_chars

        lessons.append(text[i:i + cut + 1].strip())
        i += cut + 1

    return lessons
