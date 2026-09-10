"""
database.py — Inicialização e acesso ao SQLite para o StockRL
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "leaderboard.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            eqm       REAL    NOT NULL,
            lucro     REAL    NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("[DB] Banco inicializado em", DB_PATH)
