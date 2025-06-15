const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { stringify } = require('csv-stringify');
const db = require('./database');
const fs = require('fs'); // Para manipular arquivos do sistema (remover imagem)

const app = express();
const port = 3000;

const PERCENTUAL_VENDA_PADRAO = 1.30;
const ADMIN_PASSWORD = 'admin';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const escapeHTML = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
};

// --- ROTAS PRINCIPAIS ---

app.get('/', async (req, res) => {
    try {
        const itens = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM itens ORDER BY nome', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const clientes = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM clientes ORDER BY nome', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const vendas = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM vendas ORDER BY data_venda DESC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const vendasComItens = await Promise.all(vendas.map(async (venda) => {
            const vendaItens = await new Promise((resolve, reject) => {
                db.all('SELECT * FROM venda_itens WHERE venda_id = ?', [venda.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            return { ...venda, items: vendaItens };
        }));

        res.render('index', {
            itens: itens,
            clientes: clientes,
            vendas: vendasComItens,
            PERCENTUAL_VENDA_PADRAO: PERCENTUAL_VENDA_PADRAO,
            escapeHTML: escapeHTML
        });

    } catch (err) {
        console.error('Erro ao carregar dados:', err.message);
        res.status(500).send('Erro ao carregar a página.');
    }
});

// --- ROTAS DE API PARA CLIENT-SCRIPT.JS BUSCAR DADOS ---
app.get('/api/itens', async (req, res) => {
    try {
        const itens = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM itens ORDER BY nome', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(itens);
    } catch (err) {
        console.error('Erro ao buscar itens via API:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao buscar itens.' });
    }
});

app.get('/api/clientes', async (req, res) => {
    try {
        const clientes = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM clientes ORDER BY nome', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(clientes);
    }  catch (err) {
        console.error('Erro ao buscar clientes via API:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao buscar clientes.' });
    }
});


// --- ROTAS DE ITENS (PRODUTOS) ---

app.post('/itens/adicionar', upload.array('imagens_item'), (req, res) => {
    const itemsData = JSON.parse(req.body.items);
    const files = req.files || [];

    const fileMap = new Map();
    files.forEach(file => {
        fileMap.set(file.originalname, file.filename);
    });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        itemsData.forEach((item) => {
            const imagemNome = item.imagem_original_nome ? fileMap.get(item.imagem_original_nome) : null;

            const { nome, quantidade, valor_interno, valor_venda } = item;
            if (!nome || isNaN(quantidade) || quantidade <= 0 || isNaN(valor_interno) || valor_interno <= 0 || isNaN(valor_venda) || valor_venda <= 0) {
                console.warn(`Item inválido ignorado na adição: ${JSON.stringify(item)}`);
                return;
            }

            db.run('INSERT INTO itens (nome, quantidade, valor_interno, valor_venda, imagem) VALUES (?, ?, ?, ?, ?)',
                [nome, parseInt(quantidade), parseFloat(valor_interno), parseFloat(valor_venda), imagemNome],
                function (err) {
                    if (err) {
                        console.error('Erro ao adicionar item:', err.message);
                    }
                }
            );
        });
        db.run("COMMIT;", (err) => {
            if (err) {
                console.error('Erro ao commitar transação de itens:', err.message);
                res.status(500).json({ success: false, message: 'Erro ao salvar itens.' });
            } else {
                res.json({ success: true, message: 'Itens salvos com sucesso!' });
            }
        });
    });
});

// **NOVA ROTA: PUT para atualizar múltiplos itens (dados textuais)**
app.put('/itens/atualizar-multiplos', async (req, res) => {
    const itemsToUpdate = req.body.items;
    if (!itemsToUpdate || !Array.isArray(itemsToUpdate) || itemsToUpdate.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum item para atualizar.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        let hasError = false;

        itemsToUpdate.forEach(itemData => {
            const { id, nome, quantidade, valor_interno, valor_venda } = itemData;

            if (!id || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(valor_interno) || valor_interno < 0 || isNaN(valor_venda) || valor_venda < 0) {
                console.warn(`Dados inválidos para o item ID ${id}. Ignorando atualização.`);
                hasError = true;
                return;
            }

            const query = 'UPDATE itens SET nome = ?, quantidade = ?, valor_interno = ?, valor_venda = ? WHERE id = ?';
            const params = [nome, parseInt(quantidade), parseFloat(valor_interno), parseFloat(valor_venda), id];

            db.run(query, params, function (err) {
                if (err) {
                    console.error(`Erro ao atualizar item ${id}:`, err.message);
                    hasError = true;
                }
            });
        });

        if (hasError) {
            db.run("ROLLBACK;", (rollbackErr) => {
                if (rollbackErr) console.error('Erro ao fazer rollback:', rollbackErr.message);
                res.status(500).json({ success: false, message: 'Erro ao atualizar alguns itens. As alterações foram desfeitas.' });
            });
        } else {
            db.run("COMMIT;", (commitErr) => {
                if (commitErr) {
                    console.error('Erro ao commitar transação de atualização de múltiplos itens:', commitErr.message);
                    res.status(500).json({ success: false, message: 'Erro ao salvar alterações.' });
                } else {
                    res.json({ success: true, message: 'Todas as alterações dos itens salvas com sucesso!' });
                }
            });
        }
    });
});


// PUT para atualizar um único item (usado agora para remoção de imagem ou upload de NOVA imagem)
app.put('/itens/atualizar/:id', upload.single('imagem_item'), async (req, res) => {
    const id = req.params.id;
    // req.body agora virá com nome, quantidade, valor_interno, valor_venda
    // Estes campos são passados pelo frontend para que o backend tenha os valores atuais e não os zere.
    const { nome, quantidade, valor_interno, valor_venda, imagem_atual_mantida, imagem_existente } = req.body;
    const novaImagem = req.file ? req.file.filename : null;

    if (!nome || isNaN(quantidade) || quantidade < 0 || isNaN(valor_interno) || valor_interno < 0 || isNaN(valor_venda) || valor_venda < 0) {
        return res.status(400).json({ success: false, message: 'Dados inválidos.' });
    }

    let query = 'UPDATE itens SET nome = ?, quantidade = ?, valor_interno = ?, valor_venda = ?';
    const params = [nome, parseInt(quantidade), parseFloat(valor_interno), parseFloat(valor_venda)];

    let oldImagePath = null;
    if (novaImagem) { // Se uma NOVA imagem foi enviada
        query += ', imagem = ?';
        params.push(novaImagem);
        // Buscar a imagem antiga para remoção (se existir)
        const oldItem = await new Promise((resolve, reject) => {
            db.get('SELECT imagem FROM itens WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (oldItem && oldItem.imagem) {
            oldImagePath = path.join(__dirname, 'public/uploads', oldItem.imagem);
        }
    } else if (imagem_atual_mantida === 'false') { // Se o frontend explicitamente pediu para remover a imagem
        query += ', imagem = NULL';
        if (imagem_existente) {
            oldImagePath = path.join(__dirname, 'public/uploads', imagem_existente);
        }
    }
    // Se imagem_atual_mantida é 'true' e não há nova imagem, a imagem existente é mantida (nenhuma alteração no campo 'imagem' na query).

    query += ' WHERE id = ?';
    params.push(id);

    db.run(query, params, function (err) {
        if (err) {
            console.error('Erro ao atualizar item:', err.message);
            if (err.message.includes('UNIQUE constraint failed: itens.nome')) {
                return res.status(409).json({ success: false, message: 'Já existe um item com este nome.' });
            }
            return res.status(500).json({ success: false, message: 'Erro ao atualizar item.' });
        }

        // Remover arquivo de imagem antigo do sistema de arquivos se necessário
        if (oldImagePath && fs.existsSync(oldImagePath)) {
            fs.unlink(oldImagePath, (unlinkErr) => {
                if (unlinkErr) console.error('Erro ao remover arquivo de imagem antigo:', unlinkErr);
            });
        }
        res.json({ success: true, message: 'Item atualizado com sucesso!' });
    });
});


app.delete('/itens/excluir/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const item = await new Promise((resolve, reject) => {
            db.get('SELECT imagem FROM itens WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        db.run('DELETE FROM itens WHERE id = ?', id, function (err) {
            if (err) {
                console.error('Erro ao excluir item:', err.message);
                return res.status(500).json({ success: false, message: 'Erro ao excluir item.' });
            }
            if (item && item.imagem) {
                const imagePath = path.join(__dirname, 'public/uploads', item.imagem);
                if (fs.existsSync(imagePath)) {
                    fs.unlink(imagePath, (unlinkErr) => {
                        if (unlinkErr) console.error('Erro ao remover arquivo de imagem:', unlinkErr);
                    });
                }
            }
            res.json({ success: true, message: 'Item excluído com sucesso!' });
        });
    } catch (err) {
        console.error('Erro ao buscar item para exclusão:', err.message);
        res.status(500).json({ success: false, message: 'Erro ao excluir item.' });
    }
});


// --- ROTAS DE CLIENTES ---

app.post('/clientes/adicionar', (req, res) => {
    const { name, phone, address } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'O nome do cliente é obrigatório.' });
    }
    db.run('INSERT INTO clientes (nome, telefone, endereco) VALUES (?, ?, ?)',
        [name, phone || null, address || null],
        function (err) {
            if (err) {
                console.error('Erro ao adicionar cliente:', err.message);
                return res.status(500).json({ success: false, message: 'Erro ao adicionar cliente.' });
            }
            res.json({ success: true, message: 'Cliente cadastrado com sucesso!', id: this.lastID });
        }
    );
});

app.put('/clientes/atualizar/:id', (req, res) => {
    const id = req.params.id;
    const { name, phone, address } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'O nome do cliente é obrigatório.' });
    }
    db.run('UPDATE clientes SET nome = ?, telefone = ?, endereco = ? WHERE id = ?',
        [name, phone || null, address || null, id],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar cliente:', err.message);
                return res.status(500).json({ success: false, message: 'Erro ao atualizar cliente.' });
            }
            res.json({ success: true, message: 'Cliente atualizado com sucesso!' });
        }
    );
});

app.delete('/clientes/excluir/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM clientes WHERE id = ?', id, function (err) {
        if (err) {
            console.error('Erro ao excluir cliente:', err.message);
            return res.status(500).json({ success: false, message: 'Erro ao excluir cliente.' });
        }
        res.json({ success: true, message: 'Cliente excluído com sucesso!' });
    });
});

// --- ROTAS DE VENDAS ---

app.post('/vendas/registrar', async (req, res) => {
    const { cliente_id, cliente_nome_anonimo, items, desconto, metodo_pagamento } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Adicione pelo menos um item à venda.' });
    }
    if (!metodo_pagamento) {
        return res.status(400).json({ success: false, message: 'Por favor, selecione o método de pagamento.' });
    }

    let total_pecas = 0;
    let valor_bruto = 0;
    let custo_interno_total = 0;

    for (const itemVenda of items) {
        const itemDoBanco = await new Promise((resolve, reject) => {
            db.get('SELECT quantidade, valor_interno, valor_venda FROM itens WHERE id = ?', [itemVenda.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!itemDoBanco || itemVenda.quantidade > itemDoBanco.quantidade) {
            return res.status(400).json({ success: false, message: `Estoque insuficiente para ${itemVenda.nome}.` });
        }
        total_pecas += itemVenda.quantidade;
        valor_bruto += itemVenda.quantidade * itemDoBanco.valor_venda;
        custo_interno_total += itemVenda.quantidade * itemDoBanco.valor_interno;
    }

    let valor_total = valor_bruto - parseFloat(desconto || 0);

    // Validação de desconto para não ir abaixo do custo interno (com tolerância para ponto flutuante)
    if (valor_total < custo_interno_total - Number.EPSILON) {
        const maxDiscountAllowed = valor_bruto - custo_interno_total;
        return res.status(400).json({ success: false, message: `O desconto excede o limite! Desconto máximo permitido: R$ ${maxDiscountAllowed.toFixed(2)}. Ajuste o desconto.` });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        db.run('INSERT INTO vendas (cliente_id, cliente_nome_anonimo, valor_total, total_pecas, desconto, metodo_pagamento, custo_interno_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cliente_id === 'cliente-sem-cadastro' ? null : cliente_id, cliente_id === 'cliente-sem-cadastro' ? cliente_nome_anonimo : null, valor_total, total_pecas, parseFloat(desconto || 0), metodo_pagamento, custo_interno_total],
            function (err) {
                if (err) {
                    console.error('Erro ao registrar venda:', err.message);
                    db.run("ROLLBACK;");
                    return res.status(500).json({ success: false, message: 'Erro ao registrar venda.' });
                }

                const venda_id = this.lastID;

                items.forEach(itemVenda => {
                    db.run('INSERT INTO venda_itens (venda_id, item_id, nome_item, quantidade_vendida, valor_unitario_venda, valor_interno_unitario) VALUES (?, ?, ?, ?, ?, ?)',
                        [venda_id, itemVenda.id, itemVenda.nome, itemVenda.quantidade, itemVenda.valor_unitario, itemVenda.valor_interno_unitario],
                        function (err) {
                            if (err) {
                                console.error('Erro ao adicionar item da venda:', err.message);
                                db.run("ROLLBACK;");
                                return res.status(500).json({ success: false, message: 'Erro ao registrar venda (item).' });
                            }
                        }
                    );
                    db.run('UPDATE itens SET quantidade = quantidade - ? WHERE id = ?',
                        [itemVenda.quantidade, itemVenda.id],
                        function (err) {
                            if (err) {
                                console.error('Erro ao atualizar estoque:', err.message);
                                db.run("ROLLBACK;");
                                return res.status(500).json({ success: false, message: 'Erro ao registrar venda (estoque).' });
                            }
                        }
                    );
                });

                db.run("COMMIT;", (err) => {
                    if (err) {
                        console.error('Erro ao commitar transação de venda:', err.message);
                        res.status(500).json({ success: false, message: 'Erro ao registrar venda.' });
                    } else {
                        res.json({ success: true, message: 'Venda registrada e estoque atualizado com sucesso!' });
                    }
                });
            }
        );
    });
});


app.delete('/vendas/excluir/:id', async (req, res) => {
    const vendaId = req.params.id;

    try {
        const password = req.body.password;
        if (password !== ADMIN_PASSWORD) {
            return res.status(403).json({ success: false, message: 'Senha de administrador incorreta.' });
        }

        const vendaItens = await new Promise((resolve, reject) => {
            db.all('SELECT item_id, quantidade_vendida FROM venda_itens WHERE venda_id = ?', [vendaId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION;");

            vendaItens.forEach(item => {
                db.run('UPDATE itens SET quantidade = quantidade + ? WHERE id = ?',
                    [item.quantidade_vendida, item.item_id],
                    function (err) {
                        if (err) {
                            console.error('Erro ao reverter estoque:', err.message);
                            db.run("ROLLBACK;");
                            return res.status(500).json({ success: false, message: 'Erro ao excluir venda (reversão de estoque).' });
                        }
                    }
                );
            });

            db.run('DELETE FROM venda_itens WHERE venda_id = ?', [vendaId], function(err) {
                if (err) {
                    console.error('Erro ao excluir itens da venda:', err.message);
                    db.run("ROLLBACK;");
                    return res.status(500).json({ success: false, message: 'Erro ao excluir venda.' });
                }
            });

            db.run('DELETE FROM vendas WHERE id = ?', [vendaId], function (err) {
                if (err) {
                    console.error('Erro ao excluir venda principal:', err.message);
                    db.run("ROLLBACK;");
                    return res.status(500).json({ success: false, message: 'Erro ao excluir venda.' });
                }
                db.run("COMMIT;", (commitErr) => {
                    if (commitErr) {
                        console.error('Erro ao commitar transação de exclusão de venda:', commitErr.message);
                        return res.status(500).json({ success: false, message: 'Erro ao excluir venda.' });
                    }
                    res.json({ success: true, message: 'Venda excluída e estoque revertido com sucesso!' });
                });
            });
        });

    } catch (error) {
        console.error('Erro geral ao excluir venda:', error.message);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao excluir venda.' });
    }
});

app.post('/vendas/limpar-historico', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, message: 'Senha de administrador incorreta.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        db.run('DELETE FROM venda_itens', [], (err) => {
            if (err) {
                console.error('Erro ao limpar venda_itens:', err.message);
                db.run("ROLLBACK;");
                return res.status(500).json({ success: false, message: 'Erro ao limpar histórico de vendas.' });
            }
            db.run('DELETE FROM vendas', [], (err) => {
                if (err) {
                    console.error('Erro ao limpar vendas:', err.message);
                    db.run("ROLLBACK;");
                    return res.status(500).json({ success: false, message: 'Erro ao limpar histórico de vendas.' });
                }
                db.run("COMMIT;", (err) => {
                    if (err) {
                        console.error('Erro ao commitar limpeza de histórico:', err.message);
                        res.status(500).json({ success: false, message: 'Erro ao limpar histórico de vendas.' });
                    } else {
                        res.json({ success: true, message: 'Histórico de vendas limpo com sucesso!' });
                    }
                });
            });
        });
    });
});

app.get('/vendas/exportar-csv', async (req, res) => {
    try {
        const sales = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM vendas ORDER BY data_venda DESC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const salesWithDetails = await Promise.all(sales.map(async (sale) => {
            const items = await new Promise((resolve, reject) => {
                db.all('SELECT nome_item, quantidade_vendida, valor_unitario_venda FROM venda_itens WHERE venda_id = ?', [sale.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            let clientInfo = {};
            if (sale.cliente_id) {
                const client = await new Promise((resolve, reject) => {
                    db.get('SELECT nome, telefone, endereco FROM clientes WHERE id = ?', [sale.cliente_id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                if (client) {
                    clientInfo = {
                        Cliente_Nome: client.nome,
                        Cliente_Telefone: client.telefone,
                        Cliente_Endereco: client.endereco
                    };
                }
            } else {
                clientInfo = {
                    Cliente_Nome: sale.cliente_nome_anonimo || 'Sem Cadastro',
                    Cliente_Telefone: 'N/A',
                    Cliente_Endereco: 'N/A'
                };
            }

            return {
                ID_Venda: sale.id,
                Data: new Date(sale.data_venda).toLocaleString('pt-BR'),
                ...clientInfo,
                Itens_Vendidos: items.map(item => `${item.nome_item} (${item.quantidade_vendida}un - R$${item.valor_unitario_venda.toFixed(2)})`).join(' | '),
                Total_Pecas: sale.total_pecas,
                Desconto: sale.desconto.toFixed(2),
                Metodo_Pagamento: sale.metodo_pagamento,
                Valor_Final_Venda: sale.valor_total.toFixed(2),
                Custo_Interno_Total: sale.custo_interno_total.toFixed(2),
                Lucro_Estimado_Venda: (sale.valor_total - sale.custo_interno_total).toFixed(2)
            };
        }));

        if (salesWithDetails.length === 0) {
            return res.status(404).send('Nenhum dado de vendas para exportar.');
        }

        stringify(salesWithDetails, { header: true, delimiter: ';' }, (err, output) => {
            if (err) {
                console.error('Erro ao gerar CSV:', err.message);
                return res.status(500).send('Erro ao gerar CSV.');
            }
            res.header('Content-Type', 'text/csv; charset=utf-8');
            res.attachment('historico_vendas.csv');
            res.send(output);
        });

    } catch (err) {
        console.error('Erro ao exportar vendas para CSV:', err.message);
        res.status(500).send('Erro ao exportar vendas.');
    }
});

app.listen(port, () => {
    console.log(`Servidor de Gerenciamento rodando em http://localhost:${port}`);
});