# StockRL — Laboratório de Regressão na Bolsa 📈

> Jogo didático de **Regressão Linear** para previsão de bolsa de valores.  
> Criado para o curso **Matemática e Tecnologias Digitais — UFPR**

---

## Como rodar na feira

### 1. Instalar dependências do backend

```bash
cd matematica/backend
pip install -r requirements.txt
```

### 2. Iniciar o backend (leaderboard)

```bash
python app.py
```

O servidor vai rodar em `http://localhost:5000`.  
O banco `leaderboard.db` é criado automaticamente na primeira execução.

### 3. Abrir o jogo

Abra `matematica/index.html` diretamente no navegador (duplo clique) **ou** sirva com um servidor local:

```bash
# Na pasta matematica/
python -m http.server 8080
# Acesse http://localhost:8080
```

> **Dica de feira:** Abra o frontend em tela cheia (F11) para melhor experiência.

---

## Funcionamento sem backend

O jogo funciona **100% offline** — sem o backend Flask rodando, o leaderboard simplesmente ficará vazio, mas toda a mecânica do jogo (sliders, gráfico, cálculo de EQM/lucro) funciona normalmente.

---

## Estrutura do projeto

```
matematica/
├── index.html          ← Jogo (frontend puro)
├── game.js             ← Lógica do jogo (geração sintética, EQM, UI)
├── chart.js            ← Renderização do gráfico (Canvas API)
├── style.css           ← Estilos (identidade visual UFPR)
└── backend/
    ├── app.py          ← Flask API
    ├── database.py     ← SQLite helper
    ├── requirements.txt
    └── leaderboard.db  ← Banco (gerado automaticamente)
```

---

## Mecânica matemática

**Modelo do jogador:**
```
ŷ(t) = β₀ + β₁·t
```

**Erro Quadrático Médio (EQM):**
```
EQM = (1/n) · Σ(yᵢ − ŷᵢ)²
```

**Cálculo do lucro:**
```
Lucro = R$ 10.000 / (1 + EQM / EQM_ref)
```

| EQM | Lucro estimado |
|-----|----------------|
| 0   | R$ 10.000 |
| 250 | R$ 7.143 |
| 500 | R$ 5.556 |
| 1000| R$ 3.571 |
| 2500| R$ 1.667 |

---

## API do backend

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/health` | Verificação de saúde |
| `POST` | `/score` | Salva resultado `{name, eqm, lucro}` |
| `GET`  | `/leaderboard` | Top 10 ordenado por EQM ASC |
