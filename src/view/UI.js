export default class UIManager {
    constructor(game) {
        this.game = game;
        this.displayedMoney = 0;
        this.dialogQueue = [];
        this.currentDialog = null;
        this.screens = {
            start: document.getElementById('start-screen'),
            hud: document.getElementById('hud')
        };
        this.panels = {
            manager: document.getElementById('manager-panel')
        };
        this.dialog = document.getElementById('dialog-box');
    }

    init() {
        // Bind Buttons
        document.getElementById('btn-new-game').addEventListener('click', () => {
            this.showScreen('hud'); // Optimistic update
            this.game.startNewGame();
        });

        document.getElementById('btn-load-game').addEventListener('click', () => {
            this.showLoadSlotSelector();
        });

        document.getElementById('manager-panel-btn').onclick = () => {
            this.togglePanel('manager');
        };

        // Pause Button (New)
        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'btn-pause';
        pauseBtn.className = 'pixel-btn';
        pauseBtn.style.position = 'absolute';
        pauseBtn.style.right = '15px';
        pauseBtn.style.top = '15px';
        pauseBtn.style.zIndex = '1000';
        pauseBtn.textContent = '⏸️';
        pauseBtn.onclick = () => this.game.togglePause();
        document.body.appendChild(pauseBtn);

        document.querySelector('.close-btn').addEventListener('click', () => {
            this.togglePanel('manager');
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateManagerPanel(e.target.dataset.tab);
            });
        });

        // Dialog next button
        document.getElementById('dialog-next').addEventListener('click', () => {
            this.showNextDialog();
        });

        // Status Bar Legend
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            topBar.style.cursor = 'help';
            topBar.addEventListener('mouseenter', () => {
                this.showStatusLegend();
            });
            // Also show on click just in case
            topBar.addEventListener('click', () => {
                this.showStatusLegend();
            });
        }
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.add('hidden'));
        if (this.screens[name]) {
            this.screens[name].classList.remove('hidden');
            this.screens[name].classList.add('active');
        }
    }

    togglePanel(name) {
        const panel = this.panels[name];
        if (panel) {
            const isOpening = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');

            if (name === 'manager') {
                const btn = document.getElementById('manager-panel-btn');
                if (isOpening) {
                    // Opening panel
                    this.game.isPaused = true;
                    btn.textContent = '保存';
                    btn.onclick = () => this.showSaveSlotSelector();
                    this.updateManagerPanel('inventory'); // Default tab
                } else {
                    // Closing panel
                    this.game.isPaused = false;
                    btn.textContent = '店铺管理';
                    btn.onclick = () => this.togglePanel('manager');
                }
            }
        }
    }

    togglePauseMenu(show) {
        let menu = document.getElementById('pause-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'pause-menu';
            menu.className = 'screen';
            menu.style.backgroundColor = 'rgba(0,0,0,0.5)';
            menu.style.zIndex = '2000';
            menu.style.display = 'flex';
            menu.style.justifyContent = 'center';
            menu.style.alignItems = 'center';
            menu.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="margin-top: 0; color: #333; margin-bottom: 20px;">游戏暂停</h2>
                    <button class="pixel-btn" style="width: 100%; margin-bottom: 15px; padding: 12px;" onclick="window.game.togglePause()">继续游戏</button>
                    <button class="pixel-btn" style="width: 100%; padding: 12px; background-color: #ef5350;" onclick="window.location.reload()">回到主菜单</button>
                </div>
            `;
            document.body.appendChild(menu);
        }

        if (show) {
            menu.classList.remove('hidden');
            menu.classList.add('active');
        } else {
            menu.classList.add('hidden');
            menu.classList.remove('active');
        }
    }

    updateManagerPanel(tab) {
        const content = document.querySelector('.panel-content');
        content.innerHTML = `<p>Loading ${tab}...</p>`;

        if (tab === 'inventory') {
            this.renderInventory(content);
        } else if (tab === 'employee') {
            this.renderEmployee(content);
        } else if (tab === 'shop') {
            this.renderShop(content);
        } else if (tab === 'system') {
            this.renderSystem(content);
        } else {
            content.innerHTML = `<p>${tab} 功能暂未开放</p>`;
        }
    }

    renderInventory(container) {
        const inventory = this.game.state.shop.inventory;
        if (!inventory || !inventory.items || inventory.items.length === 0) {
            container.innerHTML = '<p>库存为空</p>';
            return;
        }

        let html = '<div class="inventory-list">';
        inventory.items.forEach(item => {
            html += `
                <div class="inv-item" style="border: 1px solid #777; padding: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight:bold;">${item.name}</div>
                        <div style="font-size: 12px;">库存: ${item.quantity} | 成本: ${item.cost} | 售价: ${item.price}</div>
                    </div>
                    <div>
                        <button class="pixel-btn small" onclick="window.game.ui.handleRestock('${item.id}')">补货</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    handleRestock(itemId) {
        const item = this.game.state.shop.inventory.items.find(i => i.id === itemId);
        if (item) {
            const cost = item.cost * 5; // Restock 5
            if (this.game.state.shop.money >= cost) {
                this.game.state.shop.money -= cost;

                // Add to pending orders
                this.game.state.shop.pendingOrders.push({ itemId: itemId, quantity: 5 });

                this.updateManagerPanel('inventory');
                this.updateHUD(this.game.state);
                this.showDialog(`已下单 ${item.name} x5，花费 ${cost} 金币 (明日送达)`);
            } else {
                this.showDialog("资金不足！");
            }
        }
    }

    renderEmployee(container) {
        const emp = this.game.state.employees[0];
        if (!emp) return;

        container.innerHTML = `
            <div class="emp-details">
                <h3>${emp.name} (Lv.${emp.level})</h3>
                <p>岗位: ${emp.role}</p>
                <p>经验: ${emp.xp}/${emp.xpToNextLevel}</p>
                <p>效率: ${emp.efficiency}%</p>
                <p>亲和力: ${emp.charisma}%</p>
                <p>疲劳: ${Math.floor(emp.fatigue)}/20</p>
                <hr>
                <div style="margin-bottom: 10px;">
                    <label>当前任务优先级:</label>
                    <select id="emp-task-select" onchange="window.game.ui.handleTaskChange(this.value)">
                        <option value="balanced" ${emp.taskPriority === 'balanced' ? 'selected' : ''}>均衡工作</option>
                        <option value="guide" ${emp.taskPriority === 'guide' ? 'selected' : ''}>优先导购</option>
                        <option value="cashier" ${emp.taskPriority === 'cashier' ? 'selected' : ''}>优先收银</option>
                    </select>
                </div>

            </div>
        `;
    }

    renderShop(container) {
        const shop = this.game.state.shop;
        container.innerHTML = `
            <div class="shop-details">
                <h3>店铺信息</h3>
                <p>明日天气预报: ${this.getWeatherEmoji(this.game.state.forecast)}</p>
                <hr>
                <p>等级: ${shop.level}</p>
                <p>声望: ${shop.reputation}</p>
                <p>客流: ${shop.traffic}</p>
                <hr>
                <h4>升级店铺</h4>
                <p>下一级费用: ${shop.upgradeCost}</p>
                <button class="pixel-btn" onclick="window.game.ui.handleUpgrade()">升级店铺</button>
                <hr>
                <h4>装修</h4>
                <button class="pixel-btn" onclick="window.game.state.toggleEditMode(); window.game.ui.togglePanel('manager')">进入装修模式</button>
            </div>
        `;
    }

    handleUpgrade() {
        const shop = this.game.state.shop;
        if (shop.upgrade()) {
            this.updateManagerPanel('shop');
            this.updateHUD(this.game.state);
            this.showDialog(`店铺升级成功！当前等级: ${shop.level}`);
        } else {
            this.showDialog(`资金不足！需要 ${shop.upgradeCost} 金币`);
        }
    }

    handleTaskChange(val) {
        const emp = this.game.state.employees[0];
        emp.taskPriority = val;
        this.showDialog(`小衣的工作重心调整为：${val === 'balanced' ? '均衡' : val === 'guide' ? '导购' : '收银'}`);
    }



    showDialog(text) {
        // Add to queue
        if (Array.isArray(text)) {
            this.dialogQueue.push(...text);
        } else {
            this.dialogQueue.push(text);
        }

        // Start showing if not already showing
        if (!this.currentDialog) {
            this.showNextDialog();
        }
    }

    showNextDialog() {
        // Clear existing timeout
        if (this.dialogTimeout) {
            clearTimeout(this.dialogTimeout);
            this.dialogTimeout = null;
        }

        // Clear failsafe timeout
        if (this.dialogFailsafe) {
            clearTimeout(this.dialogFailsafe);
            this.dialogFailsafe = null;
        }

        if (this.dialogQueue.length === 0) {
            if (this.dialog) {
                this.dialog.classList.add('hidden');
                // Remove onclick handler when hiding
                this.dialog.onclick = null;
            }
            this.currentDialog = null;
            return;
        }

        this.currentDialog = this.dialogQueue.shift();

        if (this.dialog) {
            this.dialog.classList.remove('hidden');
            const textEl = document.getElementById('dialog-text');
            if (textEl) textEl.textContent = this.currentDialog;

            // Remove old handler first to prevent stacking
            this.dialog.onclick = null;

            // Add click listener to dismiss immediately
            this.dialog.onclick = (e) => {
                e.stopPropagation();
                this.showNextDialog();
            };

            // Ensure dialog is clickable
            this.dialog.style.pointerEvents = 'auto';
            this.dialog.style.cursor = 'pointer';
        }

        // Auto dismiss after 3 seconds
        this.dialogTimeout = setTimeout(() => {
            this.showNextDialog();
        }, 3000);

        // Failsafe: Force dismiss after 5 seconds no matter what
        this.dialogFailsafe = setTimeout(() => {
            console.warn('Dialog failsafe triggered - forcing dismiss');
            if (this.dialog && !this.dialog.classList.contains('hidden')) {
                this.dialogQueue = []; // Clear queue to prevent infinite loop
                this.showNextDialog();
            }
        }, 5000);
    }

    updateHUD(state) {
        // Number Rolling
        const diff = state.shop.money - this.displayedMoney;
        if (Math.abs(diff) > 0) {
            this.displayedMoney += Math.ceil(diff * 0.1); // Ease in
        }
        document.getElementById('money-display').textContent = this.displayedMoney;

        document.getElementById('traffic-display').textContent = state.shop.traffic;

        const seasonMap = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
        document.getElementById('season-display').textContent = seasonMap[state.season] + ` Day ${state.day}`;

        // Format time
        const hours = Math.floor(state.time / 60);
        const mins = Math.floor(state.time % 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        document.getElementById('time-display').innerHTML = `<span style="color:#FFD700">⏰</span> ${timeStr}`;

        // Update other stats with icons
        document.getElementById('money-display').innerHTML = `<span style="color:#FFD700">💰</span> ${this.displayedMoney}`;

        // Fix: Use dailyStats.visitors for real-time visitor count
        document.getElementById('traffic-display').innerHTML = `<span style="color:#42A5F5">👥</span> ${state.dailyStats.visitors}`;

        // New Stats
        document.getElementById('sales-display').innerHTML = `<span style="color:#66BB6A">🛒</span> ${state.dailyStats.sales}`;
        document.getElementById('revenue-display').innerHTML = `<span style="color:#FFA726">📈</span> ${state.dailyStats.revenue}`;

        // Update Employee Status Window - REMOVED AUTO SHOW
        // const selectedEmp = this.game.selectedEntity;
        // const statusWindow = document.getElementById('employee-status');
        // if (selectedEmp && selectedEmp.constructor.name === 'Employee') { ... }
    }

    showDailySummary(stats, forecast) {
        const weatherMap = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️' };
        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.9)';
        div.style.zIndex = '100';
        div.innerHTML = `
            <div style="text-align: center; color: white; padding: 20px;">
                <h2>今日营业总结</h2>
                <p>客流: ${stats.visitors}</p>
                <p>成交: ${stats.sales}</p>
                <p>营收: ${stats.revenue}</p>
                <hr style="margin: 20px 0; border-color: #666;">
                <h3>📅 明日天气预报</h3>
                <p style="font-size: 32px;">${weatherMap[forecast]}</p>
                <p style="font-size: 14px; color: #aaa;">晚间时段可继续补货和上架操作</p>
                <br>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">关闭</button>
            </div>
        `;
        document.body.appendChild(div);
    }

    showEditorToolbar() {
        // Hide other UI
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('manager-panel-btn').classList.add('hidden');
        const pauseBtn = document.getElementById('btn-pause');
        if (pauseBtn) pauseBtn.style.display = 'none';

        // Cleanup any existing toolbars to prevent duplicates
        const existingToolbars = document.querySelectorAll('#editor-toolbar');
        existingToolbars.forEach(el => el.remove());

        const toolbar = document.createElement('div');
        toolbar.id = 'editor-toolbar';
        toolbar.style.position = 'absolute';
        toolbar.style.bottom = '20px';
        toolbar.style.left = '50%';
        toolbar.style.transform = 'translateX(-50%)';
        toolbar.style.background = 'rgba(255, 255, 255, 0.9)';
        toolbar.style.padding = '10px';
        toolbar.style.borderRadius = '12px';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        toolbar.innerHTML = `
            <button class="pixel-btn small" onclick="window.game.state.toggleEditMode()">退出装修</button>
            <div style="width: 1px; background: #ccc;"></div>
            <button class="pixel-btn small" onclick="window.game.ui.showFurnitureShop()">➕ 添加家具</button>
            <button class="pixel-btn small" style="background: #EF5350;" onclick="window.game.state.removeFurniture()">🗑️ 删除</button>
        `;
        document.body.appendChild(toolbar);
    }

    hideEditorToolbar() {
        const toolbars = document.querySelectorAll('#editor-toolbar');
        toolbars.forEach(el => el.remove());

        // Show other UI
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('manager-panel-btn').classList.remove('hidden');
        const pauseBtn = document.getElementById('btn-pause');
        if (pauseBtn) pauseBtn.style.display = 'block';
    }

    hideAllPanels() {
        const ids = ['furniture-panel', 'customer-panel'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        this.hideCustomerPanel();
        this.hideEmployeeAttributePanel();
    }

    showEmployeeAttributePanel(emp) {
        let panel = document.getElementById('employee-attribute-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'employee-attribute-panel';
            panel.className = 'panel';
            panel.style.position = 'absolute';
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
            panel.style.width = '300px';
            panel.style.backgroundColor = '#FFF8E1';
            panel.style.border = '4px solid #FFCCBC';
            panel.style.borderRadius = '10px';
            panel.style.padding = '15px';
            panel.style.zIndex = '1000';
            panel.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'X';
            closeBtn.className = 'pixel-btn small';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '5px';
            closeBtn.style.right = '5px';
            closeBtn.onclick = () => this.hideEmployeeAttributePanel();
            panel.appendChild(closeBtn);

            this.empPanelContent = document.createElement('div');
            panel.appendChild(this.empPanelContent);
            document.body.appendChild(panel);
        }

        panel.style.display = 'block';

        this.empPanelContent.innerHTML = `
            <h3 style="text-align:center; color:#5D4037; margin-top:0;">${emp.name} (Lv.${emp.level})</h3>
            <div style="text-align:center; margin-bottom:10px;">
                <div style="font-size: 24px;">👷‍♀️</div>
            </div>
            <p><strong>岗位:</strong> ${emp.role}</p>
            <p><strong>经验:</strong> ${emp.xp}/${emp.xpToNextLevel}</p>
            <p><strong>效率:</strong> ${Math.floor(emp.efficiency)}%</p>
            <p><strong>亲和力:</strong> ${emp.charisma}%</p>
            <p><strong>疲劳:</strong> ${Math.floor(emp.fatigue)}/20</p>
            <hr>
            <div style="margin-bottom: 10px;">
                <label>当前任务优先级:</label>
                <select id="emp-task-select-modal" onchange="window.game.ui.handleTaskChange(this.value)">
                    <option value="balanced" ${emp.taskPriority === 'balanced' ? 'selected' : ''}>均衡工作</option>
                    <option value="guide" ${emp.taskPriority === 'guide' ? 'selected' : ''}>优先导购</option>
                    <option value="cashier" ${emp.taskPriority === 'cashier' ? 'selected' : ''}>优先收银</option>
                </select>
            </div>
        `;
    }

    hideEmployeeAttributePanel() {
        const panel = document.getElementById('employee-attribute-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    showFurniturePanel(furniture) {
        this.hideAllPanels();
        const panel = document.getElementById('furniture-panel');
        if (!panel) {
            console.error('Furniture panel not found in HTML');
            return;
        }

        this.renderFurniturePanel(furniture);
        panel.classList.remove('hidden');
    }

    renderFurniturePanel(furniture) {
        const content = document.getElementById('furniture-panel-content');
        if (!content) return;

        const item = furniture.itemType ?
            this.game.state.shop.inventory.items.find(i => i.id === furniture.itemType) :
            null;

        let title = '家具';
        let details = '';

        if (furniture.type === 'rack') {
            title = '衣架';
            details = `<p>容量: ${furniture.currentStock || 0} / ${furniture.capacity || 10}</p>`;
        } else if (furniture.type === 'shelf') {
            title = '货架';
            details = `<p>容量: ${furniture.currentStock || 0} / ${furniture.capacity || 15}</p>`;
        } else if (furniture.type === 'counter') {
            title = '收银台';
            details = `<p>等级: 1</p><p>收银效率: +10%</p>`;
        } else if (furniture.type === 'fitting_room') {
            title = '试衣间';
            const occupied = this.game.state.customers.some(c => c.state === 'FITTING' && c.targetFurniture === furniture);
            details = `<p>状态: ${occupied ? '<span style="color:red">使用中</span>' : '<span style="color:green">空闲</span>'}</p>`;
        } else if (furniture.type === 'break_room') {
            title = '休息室';
            const occupants = this.game.state.employees.filter(e => e.state === 'RESTING').length;
            details = `<p>当前人数: ${occupants}</p><p>恢复速度: 5/s</p>`;
        }

        // Update Header Title
        const headerTitle = document.getElementById('furniture-panel-title');
        if (headerTitle) headerTitle.textContent = title;

        let html = `
            <div class="furniture-info">
                <h3>${title}</h3>
                <p>位置: (${furniture.x}, ${furniture.y})</p>
                ${details}
            </div>
            <hr>
        `;

        // Add close button
        html += `
            <button class="pixel-btn small" style="position:absolute; top:5px; right:5px;" onclick="window.game.ui.hideAllPanels()">X</button>
        `;

        // Only show inventory options for racks and shelves
        if (furniture.type === 'rack' || furniture.type === 'shelf') {
            if (item) {
                html += `
                    <div class="current-item">
                        <h4>当前商品</h4>
                        <p><strong>${item.name}</strong></p>
                        <p>货架库存: ${furniture.currentStock || 0}</p>
                        <p>仓库库存: ${item.quantity}</p>
                        <p>成本: ${item.cost} | 售价: ${item.price}</p>
                        <button class="pixel-btn small" onclick="window.game.ui.manualRestock('${furniture.type}', ${furniture.x}, ${furniture.y})">
                            手动补货
                        </button>
                    </div>
                    <hr>
                `;
            }

            html += `
                <div class="item-selection">
                    <button class="pixel-btn" style="width:100%" onclick="window.game.ui.showItemSelector('${furniture.type}', ${furniture.x}, ${furniture.y})">
                        更换展示商品
                    </button>
                </div>
            `;
        }

        content.innerHTML = html;
    }

    showCustomerPanel(customer) {
        let panel = document.getElementById('customer-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'customer-panel';
            panel.className = 'ui-panel';
            panel.style.position = 'absolute';
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
            panel.style.width = '280px';
            panel.style.backgroundColor = '#FFF8E1';
            panel.style.border = '4px solid #FFCCBC';
            panel.style.borderRadius = '10px';
            panel.style.padding = '15px';
            panel.style.zIndex = '1000';
            panel.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'X';
            closeBtn.className = 'pixel-btn small';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '5px';
            closeBtn.style.right = '5px';
            closeBtn.onclick = () => this.hideCustomerPanel();
            panel.appendChild(closeBtn);

            this.customerPanelContent = document.createElement('div');
            panel.appendChild(this.customerPanelContent);
            document.body.appendChild(panel);
        }

        panel.style.display = 'block';

        // Render hearts
        const hearts = Math.floor(customer.affection / 20); // 0-100 -> 0-5
        let heartStr = '';
        for (let i = 0; i < 5; i++) {
            heartStr += i < hearts ? '❤️' : '🤍';
        }

        this.customerPanelContent.innerHTML = `
            <h3 style="text-align:center; color:#5D4037; margin-top:0;">顾客详情</h3>
            <div style="text-align:center; margin-bottom:10px;">
                <div style="font-size: 24px;">👤</div>
            </div>
            <p><strong>身份:</strong> ${customer.identity}</p>
            <p><strong>现金:</strong> ${customer.cash} G</p>
            <p><strong>好感度:</strong> ${heartStr}</p>
            <p><strong>状态:</strong> ${this.getCustomerStateText(customer.state)}</p>
        `;
    }

    hideCustomerPanel() {
        const panel = document.getElementById('customer-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    getCustomerStateText(state) {
        const map = {
            'ENTERING': '进店中',
            'BROWSING': '挑选商品',
            'FITTING': '试穿中',
            'DECIDING': '犹豫中',
            'QUEUEING': '排队结账',
            'LEAVING': '离开中'
        };
        return map[state] || state;
    }

    showItemSelector(type, x, y) {
        const allItems = this.game.state.shop.inventory.items;
        let filteredItems = [];
        let title = '选择商品';

        if (type === 'rack') {
            // Rack: Tops, Bottoms (Clothing)
            filteredItems = allItems.filter(i => i.type === 'top' || i.type === 'bottom');
            title = '选择服装 (仅限衣架)';
        } else if (type === 'shelf') {
            // Shelf: Accessories, Shoes
            filteredItems = allItems.filter(i => i.type === 'accessory' || i.type === 'shoes');
            title = '选择配饰/鞋履 (仅限货架)';
        } else {
            filteredItems = allItems;
        }

        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.8)';
        div.style.zIndex = '300';
        div.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 320px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3>${title}</h3>
                <div style="flex: 1; overflow-y: auto; margin: 10px 0;">
                    <div class="item-grid">
                        ${filteredItems.map(item => `
                            <div class="item-card" onclick="window.game.ui.assignItemToFurniture('${type}', ${x}, ${y}, '${item.id}'); this.closest('.screen').remove();">
                                <div class="item-name">${item.name}</div>
                                <div class="item-stats">库存: ${item.quantity}</div>
                                <div class="item-stats">售价: ${item.price}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">取消</button>
            </div>
        `;
        document.body.appendChild(div);
    }

    assignItemToFurniture(type, x, y, itemId) {
        const furniture = this.game.state.shop.facilities.find(f =>
            f.type === type && f.x === x && f.y === y
        );

        if (furniture) {
            furniture.itemType = itemId;
            furniture.currentStock = 0;
            this.renderFurniturePanel(furniture);
            this.showDialog(`已设置为: ${itemId}`);
        }
    }

    manualRestock(type, x, y) {
        const furniture = this.game.state.shop.facilities.find(f =>
            f.type === type && f.x === x && f.y === y
        );

        if (furniture) {
            const restocked = this.game.state.shop.restockRack(furniture);
            if (restocked > 0) {
                this.renderFurniturePanel(furniture);
                this.showDialog(`补货成功: +${restocked}`);
            } else {
                this.showDialog('仓库库存不足!');
            }
        }
    }

    getWeatherEmoji(weather) {
        const map = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️' };
        return map[weather] || weather;
    }

    showStatusLegend() {
        let legend = document.getElementById('status-legend');
        if (!legend) {
            legend = document.createElement('div');
            legend.id = 'status-legend';
            legend.style.position = 'absolute';
            legend.style.top = '60px';
            legend.style.left = '50%';
            legend.style.transform = 'translateX(-50%)';
            legend.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
            legend.style.color = '#333';
            legend.style.padding = '6px 12px';
            legend.style.borderRadius = '12px';
            legend.style.zIndex = '2000';
            legend.style.fontSize = '12px';
            legend.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            legend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            legend.style.whiteSpace = 'nowrap';
            legend.style.pointerEvents = 'none';
            legend.style.transition = 'opacity 0.3s ease';
            legend.style.opacity = '0';
            legend.classList.add('hidden');

            document.getElementById('hud').appendChild(legend);
        }

        const state = this.game.state;
        const hours = Math.floor(state.time / 60);
        const mins = Math.floor(state.time % 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const seasonMap = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
        const seasonName = seasonMap[state.season] || state.season;

        legend.textContent = `时间: ${timeStr} | ${seasonName}第${state.day}天 | 天气: ${state.weather} | 资金: ${Math.floor(state.shop.money)} | 客流: ${state.dailyStats.visitors} | 成交: ${state.dailyStats.sales} | 营收: ${state.dailyStats.revenue}`;

        legend.classList.remove('hidden');
        void legend.offsetWidth;
        legend.style.opacity = '1';

        if (this.legendTimeout) {
            clearTimeout(this.legendTimeout);
        }

        this.legendTimeout = setTimeout(() => {
            legend.style.opacity = '0';
            setTimeout(() => {
                legend.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    showSaveSlotSelector() {
        const slots = this.game.state.getSaveSlots();

        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.9)';
        div.style.zIndex = '300';
        div.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 400px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0;">选择存档槽位</h3>
                <div style="flex: 1; overflow-y: auto; margin: 10px 0;">
                    ${[1, 2, 3].map(slotId => {
            const slot = slots[slotId];
            let slotInfo = '空存档';
            if (slot) {
                slotInfo = `第 ${slot.day} 天 - 资金: ${slot.money}`;
            }
            return `
                            <div class="save-slot" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; cursor: pointer; border-radius: 5px; background: #f9f9f9;"
                                 onclick="window.game.ui.handleSaveToSlot(${slotId}); this.closest('.screen').remove();">
                                <div style="font-weight: bold;">存档 ${slotId}</div>
                                <div style="color: #666; font-size: 12px;">${slotInfo}</div>
                            </div>
                        `;
        }).join('')}
                </div>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">取消</button>
            </div>
        `;
        document.body.appendChild(div);
    }

    handleSaveToSlot(slotId) {
        if (this.game.state.saveGame(slotId)) {
            this.showDialog(`游戏已保存到槽位 ${slotId}`);
        }
    }

    showLoadSlotSelector() {
        const slots = this.game.state.getSaveSlots();

        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.9)';
        div.style.zIndex = '300';
        div.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 400px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0;">选择要加载的存档</h3>
                <div style="flex: 1; overflow-y: auto; margin: 10px 0;">
                    ${[1, 2, 3].map(slotId => {
            const slot = slots[slotId];
            if (!slot) return '';
            return `
                            <div class="save-slot" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; cursor: pointer; border-radius: 5px; background: #f9f9f9;"
                                 onclick="window.game.loadGame(${slotId}); this.closest('.screen').remove();">
                                <div style="font-weight: bold;">存档 ${slotId}</div>
                                <div style="color: #666; font-size: 12px;">第 ${slot.day} 天 - 资金: ${slot.money}</div>
                            </div>
                        `;
        }).join('')}
                </div>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">取消</button>
            </div>
        `;
        document.body.appendChild(div);
    }

    renderSystem(container) {
        container.innerHTML = `
            <div class="system-panel">
                <h3>系统</h3>
                <button class="pixel-btn" style="width: 100%; margin-bottom: 10px;" onclick="window.game.ui.showSaveSlotSelector()">保存游戏</button>
                <hr>
                <p style="font-size: 12px; color: #666;">提示: 游戏会在每天结束时自动保存到槽位1</p>
            </div>
        `;
    }

    showStatusLegend() {
        let legend = document.getElementById('status-legend');
        if (!legend) {
            legend = document.createElement('div');
            legend.id = 'status-legend';
            legend.style.position = 'absolute';
            legend.style.top = '60px';
            legend.style.left = '50%';
            legend.style.transform = 'translateX(-50%)';
            legend.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
            legend.style.color = '#333';
            legend.style.padding = '6px 12px';
            legend.style.borderRadius = '12px';
            legend.style.zIndex = '2000';
            legend.style.fontSize = '12px';
            legend.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            legend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            legend.style.whiteSpace = 'nowrap';
            legend.style.pointerEvents = 'none';
            legend.style.transition = 'opacity 0.3s ease';
            legend.style.opacity = '0';
            legend.classList.add('hidden');

            document.getElementById('hud').appendChild(legend);
        }

        const state = this.game.state;
        const hours = Math.floor(state.time / 60);
        const mins = Math.floor(state.time % 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const seasonMap = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
        const seasonName = seasonMap[state.season] || state.season;

        legend.textContent = `时间: ${timeStr} | ${seasonName}第${state.day}天 | 天气: ${state.weather} | 资金: ${Math.floor(state.shop.money)} | 客流: ${state.dailyStats.visitors} | 成交: ${state.dailyStats.sales} | 营收: ${state.dailyStats.revenue}`;

        legend.classList.remove('hidden');
        void legend.offsetWidth;
        legend.style.opacity = '1';

        if (this.legendTimeout) {
            clearTimeout(this.legendTimeout);
        }

        this.legendTimeout = setTimeout(() => {
            legend.style.opacity = '0';
            setTimeout(() => {
                legend.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    showSaveSlotSelector() {
        const slots = this.game.state.getSaveSlots();

        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.9)';
        div.style.zIndex = '300';
        div.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 400px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0;">选择存档槽位</h3>
                <div style="flex: 1; overflow-y: auto; margin: 10px 0;">
                    ${[1, 2, 3].map(slotId => {
            const slot = slots[slotId];
            let slotInfo = '空存档';
            if (slot) {
                slotInfo = `第 ${slot.day} 天 - 资金: ${slot.money}`;
            }
            return `
                            <div class="save-slot" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; cursor: pointer; border-radius: 5px; background: #f9f9f9;"
                                 onclick="window.game.ui.handleSaveToSlot(${slotId}); this.closest('.screen').remove();">
                                <div style="font-weight: bold;">存档 ${slotId}</div>
                                <div style="color: #666; font-size: 12px;">${slotInfo}</div>
                            </div>
                        `;
        }).join('')}
                </div>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">取消</button>
            </div>
        `;
        document.body.appendChild(div);
    }

    handleSaveToSlot(slotId) {
        if (this.game.state.saveGame(slotId)) {
            this.showDialog(`游戏已保存到槽位 ${slotId}`);
        }
    }

    showLoadSlotSelector() {
        const slots = this.game.state.getSaveSlots();

        const div = document.createElement('div');
        div.className = 'screen active';
        div.style.backgroundColor = 'rgba(0,0,0,0.9)';
        div.style.zIndex = '300';
        div.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 400px; max-height: 80vh; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0;">选择要加载的存档</h3>
                <div style="flex: 1; overflow-y: auto; margin: 10px 0;">

                    ${(() => {
                const allSlots = ['auto', 1, 2, 3];
                return allSlots.map(slotId => {
                    const slot = slots[slotId];
                    const isAuto = slotId === 'auto';

                    // If manual slot is empty, skip it (keep existing behavior for manual slots)
                    if (!isAuto && !slot) return '';

                    const displayName = isAuto ? '自动存档' : `存档 ${slotId}`;
                    const style = isAuto ? 'border: 2px solid #4CAF50; background: #E8F5E9;' : 'border: 1px solid #ccc; background: #f9f9f9;';

                    // Handle string slotId for onclick
                    const loadArg = isAuto ? "'auto'" : slotId;

                    let slotInfo = '<span style="color: #999;">(空)</span>';
                    let onClick = '';

                    if (slot) {
                        slotInfo = `第 ${slot.day} 天 - 资金: ${slot.money}`;
                        onClick = `onclick="window.game.loadGame(${loadArg}); this.closest('.screen').remove();"`;
                    } else if (isAuto) {
                        // Empty auto slot is not clickable
                        onClick = `onclick="window.game.ui.showDialog('暂无自动存档');"`;
                    }

                    return `
                                <div class="save-slot" style="${style} padding: 10px; margin-bottom: 10px; cursor: pointer; border-radius: 5px;"
                                     ${onClick}>
                                    <div style="font-weight: bold;">${displayName}</div>
                                    <div style="color: #666; font-size: 12px;">${slotInfo}</div>
                                </div>
                            `;
                }).join('');
            })()}
                </div>
                <button class="pixel-btn" onclick="this.closest('.screen').remove()">取消</button>
            </div>
        `;
        document.body.appendChild(div);
    }
}
