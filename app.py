from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "ReportHub is LIVE!", "status": "success"})

app = app
