"""northpoint AI service — placeholder.

This is a stub so `pnpm dev` can boot the FastAPI process alongside the web app.
The real /health endpoint lands in A5; richer endpoints follow per PHASE_1.md.
"""

from fastapi import FastAPI

app = FastAPI(title="northpoint AI service (placeholder)")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "northpoint-ai",
        "status": "placeholder",
        "note": "Proper /health endpoint lands in A5.",
    }
