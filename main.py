from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import create_engine, text
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
import os

app = FastAPI()

# -------------------
# CORS
# -------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------
# ENV CONFIG
# -------------------
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")
ALGORITHM = "HS256"
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL) if DATABASE_URL else None
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# -------------------
# Health Check
# -------------------
@app.get("/health")
def health():
    return {"status": "healthy"}

# -------------------
# Root
# -------------------
@app.get("/")
def root():
    return {"message": "ReportHub is LIVE!", "status": "success"}

# -------------------
# Auth
# -------------------
@app.post("/login")
def login(username: str, password: str):
    hashed = pwd_context.hash(password)
    token = jwt.encode({"sub": username}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token}

# -------------------
# Database Test
# -------------------
@app.get("/db-test")
def db_test():
    if not engine:
        return {"error": "Database not configured"}
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        return {"db_status": "connected"}

# -------------------
# PDF Report Generator
# -------------------
@app.get("/generate-report")
def generate_report():
    file_path = "report.pdf"
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [Paragraph("ReportHub Student Report", styles["Title"])]
    doc.build(elements)
    return {"message": "Report generated"}
