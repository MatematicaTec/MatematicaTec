"""
app.py — Backend Flask para o StockRL (Leaderboard)
Endpoints: POST /score  |  GET /leaderboard  |  GET /health
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import init_db, get_connection

app = Flask(__name__)
CORS(app)  # Permite requisições do frontend local

# ─── Health check ────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "StockRL Leaderboard"})


# ─── Salvar score ─────────────────────────────────────────────────────────────

@app.route("/score", methods=["POST"])
def post_score():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "JSON inválido"}), 400

    name  = str(data.get("name",  "")).strip()
    eqm   = data.get("eqm")
    lucro = data.get("lucro")

    # Validações
    if not name or len(name) < 2:
        return jsonify({"error": "Nome deve ter pelo menos 2 caracteres"}), 400
    if eqm is None or not isinstance(eqm, (int, float)) or eqm < 0:
        return jsonify({"error": "EQM inválido"}), 400
    if lucro is None or not isinstance(lucro, (int, float)):
        return jsonify({"error": "Lucro inválido"}), 400

    conn = get_connection()
    conn.execute(
        "INSERT INTO scores (name, eqm, lucro) VALUES (?, ?, ?)",
        (name[:50], round(float(eqm), 4), round(float(lucro), 2))
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Score salvo com sucesso!"}), 201


# ─── Leaderboard ─────────────────────────────────────────────────────────────

@app.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    conn = get_connection()
    rows = conn.execute("""
        SELECT name, eqm, lucro
        FROM scores
        ORDER BY eqm ASC, lucro DESC
        LIMIT 10
    """).fetchall()
    conn.close()

    leaderboard = []
    for i, row in enumerate(rows, start=1):
        leaderboard.append({
            "rank":  i,
            "name":  row["name"],
            "eqm":   row["eqm"],
            "lucro": row["lucro"],
        })

    return jsonify({"leaderboard": leaderboard})


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("[StockRL] Servidor rodando em http://localhost:5000")
    app.run(debug=False, port=5000, host="0.0.0.0")
