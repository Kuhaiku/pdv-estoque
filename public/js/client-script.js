document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis de Configuração ---
    const PERCENTUAL_VENDA_PADRAO = 1.00;
    const ADMIN_PASSWORD = 'admin';

    // --- Elementos do DOM ---
    const addItemForm = document.getElementById('add-item-form');
    const itemsToAddContainer = document.getElementById('items-to-add-container');
    const addAnotherItemBtn = document.getElementById('add-another-item-btn');
    const itemsTableBody = document.querySelector('#items-table tbody');
    const saveAllItemsBtn = document.getElementById('save-all-items-btn');

    const addClientForm = document.getElementById('add-client-form');
    const clientRegisterNameInput = document.getElementById('client-register-name');
    const clientRegisterPhoneInput = document.getElementById('client-register-phone');
    const clientRegisterAddressInput = document.getElementById('client-register-address');
    const clientsTableBody = document.querySelector('#clients-table tbody');

    const newSaleForm = document.getElementById('new-sale-form');
    const saleClientSelect = document.getElementById('sale-client-select');
    const clientAnonymousNameContainer = document.getElementById('client-anonymous-name-container');
    const saleClientNameInputAnonymous = document.getElementById('sale-client-name-anonymous');

    const saleItemsContainer = document.getElementById('sale-items-container');
    const addItemToSaleBtn = document.getElementById('add-item-to-sale-btn');
    const totalPiecesSoldSpan = document.getElementById('total-pieces-sold');
    const totalValueBeforeDiscountSpan = document.getElementById('total-value-before-discount');
    const discountAppliedSpan = document.getElementById('discount-applied');
    const totalSaleValueSpan = document.getElementById('total-sale-value');
    const salesHistoryContainer = document.getElementById('sales-history-container');
    const grandTotalValueSpan = document.getElementById('grand-total-value');
    const estimatedProfitValueSpan = document.getElementById('estimated-profit-value');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const exportSalesBtn = document.getElementById('export-sales-btn');

    const saleDiscountInput = document.getElementById('sale-discount');
    const paymentMethodSelect = document.getElementById('payment-method');
    const discountGroup = document.getElementById('discount-group');
    const paymentMethodGroup = document.getElementById('payment-method-group');

    let availableItems = [];
    let clients = [];

    // --- Funções Auxiliares de UI e Cálculos ---

    // Função para recarregar a página para refletir as mudanças no banco
    const reloadPage = () => {
        window.location.reload();
    };

    const calculateSaleValues = () => {
        const saleItems = saleItemsContainer.querySelectorAll('.sale-item');
        let totalPieces = 0;
        let totalValueBeforeDiscount = 0;
        let totalInternalValueForSale = 0;

        saleItems.forEach(itemDiv => {
            const quantityInput = itemDiv.querySelector('.sale-item-quantity');
            const select = itemDiv.querySelector('.sale-item-select');
            
            const quantity = parseInt(quantityInput.value) || 0;
            const selectedOption = select.options[select.selectedIndex];
            
            if (selectedOption && selectedOption.dataset.saleValue && selectedOption.dataset.internalValue) {
                const saleItemValue = parseFloat(selectedOption.dataset.saleValue);
                const internalItemValue = parseFloat(selectedOption.dataset.internalValue);
                
                totalPieces += quantity;
                totalValueBeforeDiscount += quantity * saleItemValue;
                totalInternalValueForSale += quantity * internalItemValue;
            }
        });

        const discount = parseFloat(saleDiscountInput.value) || 0;
        let finalValue = totalValueBeforeDiscount - discount;

        // Ajuste da lógica de desconto: permite que o valor final seja igual ao custo interno
        if (finalValue < totalInternalValueForSale) {
            const maxDiscountAllowed = totalValueBeforeDiscount - totalInternalValueForSale;
            
            if (totalValueBeforeDiscount < totalInternalValueForSale) {
                alert(`ATENÇÃO: O valor bruto da venda (R$${totalValueBeforeDiscount.toFixed(2)}) é menor que o custo interno total (R$${totalInternalValueForSale.toFixed(2)}). Ajuste os valores dos itens ou reavalie a venda.`);
                saleDiscountInput.value = '0.00';
                finalValue = totalValueBeforeDiscount;
            } else {
                const adjustedMaxDiscount = parseFloat(maxDiscountAllowed.toFixed(2));
                
                alert(`Desconto limitado! Desconto máximo permitido: R$ ${adjustedMaxDiscount.toFixed(2)}.`);
                saleDiscountInput.value = adjustedMaxDiscount.toFixed(2);
                finalValue = parseFloat((totalValueBeforeDiscount - adjustedMaxDiscount).toFixed(2));
            }
        } else if (finalValue < 0) {
            finalValue = 0;
            saleDiscountInput.value = totalValueBeforeDiscount.toFixed(2);
            alert(`O desconto não pode resultar em valor negativo. Desconto ajustado para R$ ${saleDiscountInput.value}.`);
        }

        totalPiecesSoldSpan.textContent = totalPieces;
        totalValueBeforeDiscountSpan.textContent = totalValueBeforeDiscount.toFixed(2);
        discountAppliedSpan.textContent = discount.toFixed(2);
        totalSaleValueSpan.textContent = finalValue.toFixed(2);

        return { totalPieces, totalValue: finalValue, totalInternalCost: totalInternalValueForSale };
    };

    const populateSaleItemSelect = (selectElement) => {
        let optionsHTML = '<option value="">Selecione um item...</option>';
        availableItems.forEach(item => {
            if (item.quantidade > 0) {
                optionsHTML += `<option value="${item.id}"
                                data-internal-value="${item.valor_interno.toFixed(2)}"
                                data-sale-value="${item.valor_venda.toFixed(2)}"
                                data-available-quantity="${item.quantidade}">
                                    ${item.nome} (Estoque: ${item.quantidade})
                                </option>`;
            }
        });
        selectElement.innerHTML = optionsHTML;
    };

    const populateClientSelect = () => {
        let optionsHTML = '<option value="cliente-sem-cadastro">Cliente Sem Cadastro</option>';
        clients.forEach(client => {
            optionsHTML += `<option value="${client.id}">${client.nome}</option>`;
        });
        saleClientSelect.innerHTML = optionsHTML;
    };

    const createSaleItemRow = () => {
        discountGroup.style.display = 'block';
        paymentMethodGroup.style.display = 'block';
        saleDiscountInput.required = true;
        paymentMethodSelect.required = true;

        const saleItemDiv = document.createElement('div');
        saleItemDiv.classList.add('sale-item');
        
        const select = document.createElement('select');
        select.classList.add('sale-item-select');
        select.required = true;
        populateSaleItemSelect(select);
        
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.placeholder = 'Qtd';
        quantityInput.className = 'sale-item-quantity';
        quantityInput.min = '1';
        quantityInput.required = true;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-sale-item-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i> Remover';

        saleItemDiv.append(select, quantityInput, removeBtn);
        saleItemsContainer.appendChild(saleItemDiv);
        calculateSaleValues();
    };

    const handleInitialAddItemInput = () => {
        const initialItemDiv = itemsToAddContainer.querySelector('.item-to-add');
        if (initialItemDiv) {
            const removeBtn = initialItemDiv.querySelector('.remove-add-item-btn');
            if (itemsToAddContainer.children.length > 1 && removeBtn) {
                removeBtn.style.display = 'block';
            } else if (removeBtn) {
                removeBtn.style.display = 'none';
            }

            document.querySelectorAll('.item-internal-value').forEach(input => {
                input.removeEventListener('input', updateSaleValue);
                input.addEventListener('input', updateSaleValue);
            });
        }
    };

    const updateSaleValue = (e) => {
        const internalValueInput = e.target;
        const saleValueInput = internalValueInput.closest('.item-to-add, tr').querySelector('.item-sale-value, .edit-sale-value');
        const val = parseFloat(internalValueInput.value);
        if (!isNaN(val) && val >= 0) {
            saleValueInput.value = (val * PERCENTUAL_VENDA_PADRAO).toFixed(2);
        } else {
            saleValueInput.value = '';
        }
    };
    
    // --- Funções de Comunicação com o Backend (Fetch API) ---

    // Funções de CRUD para Itens
    const sendAddItem = async (items) => {
        const formData = new FormData();
        const itemsToSave = [];

        items.forEach((item, index) => {
            itemsToSave.push({
                nome: item.name,
                quantidade: item.quantity,
                valor_interno: item.internalValue,
                valor_venda: item.saleValue,
                imagem_original_nome: item.image ? item.image.name : null
            });
            if (item.image) {
                formData.append('imagens_item', item.image);
            }
        });
        formData.append('items', JSON.stringify(itemsToSave));

        try {
            const response = await fetch('/itens/adicionar', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao adicionar itens: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao adicionar itens:', error);
            alert('Erro de comunicação com o servidor ao adicionar itens.');
        }
    };

    // sendUpdateItem agora é mais focado em upload/remoção individual da imagem
    const sendUpdateItem = async (id, updatedFields, imageFile = null, removeImage = false) => {
        const formData = new FormData();
        
        // Sempre envia os campos de texto atuais do item para evitar que sejam zerados no backend
        // `updatedFields` pode vir do botão "Salvar Imagem" ou "Remover Imagem"
        formData.append('nome', updatedFields.name);
        formData.append('quantidade', updatedFields.quantity);
        formData.append('valor_interno', updatedFields.internalValue);
        formData.append('valor_venda', updatedFields.saleValue);
        
        if (imageFile) { // Se uma nova imagem foi selecionada para upload
            formData.append('imagem_item', imageFile);
            formData.append('imagem_atual_mantida', 'true'); // Sinaliza que estamos enviando uma imagem
        } else if (removeImage) { // Se o pedido é para remover a imagem (vindo do botão "Remover IMG")
            formData.append('imagem_atual_mantida', 'false'); // Sinaliza para o backend remover
            formData.append('imagem_existente', updatedFields.existingImageName || ''); // Envia o nome da imagem antiga para o backend remover o arquivo físico
        } else { // Caso não haja mudança na imagem (nem nova, nem remoção), mas a função foi chamada
            formData.append('imagem_atual_mantida', 'true'); // Sinaliza para o backend manter a imagem existente
            formData.append('imagem_existente', updatedFields.existingImageName || '');
        }

        try {
            const response = await fetch(`/itens/atualizar/${id}`, {
                method: 'PUT',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao atualizar item: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao atualizar item:', error);
            alert('Erro de comunicação com o servidor ao atualizar item.');
        }
    };

    const sendRemoveImage = async (id) => {
        const confirmed = confirm('Tem certeza que deseja remover APENAS a imagem deste item?');
        if (!confirmed) return;

        try {
            const row = document.querySelector(`tr[data-item-id="${id}"]`);
            // Coleta os valores atuais dos campos de texto da linha para enviar junto
            const name = row.querySelector('.edit-name').value;
            const quantity = parseInt(row.querySelector('.edit-quantity').value);
            const internalValue = parseFloat(row.querySelector('.edit-internal-value').value);
            const saleValue = parseFloat(row.querySelector('.edit-sale-value').value);
            const existingImageName = row.querySelector('.existing-image-name') ? row.querySelector('.existing-image-name').value : null;

            await sendUpdateItem(id, {
                name: name,
                quantity: quantity,
                internalValue: internalValue,
                saleValue: saleValue,
                existingImageName: existingImageName
            }, null, true); // imageFile = null, removeImage = true

        } catch (error) {
            console.error('Erro de rede ao remover imagem:', error);
            alert('Erro de comunicação com o servidor ao remover imagem.');
        }
    };

    const sendDeleteItem = async (id) => {
        try {
            const response = await fetch(`/itens/excluir/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao excluir item: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao excluir item:', error);
            alert('Erro de comunicação com o servidor ao excluir item.');
        }
    };

    // Funções de CRUD para Clientes
    const sendAddClient = async (newClient) => {
        try {
            const response = await fetch('/clientes/adicionar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClient)
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao cadastrar cliente: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao adicionar cliente:', error);
            alert('Erro de comunicação com o servidor ao adicionar cliente.');
        }
    };

    const sendUpdateClient = async (id, updatedFields) => {
        try {
            const response = await fetch(`/clientes/atualizar/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao atualizar cliente: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao atualizar cliente:', error);
            alert('Erro de comunicação com o servidor ao atualizar cliente.');
        }
    };

    const sendDeleteClient = async (id) => {
        try {
            const response = await fetch(`/clientes/excluir/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao excluir cliente: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao excluir cliente:', error);
            alert('Erro de comunicação com o servidor ao excluir cliente.');
        }
    };

    // Funções de CRUD para Vendas
    const sendRegisterSale = async (saleData) => {
        try {
            const response = await fetch('/vendas/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                saleClientSelect.value = 'cliente-sem-cadastro';
                saleClientNameInputAnonymous.value = '';
                saleClientNameInputAnonymous.style.display = 'block';
                saleDiscountInput.value = '0.00';
                paymentMethodSelect.value = '';
                saleItemsContainer.innerHTML = '';
                discountGroup.style.display = 'none';
                paymentMethodGroup.style.display = 'none';
                saleDiscountInput.required = false;
                paymentMethodSelect.required = false;
                calculateSaleValues();
                reloadPage();
            } else {
                alert('Erro ao registrar venda: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao registrar venda:', error);
            alert('Erro de comunicação com o servidor ao registrar venda.');
        }
    };

    const sendDeleteSale = async (id) => {
        const password = prompt('Para excluir esta venda e reverter o estoque, digite a senha de administrador:');
        if (password === null) return;
        if (password !== ADMIN_PASSWORD) {
            alert('Senha incorreta. Não foi possível excluir a venda.');
            return;
        }

        try {
            const response = await fetch(`/vendas/excluir/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao excluir venda: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao excluir venda:', error);
            alert('Erro de comunicação com o servidor ao excluir venda.');
        }
    };

    const sendClearHistory = async () => {
        const password = prompt('Para limpar SOMENTE o histórico de vendas, digite a senha de administrador:');
        if (password === null) return;
        if (password !== ADMIN_PASSWORD) {
            alert('Senha incorreta. O histórico não foi limpo.');
            return;
        }
        if (!confirm('Tem certeza que deseja limpar SOMENTE o histórico de vendas? Esta ação NÃO PODE ser desfeita.')) {
            return;
        }

        try {
            const response = await fetch('/vendas/limpar-historico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                reloadPage();
            } else {
                alert('Erro ao limpar histórico: ' + data.message);
            }
        } catch (error) {
            console.error('Erro de rede ao limpar histórico:', error);
            alert('Erro de comunicação com o servidor ao limpar histórico.');
        }
    };

    const exportToCsv = async () => {
        try {
            const response = await fetch('/vendas/exportar-csv');
            if (!response.ok) {
                const errorText = await response.text();
                alert('Erro ao exportar vendas: ' + errorText);
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'historico_vendas.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Histórico de vendas exportado com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            alert('Erro ao exportar vendas para CSV.');
        }
    };

    // --- FUNÇÕES PARA VISUALIZAÇÃO DE IMAGEM FULLSCREEN ---
    const openFullscreenImage = (src) => {
        const overlay = document.createElement('div');
        overlay.classList.add('image-fullscreen-overlay');

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Imagem em tela cheia';

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('close-btn');
        closeBtn.innerHTML = '<i class="fas fa-times"></i> Fechar';
        closeBtn.onclick = () => overlay.remove();

        const downloadBtn = document.createElement('a');
        downloadBtn.classList.add('download-btn');
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Baixar Imagem';
        downloadBtn.href = src;
        downloadBtn.download = src.split('/').pop();
        downloadBtn.target = '_blank';

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        overlay.appendChild(downloadBtn);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    };


    // --- BINDING DE EVENT LISTENERS ---
    const bindEventListeners = () => {
        // Cadastro de Itens
        addAnotherItemBtn.onclick = () => {
            const newItemDiv = document.createElement('div');
            newItemDiv.classList.add('item-to-add');
            newItemDiv.dataset.index = itemsToAddContainer.children.length;
            newItemDiv.innerHTML = `
                <input type="text" placeholder="Nome do Item" class="item-name" required>
                <input type="number" placeholder="Qtd" class="item-quantity" min="1" required>
                <input type="number" placeholder="Valor Interno (R$)" class="item-internal-value" step="0.01" min="0.01" required>
                <input type="number" placeholder="Valor de Venda (R$)" class="item-sale-value" step="0.01" min="0.01" required>
                <input type="file" class="item-image" name="imagens_item" accept="image/*">
                <button type="button" class="remove-add-item-btn"><i class="fas fa-times"></i></button>
            `;
            itemsToAddContainer.appendChild(newItemDiv);
            const internalValueInput = newItemDiv.querySelector('.item-internal-value');
            internalValueInput.addEventListener('input', updateSaleValue);
            handleInitialAddItemInput();
        };

        itemsToAddContainer.onchange = (e) => {
            if (e.target.classList.contains('item-internal-value')) {
                updateSaleValue(e);
            }
        };

        itemsToAddContainer.onclick = (e) => {
            if (e.target.classList.contains('remove-add-item-btn') || e.target.closest('.remove-add-item-btn')) {
                const itemToRemove = e.target.closest('.item-to-add');
                if (itemsToAddContainer.children.length > 1) {
                    itemToRemove.remove();
                } else {
                    alert('Você não pode remover o último item do formulário de cadastro. Limpe os campos ou adicione um novo.');
                }
                handleInitialAddItemInput();
            }
        };

        addItemForm.onsubmit = async (e) => {
            e.preventDefault();
            const itemDivs = itemsToAddContainer.querySelectorAll('.item-to-add');
            const itemsToSave = Array.from(itemDivs).map(div => {
                const name = div.querySelector('.item-name').value.trim();
                const quantity = parseInt(div.querySelector('.item-quantity').value);
                const internalValue = parseFloat(div.querySelector('.item-internal-value').value);
                const saleValue = parseFloat(div.querySelector('.item-sale-value').value);
                const imageFile = div.querySelector('.item-image').files[0];

                if (!name || isNaN(quantity) || quantity <= 0 || isNaN(internalValue) || internalValue <= 0 || isNaN(saleValue) || saleValue <= 0) {
                    alert('Por favor, preencha todos os campos do item corretamente (quantidade e valores devem ser maiores que zero).');
                    return null;
                }
                return { name, quantity, internalValue, saleValue, image: imageFile };
            }).filter(Boolean);

            if (itemsToSave.length === 0) {
                alert('Nenhum item válido para salvar.');
                return;
            }

            await sendAddItem(itemsToSave);
            itemsToAddContainer.innerHTML = `
                <div class="item-to-add" data-index="0">
                    <input type="text" placeholder="Nome do Item" class="item-name" required>
                    <input type="number" placeholder="Qtd" class="item-quantity" min="1" required>
                    <input type="number" placeholder="Valor Interno (R$)" class="item-internal-value" step="0.01" min="0.01" required>
                    <input type="number" placeholder="Valor de Venda (R$)" class="item-sale-value" step="0.01" min="0.01" required>
                    <input type="file" class="item-image" name="imagens_item" accept="image/*">
                    <button type="button" class="remove-add-item-btn" style="display: none;"><i class="fas fa-times"></i></button>
                </div>`;
            handleInitialAddItemInput();
        };

        // Event listener para o botão "Salvar Todas as Alterações dos Itens"
        saveAllItemsBtn.onclick = async () => {
            const rows = itemsTableBody.querySelectorAll('tr[data-item-id]');
            const itemsToUpdate = [];

            for (const row of rows) {
                const id = row.dataset.itemId;
                const name = row.querySelector('.edit-name').value.trim();
                const quantity = parseInt(row.querySelector('.edit-quantity').value);
                const internalValue = parseFloat(row.querySelector('.edit-internal-value').value);
                const saleValue = parseFloat(row.querySelector('.edit-sale-value').value);
                
                if (!name || isNaN(quantity) || quantity < 0 || isNaN(internalValue) || internalValue < 0 || isNaN(saleValue) || saleValue < 0) {
                     alert(`Erro de validação em um dos itens: Nome: "${name}", Qtd: ${quantity}, V.Interno: ${internalValue}, V.Venda: ${saleValue}. Por favor, corrija antes de salvar todas as alterações.`);
                     return;
                }
                
                itemsToUpdate.push({ id: parseInt(id), nome: name, quantidade: quantity, valor_interno: internalValue, valor_venda: saleValue });
            }

            if (itemsToUpdate.length === 0) {
                alert('Nenhum item com alterações para salvar.');
                return;
            }

            try {
                const response = await fetch('/itens/atualizar-multiplos', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: itemsToUpdate })
                });
                const data = await response.json();
                if (data.success) {
                    alert(data.message);
                    reloadPage();
                } else {
                    alert('Erro ao salvar alterações: ' + data.message);
                }
            } catch (error) {
                console.error('Erro de rede ao salvar múltiplos itens:', error);
                alert('Erro de comunicação com o servidor ao salvar todas as alterações.');
            }
        };


        itemsTableBody.onclick = async (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const id = row.dataset.itemId;

            if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
                if (confirm('Tem certeza que deseja excluir este item? Esta ação é irreversível e removerá o item de vendas passadas.')) {
                    await sendDeleteItem(id);
                }
            } else if (e.target.classList.contains('remove-image-btn') || e.target.closest('.remove-image-btn')) {
                await sendRemoveImage(id);
            } else if (e.target.classList.contains('item-thumbnail')) {
                const imgSrc = e.target.dataset.originalSrc;
                openFullscreenImage(imgSrc);
            } else if (e.target.classList.contains('update-image-btn') || e.target.closest('.update-image-btn')) {
                const imageInput = row.querySelector('.edit-image');
                const imageFile = imageInput ? imageInput.files[0] : null;
                const existingImageName = row.querySelector('.existing-image-name') ? row.querySelector('.existing-image-name').value : null;

                if (!imageFile) {
                    alert('Nenhuma nova imagem selecionada para salvar.');
                    return;
                }
                
                // Coleta os valores atuais dos campos de texto da linha para enviar junto
                const name = row.querySelector('.edit-name').value;
                const quantity = parseInt(row.querySelector('.edit-quantity').value);
                const internalValue = parseFloat(row.querySelector('.edit-internal-value').value);
                const saleValue = parseFloat(row.querySelector('.edit-sale-value').value);

                await sendUpdateItem(id, {
                    name: name,
                    quantity: quantity,
                    internalValue: internalValue,
                    saleValue: saleValue,
                    existingImageName: existingImageName // Passa o nome da imagem existente para o backend
                }, imageFile, false); // Nova imagem, não é para remover
            }
        };

        itemsTableBody.onchange = (e) => {
            if (e.target.classList.contains('edit-internal-value')) {
                updateSaleValue(e);
            }
        };

        // Cadastro de Clientes
        addClientForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = clientRegisterNameInput.value.trim();
            const phone = clientRegisterPhoneInput.value.trim();
            const address = clientRegisterAddressInput.value.trim();

            if (!name) {
                alert('O nome do cliente é obrigatório.');
                return;
            }

            await sendAddClient({ name, phone, address });
            clientRegisterNameInput.value = '';
            clientRegisterPhoneInput.value = '';
            clientRegisterAddressInput.value = '';
        };

        clientsTableBody.onclick = async (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const id = row.dataset.clientId;

            if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
                if (confirm('Tem certeza que deseja excluir este cliente? Vendas associadas a este cliente não serão removidas.')) {
                    await sendDeleteClient(id);
                }
            } else if (e.target.classList.contains('update-client-btn') || e.target.closest('.update-client-btn')) {
                const name = row.querySelector('.edit-client-name').value.trim();
                const phone = row.querySelector('.edit-client-phone').value.trim();
                const address = row.querySelector('.edit-client-address').value.trim();

                if (!name) {
                    alert('O nome do cliente não pode ser vazio.');
                    reloadPage();
                    return;
                }
                await sendUpdateClient(id, { name, phone, address });
            }
        };


        // Nova Venda
        addItemToSaleBtn.onclick = () => {
            if (availableItems.length === 0 || availableItems.every(item => item.quantidade <= 0)) {
                alert('Não há itens disponíveis no estoque para adicionar a uma venda. Cadastre e/ou reponha o estoque.');
                return;
            }
            createSaleItemRow();
        };

        saleItemsContainer.onchange = (e) => {
            if (e.target.classList.contains('sale-item-select')) {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const quantityInput = e.target.closest('.sale-item').querySelector('.sale-item-quantity');
                
                if (selectedOption.value) {
                    quantityInput.max = selectedOption.dataset.availableQuantity;
                    quantityInput.value = 1;
                } else {
                    quantityInput.value = '';
                    quantityInput.removeAttribute('max');
                }
            }
            calculateSaleValues();
        };

        saleItemsContainer.oninput = (e) => {
            if (e.target.classList.contains('sale-item-quantity')) {
                const quantityInput = e.target;
                const selectedItemSelect = e.target.closest('.sale-item').querySelector('.sale-item-select');
                const selectedOption = selectedItemSelect.options[selectedItemSelect.selectedIndex];
                const availableQuantity = parseInt(selectedOption.dataset.availableQuantity);
                const requestedQuantity = parseInt(quantityInput.value);

                if (requestedQuantity > availableQuantity) {
                    alert(`Quantidade solicitada (${requestedQuantity}) excede o estoque disponível (${availableQuantity}) para este item.`);
                    quantityInput.value = availableQuantity;
                } else if (requestedQuantity < 1 && quantityInput.value !== '') {
                    quantityInput.value = 1;
                }
            }
            calculateSaleValues();
        };

        saleItemsContainer.onclick = (e) => {
            if (e.target.classList.contains('remove-sale-item-btn') || e.target.closest('.remove-sale-item-btn')) {
                e.target.closest('.sale-item').remove();
                if (saleItemsContainer.children.length === 0) {
                    discountGroup.style.display = 'none';
                    paymentMethodGroup.style.display = 'none';
                    saleDiscountInput.required = false;
                    paymentMethodSelect.required = false;
                    saleDiscountInput.value = '0.00';
                    paymentMethodSelect.value = '';
                }
                calculateSaleValues();
            }
        };

        saleDiscountInput.oninput = calculateSaleValues;

        saleClientSelect.onchange = () => {
            if (saleClientSelect.value === 'cliente-sem-cadastro') {
                clientAnonymousNameContainer.style.display = 'block';
                saleClientNameInputAnonymous.value = '';
            } else {
                clientAnonymousNameContainer.style.display = 'none';
                saleClientNameInputAnonymous.value = '';
            }
        };

        newSaleForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const selectedClientId = saleClientSelect.value;
            let clientName = 'Cliente Sem Cadastro';
            let clientId = null;

            if (selectedClientId === 'cliente-sem-cadastro') {
                clientName = saleClientNameInputAnonymous.value.trim() || 'Cliente Sem Cadastro';
            } else {
                clientId = selectedClientId;
            }

            const discount = parseFloat(saleDiscountInput.value) || 0;
            const paymentMethod = paymentMethodSelect.value;

            const saleItemDivs = saleItemsContainer.querySelectorAll('.sale-item');
            if (saleItemDivs.length === 0) {
                alert('Adicione pelo menos um item à venda.');
                return;
            }

            if (!paymentMethod) {
                alert('Por favor, selecione o método de pagamento.');
                return;
            }

            const itemsForSale = Array.from(saleItemDivs).map(div => {
                const select = div.querySelector('.sale-item-select');
                const quantitySold = parseInt(div.querySelector('.sale-item-quantity').value);
                
                const selectedItemOption = select.options[select.selectedIndex];
                if (!selectedItemOption || !selectedItemOption.value) return null;

                const itemId = selectedItemOption.value;
                const selectedItem = availableItems.find(item => item.id == itemId); 

                if (!selectedItem || isNaN(quantitySold) || quantitySold <= 0) {
                    return null;
                }
                
                return {
                    id: selectedItem.id,
                    nome: selectedItem.nome,
                    quantidade: quantitySold,
                    valor_unitario: selectedItem.valor_venda,
                    valor_interno_unitario: selectedItem.valor_interno
                };
            }).filter(Boolean);

            if (itemsForSale.length === 0 || itemsForSale.length !== saleItemDivs.length) {
                alert('Por favor, verifique os itens da venda. Certifique-se de que todos os itens estão selecionados e as quantidades são válidas.');
                return;
            }

            const { totalPieces, totalValue, totalInternalCost } = calculateSaleValues();

            if ((parseFloat(totalValueBeforeDiscountSpan.textContent) - discount) < totalInternalCost) {
                const maxDiscountAllowed = parseFloat(totalValueBeforeDiscountSpan.textContent) - totalInternalCost;
                alert(`O desconto excede o limite! Desconto máximo permitido: R$ ${maxDiscountAllowed.toFixed(2)}. Ajuste o desconto.`);
                saleDiscountInput.value = maxDiscountAllowed.toFixed(2);
                calculateSaleValues();
                return;
            }

            const saleData = {
                cliente_id: clientId,
                cliente_nome_anonimo: clientName,
                items: itemsForSale,
                desconto: discount,
                metodo_pagamento: paymentMethod,
                total_pecas: totalPieces,
                valor_total: totalValue,
                custo_interno_total: totalInternalCost
            };

            await sendRegisterSale(saleData);
        };

        // Histórico e Resumo Financeiro
        exportSalesBtn.onclick = exportToCsv;

        clearHistoryBtn.onclick = sendClearHistory;

        salesHistoryContainer.onclick = async (e) => {
            if (e.target.classList.contains('delete-sale-btn') || e.target.closest('.delete-sale-btn')) {
                const saleId = e.target.closest('.delete-sale-btn').dataset.saleId;
                await sendDeleteSale(saleId);
            }
        };

        document.querySelectorAll('.toggle-section-btn').forEach(button => {
            button.onclick = () => {
                const targetId = button.dataset.target;
                const targetSection = document.getElementById(targetId);
                const sectionContent = targetSection.querySelector('.section-content');

                if (sectionContent) {
                    sectionContent.classList.toggle('hidden');
                    if (sectionContent.classList.contains('hidden')) {
                        button.innerHTML = '<i class="fas fa-eye"></i> Mostrar';
                    } else {
                        button.innerHTML = '<i class="fas fa-eye-slash"></i> Esconder';
                    }
                }
            };
        });
    };

    // --- CARREGAMENTO INICIAL ---
    const initialLoad = async () => {
        try {
            const itemsResponse = await fetch('/api/itens');
            availableItems = await itemsResponse.json();

            const clientsResponse = await fetch('/api/clientes');
            clients = await clientsResponse.json();

            bindEventListeners();
            handleInitialAddItemInput();

            if (saleClientSelect.value === 'cliente-sem-cadastro') {
                clientAnonymousNameContainer.style.display = 'block';
            } else {
                clientAnonymousNameContainer.style.display = 'none';
            }
            if (saleItemsContainer.children.length === 0) {
                discountGroup.style.display = 'none';
                paymentMethodGroup.style.display = 'none';
                saleDiscountInput.required = false;
                paymentMethodSelect.required = false;
            }
        } catch (error) {
            console.error('Erro no carregamento inicial:', error);
            alert('Erro ao carregar dados iniciais. Tente recarregar a página.');
        }
    };

    initialLoad();
});
