from flask import Flask

app = Flask(__name__)
app.config.from_object('focus_app.config')

from . import main