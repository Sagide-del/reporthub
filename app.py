from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "message": "ReportHub API - Clean Deployment",
        "status": "success"
    })

app = app
