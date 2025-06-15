const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gerenciador.db', (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');

        db.serialize(() => {
            // Tabela para Itens/Produtos
            db.run(`CREATE TABLE IF NOT EXISTS itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                quantidade INTEGER NOT NULL,
                valor_interno REAL NOT NULL,
                valor_venda REAL NOT NULL,
                imagem TEXT,
                criado_em TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error('Erro ao criar a tabela de itens:', err.message);
                else console.log('Tabela de itens verificada/criada.');
            });

            // Tabela para Clientes
            db.run(`CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT,
                endereco TEXT,
                criado_em TEXT DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error('Erro ao criar a tabela de clientes:', err.message);
                else console.log('Tabela de clientes verificada/criada.');
            });

            // Tabela para Vendas
            db.run(`CREATE TABLE IF NOT EXISTS vendas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER,
                cliente_nome_anonimo TEXT, -- Para clientes sem cadastro
                data_venda TEXT DEFAULT CURRENT_TIMESTAMP,
                valor_total REAL NOT NULL,
                total_pecas INTEGER NOT NULL,
                desconto REAL NOT NULL,
                metodo_pagamento TEXT NOT NULL,
                custo_interno_total REAL NOT NULL,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
            )`, (err) => {
                if (err) console.error('Erro ao criar a tabela de vendas:', err.message);
                else console.log('Tabela de vendas verificada/criada.');
            });

            // Tabela para os itens de cada venda (detalhes da venda)
            db.run(`CREATE TABLE IF NOT EXISTS venda_itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venda_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                nome_item TEXT NOT NULL,
                quantidade_vendida INTEGER NOT NULL,
                valor_unitario_venda REAL NOT NULL,
                valor_interno_unitario REAL NOT NULL,
                FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES itens(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error('Erro ao criar a tabela de venda_itens:', err.message);
                else console.log('Tabela de venda_itens verificada/criada.');
            });

            // Habilitar FOREIGN KEY enforcement (importante para ON DELETE CASCADE)
            db.get("PRAGMA foreign_keys = ON");
        });
    }
});

module.exports = db;