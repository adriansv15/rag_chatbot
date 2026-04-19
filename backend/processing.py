import io
import fitz  # PyMuPDF
from docx import Document
from PIL import Image
import io
import numpy as np
import easyocr

def extract_txt_text(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")

def extract_pdf_text(file_bytes: bytes) -> str:
    text = ""
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    for page in pdf:
        text += page.get_text("text") + "\n"
    return text

def extract_docx_text(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs)

# Create the OCR reader once (expensive to initialize)
reader = easyocr.Reader(["en"], gpu=False)

def extract_image_text(file_bytes: bytes) -> str:
    # Load image from bytes
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    image_np = np.array(image)

    # OCR: returns list of [bbox, text, confidence]
    results = reader.readtext(image_np)

    # Sort by vertical position, then horizontal
    results = sorted(results, key=lambda r: (r[0][0][1], r[0][0][0]))

    # Extract text only
    lines = [r[1] for r in results]

    # Join into readable paragraph
    return "\n".join(lines)

EXTRACTORS = {
    "txt": extract_txt_text,
    "pdf": extract_pdf_text,
    "docx": extract_docx_text,
    "png": extract_image_text,
    "jpg": extract_image_text,
    "jpeg": extract_image_text,
    # "mp3": extract_audio_text,
    # "wav": extract_audio_text,
    # "pptx": extract_ppt_text,
    # "csv": extract_csv_text,
    # "pdf_ai": extract_pdf_ai,
    }

def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    ext = filename.lower().split(".")[-1]

    extractor = EXTRACTORS.get(ext)
    if extractor is None:
        raise ValueError(f"Unsupported file type: {ext}")

    return extractor(file_bytes)
