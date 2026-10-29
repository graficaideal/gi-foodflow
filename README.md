# GI — Gestão de Cantina 

App de gestão de cantina da Gráfica Ideal.

## Estrutura

```
gi-cantina/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── App.jsx          ← toda a lógica e UI aqui
```

## Instalação e arranque

```bash
cd gi-cantina
npm install
npm run dev
```

Abre em `http://localhost:5173`

## Modos de operação

Cada computador deve ter o URL configurado com o modo correto:

| Computador         | URL                              |
|--------------------|----------------------------------|
| Marcações          | `http://localhost:5173/?mode=marcacoes`  |
| Validações (cozinha)| `http://localhost:5173/?mode=validacoes` |
| Backoffice         | `http://localhost:5173/?mode=backoffice` |

Em produção (Vercel), substitui `localhost:5173` pelo domínio real.

## Dados de teste (funcionários)

| Nome           | PIN  | RFID    |
|----------------|------|---------|
| Ana Silva      | 1234 | CARD001 |
| Bruno Costa    | 5678 | CARD002 |
| Carla Mendes   | 9012 | CARD003 |
| David Santos   | 3456 | CARD004 |
| Eva Rodrigues  | 7890 | CARD005 |

No terminal de validações, simula o RFID digitando o UID (ex: `CARD001`) e premindo Enter — exatamente como o leitor HID faria.

## RFID — como funciona

Os leitores RFID USB HID enviam o UID do cartão como sequência de teclas + Enter.
A app captura isso via `window.addEventListener('keydown', ...)` — plug and play, sem drivers.
Leitores recomendados: qualquer leitor USB HID 125kHz ou 13.56MHz (~15–30€).

## Migração para Supabase

Quando criares o projeto Supabase, descomenta as linhas no topo do `App.jsx`
e substitui os dados em memória por chamadas à API.

Tabelas necessárias:
- `cantina_funcionarios` (id, numero, nome, pin, rfid, foto_url, ativo)
- `cantina_ementas` (id, data, tipo, prato1_label, prato1_desc, ... prato4_label, prato4_desc)
- `cantina_marcacoes` (id, funcionario_id, ementa_id, prato_num, created_at)
- `cantina_consumos` (id, funcionario_id, ementa_id, prato_num, validado_em)

## Deploy (Vercel)

```bash
npm run build
# faz push para GitHub e liga ao Vercel como habitualmente
```
