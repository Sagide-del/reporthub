import os
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
        
        # Base URLs
        if self.environment == 'production':
            self.base_url = 'https://api.safaricom.co.ke'
        else:
            self.base_url = 'https://sandbox.safaricom.co.ke'
    
    def get_access_token(self):
        """Get OAuth access token"""
        url = f'{self.base_url}/oauth/v1/generate?grant_type=client_credentials'
        
        response = requests.get(
            url, 
            auth=(self.consumer_key, self.consumer_secret)
        )
        
        if response.status_code == 200:
            return response.json()['access_token']
        else:
            raise Exception(f"Failed to get access token: {response.text}")
    
    def stk_push(self, customer_phone, amount, account_reference='ReportHub'):
        """Initiate STK Push to customer"""
        try:
            access_token = self.get_access_token()
            url = f'{self.base_url}/mpesa/stkpush/v1/processrequest'
            
            # Format customer phone
            if customer_phone.startswith('0'):
                customer_phone = '254' + customer_phone[1:]
            elif customer_phone.startswith('7'):
                customer_phone = '254' + customer_phone
            
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            
            # Generate password
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
    """Calculate final score based on the weighting system"""
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
    """Determine grade based on score"""
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

def get_remarks(grade):
    """Generate remarks based on grade"""
    remarks = {
        'A': 'Excellent performance! Keep it up.',
        'A-': 'Very good performance. Maintain the momentum.',
        'B+': 'Good performance. Room for improvement.',
        'B': 'Satisfactory performance. Work harder.',
        'B-': 'Fair performance. Need more effort.',
        'C+': 'Average performance. Significant improvement needed.',
        'C': 'Below average. Seek help where necessary.',
        'C-': 'Poor performance. Urgent intervention required.',
        'D+': 'Very poor performance. Parental guidance needed.',
        'D': 'Critical intervention required.',
        'D-': 'Academic warning issued.',
        'E': 'Repeat subject recommended.'
    }
    return remarks.get(grade, 'Performance needs improvement.')

# ==================== Decorators ====================
def subscription_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('login'))
        if not current_user.is_subscription_valid():
            flash('Your subscription has expired. Please renew to continue.', 'warning')
            return redirect(url_for('subscribe'))
        return f(*args, **kwargs)
    return decorated_function

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
        remember = True if request.form.get('remember') else False
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            flash('Please check your login details and try again.', 'danger')
            return redirect(url_for('login'))
        
        login_user(user, remember=remember)
        return redirect(url_for('dashboard'))
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        phone = request.form.get('phone')
        
        user = User.query.filter_by(email=email).first()
        if user:
            flash('Email address already exists', 'danger')
            return redirect(url_for('register'))
        
        new_user = User(
            email=email, 
            username=username,
            phone_number=phone
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
@subscription_required
def dashboard():
    students_count = Student.query.filter_by(user_id=current_user.id).count()
    subjects_count = Subject.query.filter_by(user_id=current_user.id).count()
    results_count = Result.query.join(Student).filter(Student.user_id == current_user.id).count()
    
    return render_template('dashboard.html', 
                         user=current_user,
                         students_count=students_count,
                         subjects_count=subjects_count,
                         results_count=results_count)

@app.route('/subscribe')
def subscribe():
    return render_template('subscribe.html')

@app.route('/api/mpesa/stkpush', methods=['POST'])
def mpesa_stkpush():
    try:
        data = request.json
        customer_phone = data.get('phone')
        amount = data.get('amount')
        plan = data.get('plan')
        user_id = data.get('user_id')
        
        # Initialize M-PESA
        mpesa = MpesaPayment()
        
        # Send STK Push
        response = mpesa.stk_push(
            customer_phone=customer_phone,
            amount=amount,
            account_reference=f"REPORTHUB-{plan}"
        )
        
        # Save payment record
        if 'CheckoutRequestID' in response:
            payment = Payment(
                user_id=user_id,
                phone_number=customer_phone,
                amount=amount,
                plan=plan,
                checkout_request_id=response['CheckoutRequestID'],
                merchant_request_id=response.get('MerchantRequestID'),
                status='pending'
            )
            db.session.add(payment)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'STK Push sent successfully',
            'data': response
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/mpesa-callback', methods=['POST'])
def mpesa_callback():
    """M-PESA callback URL"""
    data = request.json
    
    if data and 'Body' in data:
        stk_callback = data['Body']['stkCallback']
        checkout_id = stk_callback['CheckoutRequestID']
        result_code = stk_callback['ResultCode']
        
        payment = Payment.query.filter_by(checkout_request_id=checkout_id).first()
        
        if payment:
            if result_code == 0:
                # Successful payment
                payment.status = 'completed'
                payment.mpesa_receipt = stk_callback['CallbackMetadata']['Item'][1]['Value']
                payment.transaction_date = datetime.now()
                
                # Activate user subscription
                user = User.query.get(payment.user_id)
                user.subscription_active = True
                if payment.plan == 'monthly':
                    user.subscription_end = datetime.now() + timedelta(days=30)
                elif payment.plan == 'quarterly':
                    user.subscription_end = datetime.now() + timedelta(days=90)
                elif payment.plan == 'yearly':
                    user.subscription_end = datetime.now() + timedelta(days=365)
                user.subscription_plan = payment.plan
            else:
                payment.status = 'failed'
            
            db.session.commit()
    
    return jsonify({"ResultCode": 0, "ResultDesc": "Success"})

@app.route('/api/process_excel', methods=['POST'])
@login_required
@subscription_required
def process_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    try:
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
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
            remarks = get_remarks(grade)
            
            results.append({
                'name': row.get('name', 'Unknown'),
                'admission': row.get('admission', ''),
                'subject': row.get('subject', 'Unknown'),
                'cat1': float(row.get('cat1', 0)),
                'cat2': float(row.get('cat2', 0)),
                'exam': float(row.get('end_term_exam', 0)),
                'final_score': final_score,
                'grade': grade,
                'remarks': remarks
            })
        
        return jsonify({'success': True, 'results': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_performance', methods=['POST'])
@login_required
@subscription_required
def analyze_performance():
    try:
        data = request.json
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert educational analyst. Provide detailed performance analysis and recommendations."},
                {"role": "user", "content": f"Analyze this student's performance data and provide insights: {json.dumps(data)}"}
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        return jsonify({
            'success': True,
            'analysis': response.choices[0].message.content
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/career_assessment', methods=['POST'])
@login_required
@subscription_required
def career_assessment():
    try:
        data = request.json
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a career guidance expert. Provide detailed career recommendations based on academic performance and interests."},
                {"role": "user", "content": f"Based on this student's profile, suggest career paths and required subjects: {json.dumps(data)}"}
            ],
            max_tokens=600,
            temperature=0.7
        )
        
        return jsonify({
            'success': True,
            'assessment': response.choices[0].message.content
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/school/update', methods=['POST'])
@login_required
@subscription_required
def update_school():
    try:
        current_user.school_name = request.form.get('school_name')
        current_user.school_address = request.form.get('school_address')
        current_user.school_phone = request.form.get('school_phone')
        current_user.school_email = request.form.get('school_email')
        
        if 'logo' in request.files:
            logo = request.files['logo']
            if logo.filename:
                # Save logo logic here
                pass
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'School details updated'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create database tables
with app.app_context():
    db.create_all()
    
    # Add default subjects if none exist
    if Subject.query.count() == 0:
        default_subjects = [
            {'name': 'Mathematics', 'code': 'MATH'},
            {'name': 'English', 'code': 'ENG'},
            {'name': 'Kiswahili', 'code': 'KISW'},
            {'name': 'Biology', 'code': 'BIO'},
            {'name': 'Chemistry', 'code': 'CHEM'},
            {'name': 'Physics', 'code': 'PHY'},
            {'name': 'History', 'code': 'HIST'},
            {'name': 'Geography', 'code': 'GEO'},
            {'name': 'CRE', 'code': 'CRE'},
            {'name': 'Business Studies', 'code': 'BUS'},
            {'name': 'Agriculture', 'code': 'AGR'},
            {'name': 'Computer Studies', 'code': 'COMP'}
        ]
        for subject in default_subjects:
            db.session.add(Subject(**subject))
        db.session.commit()

# This is needed for Vercel
app = app

if __name__ == '__main__':
    app.run(debug=True)
