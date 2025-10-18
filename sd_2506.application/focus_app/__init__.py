from flask import Flask
import secrets

app = Flask(__name__)
app.config.from_object('focus_app.config')
app.secret_key = '83d2ea90c7b14f8d65e2c0931a7fbe41b2e9d6a173c5f048a7e03d1bfc92e8ad'

# session
app.secret_key = secrets.token_hex(16)

from . import main