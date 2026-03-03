import os
import json
import base64
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import openai
import requests
from functools import wraps
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io
import csv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///reporthub.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'csv', 'xlsx'}

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
CORS(app)
jwt = JWTManager(app)

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Create upload folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ==================== Database Models ====================
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='teacher')  # admin, teacher, parent
    subscription_active = db.Column(db.Boolean, default=False)
    subscription_end = db.Column(db.DateTime)
    school_name = db.Column(db.String(200))
    school_logo = db.Column(db.String(500))
    school_address = db.Column(db.String(200))
    school_phone = db.Column(db.String(20))
    school_email = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    students = db.relationship('Student', backref='teacher', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True)
    admission_number = db.Column(db.String(50), unique=True, nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50))
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(10))
    class_name = db.Column(db.String(20))  # e.g., Grade 1, Form 1
    stream = db.Column(db.String(10))  # e.g., A, B, C
    year = db.Column(db.Integer)
    parent_name = db.Column(db.String(100))
    parent_phone = db.Column(db.String(20))
    parent_email = db.Column(db.String(120))
    address = db.Column(db.String(200))
    photo = db.Column(db.String(500))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    results = db.relationship('Result', backref='student', lazy=True)
    attendance = db.relationship('Attendance', backref='student', lazy=True)

class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10), unique=True)
    category = db.Column(db.String(50))  # CBC Learning Area
    grade_level = db.Column(db.String(20))  # Which grade this subject is for
    
    # CBC Specific fields
    strands = db.relationship('Strand', backref='subject', lazy=True)

class Strand(db.Model):
    __tablename__ = 'strands'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'))
    sub_strands = db.relationship('SubStrand', backref='strand', lazy=True)

class SubStrand(db.Model):
    __tablename__ = 'sub_strands'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    strand_id = db.Column(db.Integer, db.ForeignKey('strands.id'))

class Result(db.Model):
    __tablename__ = 'results'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'))
    term = db.Column(db.String(20))
    year = db.Column(db.Integer)
    
    # CBC Assessment
    cat1 = db.Column(db.Float, default=0)  # 15%
    cat2 = db.Column(db.Float, default=0)  # 15%
    end_term_exam = db.Column(db.Float, default=0)  # 70%
    
    # CBC Competency Levels
    exceeds = db.Column(db.Boolean, default=False)  # 80-100%
    meets = db.Column(db.Boolean, default=False)     # 60-79%
    approaches = db.Column(db.Boolean, default=False) # 40-59%
    below = db.Column(db.Boolean, default=False)      # 0-39%
    
    final_score = db.Column(db.Float)
    grade = db.Column(db.String(2))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    date = db.Column(db.Date, default=datetime.utcnow)
    status = db.Column(db.String(10))  # present, absent, late
    term = db.Column(db.String(20))
    year = db.Column(db.Integer)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ==================== Helper Functions ====================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def calculate_final_score(cat1, cat2, end_term_exam):
    try:
        cat1 = float(cat1) if cat1 else 0
        cat2 = float(cat2) if cat2 else 0
        end_term_exam = float(end_term_exam) if end_term_exam else 0
        cat_contribution = ((cat1 + cat2) / 60) * 30
        exam_contribution = (end_term_exam / 100) * 70
        final_score = cat_contribution + exam_contribution
        return round(final_score, 2)
    except:
        return 0

def get_grade(score):
    try:
        score = float(score)
        if score >= 80: return 'A'
        elif score >= 75: return 'A-'
        elif score >= 70: return 'B+'
        elif score >= 65: return 'B'
        elif score >= 60: return 'B-'
        elif score >= 55: return 'C+'
        elif score >= 50: return 'C'
        elif score >= 45: return 'C-'
        elif score >= 40: return 'D+'
        elif score >= 35: return 'D'
        elif score >= 30: return 'D-'
        else: return 'E'
    except:
        return 'N/A'

def get_cbc_level(score):
    try:
        score = float(score)
        if score >= 80: return 'Exceeds Expectations'
        elif score >= 60: return 'Meets Expectations'
        elif score >= 40: return 'Approaches Expectations'
        else: return 'Below Expectations'
    except:
        return 'Not Assessed'

def generate_report_card_pdf(student_id, term, year):
    student = Student.query.get(student_id)
    results = Result.query.filter_by(student_id=student_id, term=term, year=year).all()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Center alignment
    )
    elements.append(Paragraph(f"{student.teacher.school_name}", title_style))
    elements.append(Paragraph(f"Report Card - Term {term} {year}", styles['Heading2']))
    elements.append(Spacer(1, 20))
    
    # Student Info
    data = [
        ['Student Name:', f"{student.first_name} {student.last_name}"],
        ['Admission No:', student.admission_number],
        ['Class:', f"{student.class_name} {student.stream}"],
        ['Term:', f"{term} {year}"]
    ]
    
    table = Table(data, colWidths=[100, 300])
    table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('GRID', (0,0), (-1,-1), 1, colors.black)
    ]))
    elements.append(table)
    elements.append(Spacer(1, 20))
    
    # Results Table
    result_data = [['Subject', 'CAT 1', 'CAT 2', 'Exam', 'Final', 'Grade', 'CBC Level']]
    for r in results:
        subject = Subject.query.get(r.subject_id)
        cbc_level = get_cbc_level(r.final_score)
        result_data.append([
            subject.name,
            str(r.cat1),
            str(r.cat2),
            str(r.end_term_exam),
            str(r.final_score),
            r.grade,
            cbc_level
        ])
    
    # Add average
    avg_score = sum(r.final_score for r in results) / len(results) if results else 0
    result_data.append(['', '', '', '', f'Average: {avg_score:.2f}', f'Grade: {get_grade(avg_score)}', ''])
    
    result_table = Table(result_data, colWidths=[100, 50, 50, 50, 50, 50, 150])
    result_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ALIGN', (1,0), (-2,-1), 'CENTER'),
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('GRID', (0,0), (-1,-2), 1, colors.black),
        ('SPAN', (-2,-1), (-1,-1)),
    ]))
    elements.append(result_table)
    
    # Attendance
    attendance = Attendance.query.filter_by(student_id=student_id, term=term, year=year).all()
    total_days = len(attendance)
    present_days = sum(1 for a in attendance if a.status == 'present')
    absent_days = sum(1 for a in attendance if a.status == 'absent')
    
    attendance_data = [
        ['Attendance Summary:'],
        [f'Total Days: {total_days}', f'Present: {present_days}', f'Absent: {absent_days}']
    ]
    
    attendance_table = Table(attendance_data)
    elements.append(Spacer(1, 20))
    elements.append(attendance_table)
    
    # Teacher's Comments
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("Teacher's Comments:", styles['Heading3']))
    elements.append(Paragraph("_________________________________________________", styles['Normal']))
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("Class Teacher", styles['Normal']))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Principal's Signature: ___________________", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

# ==================== Routes ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already exists"}), 400
    
    user = User(
        username=data.get('username'),
        email=data.get('email'),
        role=data.get('role', 'teacher'),
        school_name=data.get('school_name')
    )
    user.set_password(data.get('password'))
    db.session.add(user)
    db.session.commit()
    
    return jsonify({"success": True, "message": "User created successfully"})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data.get('email')).first()
    
    if user and user.check_password(data.get('password')):
        access_token = create_access_token(identity=user.id)
        return jsonify({
            "success": True,
            "token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "school_name": user.school_name
            }
        })
    
    return jsonify({"error": "Invalid credentials"}), 401

# Student Management Routes
@app.route('/api/students', methods=['GET'])
@jwt_required()
def get_students():
    user_id = get_jwt_identity()
    students = Student.query.filter_by(user_id=user_id).all()
    return jsonify([{
        "id": s.id,
        "admission_number": s.admission_number,
        "first_name": s.first_name,
        "last_name": s.last_name,
        "class_name": s.class_name,
        "stream": s.stream
    } for s in students])

@app.route('/api/students', methods=['POST'])
@jwt_required()
def add_student():
    user_id = get_jwt_identity()
    data = request.json
    
    if Student.query.filter_by(admission_number=data.get('admission_number')).first():
        return jsonify({"error": "Admission number already exists"}), 400
    
    student = Student(
        admission_number=data.get('admission_number'),
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        middle_name=data.get('middle_name'),
        date_of_birth=datetime.strptime(data.get('date_of_birth'), '%Y-%m-%d') if data.get('date_of_birth') else None,
        gender=data.get('gender'),
        class_name=data.get('class_name'),
        stream=data.get('stream'),
        year=datetime.now().year,
        parent_name=data.get('parent_name'),
        parent_phone=data.get('parent_phone'),
        parent_email=data.get('parent_email'),
        user_id=user_id
    )
    
    db.session.add(student)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Student added successfully", "id": student.id})

@app.route('/api/students/<int:id>', methods=['PUT'])
@jwt_required()
def update_student(id):
    student = Student.query.get_or_404(id)
    data = request.json
    
    student.first_name = data.get('first_name', student.first_name)
    student.last_name = data.get('last_name', student.last_name)
    student.class_name = data.get('class_name', student.class_name)
    student.stream = data.get('stream', student.stream)
    
    db.session.commit()
    return jsonify({"success": True, "message": "Student updated successfully"})

@app.route('/api/students/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_student(id):
    student = Student.query.get_or_404(id)
    db.session.delete(student)
    db.session.commit()
    return jsonify({"success": True, "message": "Student deleted successfully"})

# Result Management
@app.route('/api/results', methods=['POST'])
@jwt_required()
def add_result():
    data = request.json
    
    final_score = calculate_final_score(
        data.get('cat1', 0),
        data.get('cat2', 0),
        data.get('end_term_exam', 0)
    )
    grade = get_grade(final_score)
    
    result = Result(
        student_id=data.get('student_id'),
        subject_id=data.get('subject_id'),
        term=data.get('term'),
        year=data.get('year'),
        cat1=data.get('cat1', 0),
        cat2=data.get('cat2', 0),
        end_term_exam=data.get('end_term_exam', 0),
        final_score=final_score,
        grade=grade
    )
    
    db.session.add(result)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Result added", "final_score": final_score, "grade": grade})

@app.route('/api/results/upload', methods=['POST'])
@jwt_required()
def upload_results():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
    elif file.filename.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file)
    else:
        return jsonify({"error": "Invalid file format"}), 400
    
    results = []
    for _, row in df.iterrows():
        final_score = calculate_final_score(
            row.get('cat1', 0),
            row.get('cat2', 0),
            row.get('end_term_exam', 0)
        )
        grade = get_grade(final_score)
        
        # Find student by admission number
        student = Student.query.filter_by(admission_number=str(row.get('admission_number'))).first()
        if student:
            result = Result(
                student_id=student.id,
                subject_id=row.get('subject_id'),
                term=row.get('term'),
                year=row.get('year'),
                cat1=row.get('cat1', 0),
                cat2=row.get('cat2', 0),
                end_term_exam=row.get('end_term_exam', 0),
                final_score=final_score,
                grade=grade
            )
            db.session.add(result)
            results.append({
                "admission": row.get('admission_number'),
                "name": f"{student.first_name} {student.last_name}",
                "final_score": final_score,
                "grade": grade
            })
    
    db.session.commit()
    return jsonify({"success": True, "results": results})

# Report Card Generation
@app.route('/api/report-card/<int:student_id>/<term>/<int:year>', methods=['GET'])
@jwt_required()
def generate_report_card(student_id, term, year):
    try:
        pdf_buffer = generate_report_card_pdf(student_id, term, year)
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"report_card_{student_id}_{term}_{year}.pdf",
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# AI Analysis
@app.route('/api/analyze/class/<int:class_id>', methods=['GET'])
@jwt_required()
def analyze_class_performance(class_id):
    students = Student.query.filter_by(class_name=class_id).all()
    all_results = []
    
    for student in students:
        results = Result.query.filter_by(student_id=student.id).all()
        avg_score = sum(r.final_score for r in results) / len(results) if results else 0
        all_results.append({
            "student": f"{student.first_name} {student.last_name}",
            "average": avg_score,
            "grade": get_grade(avg_score)
        })
    
    # AI Analysis
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an educational analyst."},
                {"role": "user", "content": f"Analyze this class performance data: {json.dumps(all_results)}"}
            ]
        )
        ai_analysis = response.choices[0].message.content
    except:
        ai_analysis = "AI analysis temporarily unavailable"
    
    return jsonify({
        "class": class_id,
        "total_students": len(students),
        "class_average": sum(r['average'] for r in all_results) / len(all_results) if all_results else 0,
        "students": all_results,
        "ai_analysis": ai_analysis
    })

# Bulk Upload Students
@app.route('/api/students/bulk', methods=['POST'])
@jwt_required()
def bulk_upload_students():
    user_id = get_jwt_identity()
    
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
    elif file.filename.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file)
    else:
        return jsonify({"error": "Invalid file format"}), 400
    
    students = []
    for _, row in df.iterrows():
        if not Student.query.filter_by(admission_number=str(row.get('admission_number'))).first():
            student = Student(
                admission_number=str(row.get('admission_number')),
                first_name=row.get('first_name'),
                last_name=row.get('last_name'),
                class_name=row.get('class_name'),
                stream=row.get('stream'),
                user_id=user_id
            )
            db.session.add(student)
            students.append(row.get('admission_number'))
    
    db.session.commit()
    return jsonify({"success": True, "added": len(students)})

# Create tables
with app.app_context():
    db.create_all()
    
    # Add default subjects if none exist
    if Subject.query.count() == 0:
        cbc_subjects = [
            {'name': 'Mathematics', 'code': 'MATH', 'category': 'Core'},
            {'name': 'English', 'code': 'ENG', 'category': 'Core'},
            {'name': 'Kiswahili', 'code': 'KISW', 'category': 'Core'},
            {'name': 'Science', 'code': 'SCI', 'category': 'Core'},
            {'name': 'Social Studies', 'code': 'SST', 'category': 'Core'},
            {'name': 'CRE', 'code': 'CRE', 'category': 'Core'},
            {'name': 'Physical Education', 'code': 'PE', 'category': 'Co-curricular'},
            {'name': 'Art & Craft', 'code': 'ART', 'category': 'Creative'},
            {'name': 'Music', 'code': 'MUS', 'category': 'Creative'}
        ]
        for s in cbc_subjects:
            db.session.add(Subject(**s))
        db.session.commit()

# This is required for Vercel
app = app

if __name__ == '__main__':
    app.run(debug=True)
