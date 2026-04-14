"""
Bedrifts-AI i Python: embedding-rangering + stillingsannonse (strukturert mal).
Ingen Groq, ingen sky-LLM og ingen betalte API-kall her – kun lokale modeller/mal.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = os.environ.get(
    "EMBED_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "").strip()

app = FastAPI(title="Job portal AI (Python)")
_model = None


def check_internal_secret(x_internal_secret: Optional[str]) -> None:
    if INTERNAL_SECRET and (x_internal_secret or "").strip() != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Ugyldig intern nøkkel")


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)
    return _model


@app.on_event("startup")
def startup_load_model():
    get_model()


class ApplicantIn(BaseModel):
    id: str
    applicantName: Optional[str] = None
    coverLetter: Optional[str] = None
    profile: Optional[dict[str, Any]] = None


class RankRequest(BaseModel):
    jobDescription: str = ""
    applicants: list[ApplicantIn] = Field(default_factory=list)


class JobPostingRequest(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    type: str = ""
    salary: str = ""
    keywords: str = ""
    companyAbout: str = ""
    ragContext: str = ""


def applicant_text(a: ApplicantIn) -> str:
    p = a.profile or {}
    parts = [
        a.applicantName or "",
        str(a.coverLetter or "")[:4000],
        str(p.get("summary") or ""),
        str(p.get("experience") or ""),
        str(p.get("skills") or ""),
    ]
    joined = " ".join(x for x in parts if x).strip()
    return joined if joined else "ingen søkertekst"


def _type_label_bokmal(type_raw: str) -> str:
    t = (type_raw or "").strip()
    return {
        "full-time": "Heltid",
        "part-time": "Deltid",
        "contract": "Kontrakt",
    }.get(t, t or "Ikke spesifisert")


def generate_job_posting_template(p: dict) -> str:
    """Strukturert norsk annonse – ingen ekstern LLM."""
    title = str(p.get("title") or "").strip()
    company = str(p.get("company") or "").strip()
    location = str(p.get("location") or "").strip()
    type_label = _type_label_bokmal(str(p.get("type") or ""))
    salary = str(p.get("salary") or "").strip() or "Ikke oppgitt"
    keywords = str(p.get("keywords") or "").strip()
    about = str(p.get("companyAbout") or "").strip()
    rag = str(p.get("ragContext") or "").strip()

    parts: list[str] = []
    parts.append(f"{title}\n\n")
    parts.append(f"{company} · {location}\n\n")

    if about:
        parts.append(f"Om oss\n{about[:6000]}\n\n")

    loc_bit = f" i {location}" if location else ""
    parts.append(
        f"Om rollen\n"
        f"Vi søker {title} til teamet vårt{loc_bit}. Stillingsbrøk: {type_label}.\n\n"
    )

    parts.append("Kvalifikasjoner\n")
    if keywords:
        for segment in keywords.replace(";", ",").split(","):
            s = segment.strip()
            if s:
                parts.append(f"• {s}\n")
    else:
        parts.append("• Se annonse og samtale for nærmere krav.\n")

    parts.append(
        "\nVi tilbyr\n"
        "• Et godt arbeidsmiljø\n"
        "• Faglige utviklingsmuligheter\n\n"
    )
    parts.append(f"Lønn\n{salary}\n\n")

    if rag:
        parts.append(
            "Referanse fra tidligere utlysninger (kun stilinspirasjon – ikke kopier fakta som ikke gjelder):\n"
            f"{rag.strip()[:8000]}\n\n"
        )

    parts.append(
        "Søknad\n"
        "Send oss søknad med CV. Aktuelle kandidater kontaktes for intervju.\n\n"
        f"{company}"
    )
    return "".join(parts)


@app.get("/health")
def health():
    return {"status": "ok", "embed_model": MODEL_NAME, "external_llm": False}


@app.post("/internal/rank")
def internal_rank(
    req: RankRequest,
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
):
    check_internal_secret(x_internal_secret)

    if not req.applicants:
        return {"rankings": []}

    job = (req.jobDescription or "").strip() or "stillingsannonse"
    texts = [applicant_text(a) for a in req.applicants]
    model = get_model()
    embeddings = model.encode([job] + texts, normalize_embeddings=True)
    job_vec = embeddings[0].astype(np.float64)
    app_mat = embeddings[1:].astype(np.float64)
    sims = app_mat @ job_vec
    sims_list = [float(s) for s in sims]

    mn = min(sims_list)
    mx = max(sims_list)
    rankings = []
    for a, s in zip(req.applicants, sims_list):
        if mx - mn < 1e-9:
            score = 75
        else:
            score = int(round(100 * (s - mn) / (mx - mn)))
        score = max(0, min(100, score))
        reason = (
            f"Lokal semantisk vurdering (relativ score {score}/100 mot denne annonsen). "
            "Les alltid hele søknaden – dette er ikke en juridisk eller faglig attest."
        )
        rankings.append({"id": a.id, "score": score, "reason": reason})

    rankings.sort(key=lambda x: -x["score"])
    return {"rankings": rankings}


@app.post("/internal/job-posting")
def internal_job_posting(
    req: JobPostingRequest,
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
):
    check_internal_secret(x_internal_secret)

    text = generate_job_posting_template(req.model_dump())
    return {"text": text, "source": "template"}
