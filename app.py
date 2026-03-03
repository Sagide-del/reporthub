import os
import sys
import json
import base64
import tempfile
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

# Database configuration for Vercel
if os.getenv('VERCEL_ENV'):
    # On Vercel, use SQLite in /tmp directory (writable)
    db_path = os.path.join(tempfile.gettempdir(), 'reporthub.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    print(f"Using database at: {db_path}")
else:
    # Local development
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///reporthub.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# ==================== Database Models ====================
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    subscription_active = db.Column(db.Boolean, default=False)
    subscription_end = db.Column(db.DateTime)
    subscription_plan = db.Column(db.String(20), default='none')
    school_name = db.Column(db.String(200))
    school_logo = db.Column(db.String(500))
    school_address = db.Column(db.String(200))
    school_phone = db.Column(db.String(20))
    school_email = db.Column(db.String(120))
    phone_number = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def is_subscription_valid(self):
        if not self.subscription_active:
            return False
        if self.subscription_end and self.subscription_end < datetime.now():
            self.subscription_active = False
            db.session.commit()
            return False
        return True

class Student(db.Model):
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    admission_number = db.Column(db.String(50), unique=True)
    class_name = db.Column(db.String(50))
    stream = db.Column(db.String(20))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    results = db.relationship('Result', backref='student', lazy=True)

class Subject(db.Model):
    __tablename__ = 'subjects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10), unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    results = db.relationship('Result', backref='subject', lazy=True)

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
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    phone_number = db.Column(db.String(20))
    amount = db.Column(db.Float)
    plan = db.Column(db.String(20))
    checkout_request_id = db.Column(db.String(100))
    merchant_request_id = db.Column(db.String(100))
    status = db.Column(db.String(20), default='pending')
    mpesa_receipt = db.Column(db.String(100))
    transaction_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ==================== M-PESA Integration ====================
class MpesaPayment:
    def __init__(self):
        self.consumer_key = os.getenv('MPESA_CONSUMER_KEY')
        self.consumer_secret = os.getenv('MPESA_CONSUMER_SECRET')
        self.business_shortcode = os.getenv('MPESA_SHORTCODE', '174379')
        self.passkey = os.getenv('MPESA_PASSKEY')
        self.phone_number = os.getenv('MPESA_PHONE_NUMBER', '254748519923')
        self.environment = os.getenv('MPESA_ENVIRONMENT', 'sandbox')
        
        if self.environment == 'production':
            self.base_url = 'https://api.safaricom.co.ke'
        else:
            self.base_url = 'https://sandbox.safaricom.co.ke'
    
    def get_access_token(self):
        url = f'{self.base_url}/oauth/v1/generate?grant_type=client_credentials'
        response = requests.get(url, auth=(self.consumer_key, self.consumer_secret))
        if response.status_code == 200:
            return response.json()['access_token']
        else:
            raise Exception(f"Failed to get access token: {response.text}")
    
    def stk_push(self, customer_phone, amount, account_reference='ReportHub'):
        try:
            access_token = self.get_access_token()
            url = f'{self.base_url}/mpesa/stkpush/v1/processrequest'
            
            if customer_phone.startswith('0'):
                customer_phone = '254' + customer_phone[1:]
            elif customer_phone.startswith('7'):
                customer_phone = '254' + customer_phone
            
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            password_str = self.business_shortcode + self.passkey + timestamp
            password = base64.b64encode(password_str.encode()).decode()
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'BusinessShortCode': self.business_shortcode,
                'Password': password,
                'Timestamp': timestamp,
                'TransactionType': 'CustomerPayBillOnline',
                'Amount': int(amount),
                'PartyA': customer_phone,
                'PartyB': self.business_shortcode,
                'PhoneNumber': customer_phone,
                'CallBackURL': 'https://reporthub.vercel.app/api/mpesa-callback',
                'AccountReference': account_reference[:12],
                'TransactionDesc': f'ReportHub Subscription'
            }
            
            response = requests.post(url, json=payload, headers=headers)
            return response.json()
            
        except Exception as e:
            return {'error': str(e)}

# ==================== Calculation Functions ====================
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

# ==================== Routes ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        login_user(user)
        return redirect(url_for('dashboard'))
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        new_user = User(email=email, username=username)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', user=current_user)

@app.route('/subscribe')
def subscribe():
    return render_template('subscribe.html')

@app.route('/api/mpesa/stkpush', methods=['POST'])
def mpesa_stkpush():
    try:
        data = request.json
        mpesa = MpesaPayment()
        response = mpesa.stk_push(
            customer_phone=data.get('phone'),
            amount=data.get('amount'),
            account_reference=f"REPORTHUB-{data.get('plan')}"
        )
        return jsonify({'success': True, 'data': response})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/process_excel', methods=['POST'])
@login_required
def process_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    try:
        if file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Please upload an Excel file'}), 400
        
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
        
        return jsonify({'success': True, 'results': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_performance', methods=['POST'])
@login_required
def analyze_performance():
    try:
        data = request.json
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an educational analyst."},
                {"role": "user", "content": f"Analyze this performance: {json.dumps(data)}"}
            ]
        )
        return jsonify({'success': True, 'analysis': response.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create tables
with app.app_context():
    db.create_all()
    print("Database tables created successfully!")

# Vercel handler
app = app

if __name__ == '__main__':
    app.run(debug=True)
