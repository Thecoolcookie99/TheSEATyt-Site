from flask import Flask, request, jsonify
import os

app = Flask(__name__)


@app.after_request
def add_cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return resp


@app.route('/auth', methods=['POST', 'OPTIONS'])
def auth():
    if request.method == 'OPTIONS':
        return jsonify({}), 204

    data = request.get_json(silent=True) or {}
    pw = data.get('password', '')
    if not pw:
        return jsonify({'ok': False}), 400

    env_pw = os.environ.get('FILES_PASSWORD')
    if env_pw and pw == env_pw:
        return jsonify({'ok': True})
    return jsonify({'ok': False}), 401


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
