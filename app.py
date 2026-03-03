﻿import os
import json
import base64
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import openai
import requests
from functools import wraps

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///reporthub.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Database Models
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    subscription_active = db.Column(db.Boolean, default=False)
    subscription_end = db.Column(db.DateTime)
    school_name = db.Column(db.String(200))
    school_logo = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    admission_number = db.Column(db.String(50), unique=True)
    class_name = db.Column(db.String(50))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10), unique=True)

class Result(db.Model):
    __tablename__ = 'results'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'))
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'))
    term = db.Column(db.String(20))
    year = db.Column(db.Integer)
    cat1 = db.Column(db.Float, default=0)
    cat2 = db.Column(db.Float, default=0)
    end_term_exam = db.Column(db.Float, default=0)
    final_score = db.Column(db.Float)
    grade = db.Column(db.String(2))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Calculation Functions
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

# Routes
@app.route('/')
def index():
    return jsonify({
        "message": "ReportHub API is running",
        "version": "1.0.0",
        "endpoints": [
            "/login",
            "/register",
            "/dashboard",
            "/subscribe",
            "/api/process_excel",
            "/api/analyze_performance",
            "/api/career_assessment"
        ]
    })

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        user = User.query.filter_by(email=data.get('email')).first()
        if user and user.check_password(data.get('password')):
            login_user(user)
            return jsonify({"success": True, "message": "Logged in successfully"})
        return jsonify({"error": "Invalid credentials"}), 401
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already exists"}), 400
    
    user = User(username=data.get('username'), email=data.get('email'))
    user.set_password(data.get('password'))
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True, "message": "User created"})

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', user=current_user)

@app.route('/subscribe')
def subscribe():
    return render_template('subscribe.html')

@app.route('/api/process_excel', methods=['POST'])
@login_required
def process_excel():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    df = pd.read_excel(file)
    results = []
    
    for _, row in df.iterrows():
        final_score = calculate_final_score(
            row.get('cat1', 0),
            row.get('cat2', 0),
            row.get('end_term_exam', 0)
        )
        grade = get_grade(final_score)
        results.append({
            'name': row.get('name', 'Unknown'),
            'subject': row.get('subject', 'Unknown'),
            'cat1': float(row.get('cat1', 0)),
            'cat2': float(row.get('cat2', 0)),
            'exam': float(row.get('end_term_exam', 0)),
            'final_score': final_score,
            'grade': grade
        })
    
    return jsonify({"success": True, "results": results})

@app.route('/api/analyze_performance', methods=['POST'])
@login_required
def analyze_performance():
    data = request.json
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an educational analyst."},
                {"role": "user", "content": f"Analyze this performance: {json.dumps(data)}"}
            ]
        )
        return jsonify({"success": True, "analysis": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/career_assessment', methods=['POST'])
@login_required
def career_assessment():
    data = request.json
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a career counselor."},
                {"role": "user", "content": f"Suggest careers based on: {json.dumps(data)}"}
            ]
        )
        return jsonify({"success": True, "assessment": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Create tables
with app.app_context():
    db.create_all()
    if Subject.query.count() == 0:
        subjects = ['Math', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography']
        for s in subjects:
            db.session.add(Subject(name=s, code=s[:3].upper()))
        db.session.commit()

# This is required for Vercel
app = app

if __name__ == '__main__':
    app.run(debug=True)
