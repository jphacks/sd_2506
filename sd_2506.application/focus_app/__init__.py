from flask import Flask
import secrets

app = Flask(__name__)
app.config.from_object('focus_app.config')

# session
app.secret_key = secrets.token_hex(16)

from . import main