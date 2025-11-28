import Shop from './Shop.js';
import { Employee } from './Employee.js';
import Customer from './Customer.js';

export default class GameState {
    constructor(game) {
        this.game = game;
        this.shop = null;
        this.employees = [];
        this.customers = [];
        this.time = 9.5 * 60; // 9:30 in minutes
        this.day = 1;
        this.season = 'spring'; // spring, summer, autumn, winter
        this.weather = 'sunny'; // sunny, rainy, cloudy, snowy
        this.forecast = null; // Tomorrow's weather
        this.phase = 'PRE_OPEN'; // PRE_OPEN, OPEN, CLOSED, EVENING
        this.dailyStats = {
            visitors: 0,
            sales: 0,
            revenue: 0
        };
        this.mode = 'PLAY'; // PLAY, EDIT
        this.selectedFurniture = null;
    }

    initNewGame() {
        this.shop = new Shop();
        this.shop.init();

        const emp = new Employee(this.game, '小衣');
        this.employees.push(emp);

        // Reset selection
        this.game.selectedEntity = null;

        this.startDay();
    }

    startDay() {
        // Called when business day starts (e.g., 8:00 or 9:30)
        this.time = 8 * 60; // Start at 8:00
        this.phase = 'PRE_OPEN';
        this.dailyStats = { visitors: 0, sales: 0, revenue: 0 };

        // Reset Employees
        // Reset Employees
        this.employees.forEach(emp => {
            emp.fatigue = 0;
            emp.enterShop(); // Trigger entry animation
        });

        // Weather Logic
        if (!this.forecast) {
            // First day initialization
            this.weather = 'sunny'; // Force sunny on first day
            this.forecast = this.generateWeather();
        } else {
            // Shift forecast to today
            this.weather = this.forecast;
            // Don't generate new forecast yet - wait until evening
        }

        // Process Pending Orders
        const arrived = this.shop.processOrders();
        if (arrived > 0) {
            this.game.ui.showDialog(`📦 进货到达！共 ${arrived} 件商品入库。`);
        }

        // Update UI Weather
        const weatherMap = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️' };
        const weatherEl = document.getElementById('weather-display');
        if (weatherEl) weatherEl.textContent = weatherMap[this.weather];

        this.game.ui.showDialog(`第 ${this.day} 天开始营业！今日天气: ${weatherMap[this.weather]}`);
    }

    generateWeather() {
        const rand = Math.random();
        if (this.season === 'winter') {
            if (rand < 0.4) return 'sunny';
            if (rand < 0.7) return 'cloudy';
            return 'snowy';
        }
        // Normal seasons
        if (rand < 0.6) return 'sunny';
        if (rand < 0.8) return 'cloudy';
        return 'rainy';
    }

    loadGame(slotId = 1) {
        const key = `street_shop_save_${slotId}`;
        const dataStr = localStorage.getItem(key);
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                console.log(`Loading save data from slot ${slotId}:`, data);

                // Initialize shop and employees if not already initialized
                if (!this.shop) {
                    this.shop = new Shop();
                    this.shop.init();
                }
                if (this.employees.length === 0) {
                    const emp = new Employee(this.game, '小衣');
                    this.employees.push(emp);
                }

                // Restore properties
                this.day = data.day;
                this.time = data.time;
                this.season = data.season;
                this.weather = data.weather;
                this.phase = data.phase || 'PRE_OPEN'; // Restore phase

                // Restore Shop Data
                if (data.shop) {
                    this.shop.money = data.shop.money;
                    this.shop.reputation = data.shop.reputation;
                    this.shop.level = data.shop.level;

                    if (data.shop.inventory) {
                        this.shop.inventory.items = data.shop.inventory;
                    }

                    if (data.shop.facilities) {
                        this.shop.facilities = data.shop.facilities;
                        // Migration: Update capacities
                        this.shop.facilities.forEach(f => {
                            if (f.type === 'shelf') {
                                f.capacity = 15;
                            } else if (f.type === 'rack') {
                                f.capacity = 10;
                            }
                        });
                    }

                    if (data.shop.pendingOrders) {
                        this.shop.pendingOrders = data.shop.pendingOrders;
                    }
                }

                // Restore employee stats
                if (data.employees && data.employees.length > 0) {
                    const savedEmp = data.employees[0];
                    const emp = this.employees[0];
                    emp.level = savedEmp.level;
                    emp.xp = savedEmp.xp;
                    emp.efficiency = savedEmp.efficiency;
                    emp.charisma = savedEmp.charisma;
                    emp.fatigue = savedEmp.fatigue;
                    emp.taskPriority = savedEmp.taskPriority || 'balanced';

                    // Set visibility based on phase
                    if (this.phase === 'EVENING') {
                        emp.isVisible = false;
                        emp.state = 'RESTING';
                    } else {
                        emp.isVisible = true;
                    }
                }

                this.game.ui.showDialog(`存档 ${slotId} 加载成功！`);
                return true;
            } catch (e) {
                console.error('Failed to load save:', e);
                this.game.ui.showDialog('存档损坏或加载失败');
            }
        } else {
            this.game.ui.showDialog('没有找到存档');
        }
        return false;
    }

    saveGame(slotId = 1) {
        const data = {
            day: this.day,
            time: this.time,
            phase: this.phase, // Save phase
            season: this.season,
            weather: this.weather,
            forecast: this.forecast,
            savedAt: new Date().toLocaleString('zh-CN'),
            shop: {
                money: this.shop.money,
                level: this.shop.level,
                reputation: this.shop.reputation,
                upgradeCost: this.shop.upgradeCost,
                inventory: this.shop.inventory.items,
                facilities: this.shop.facilities,
                pendingOrders: this.shop.pendingOrders
            },
            employees: this.employees.map(e => ({
                name: e.name,
                level: e.level,
                efficiency: e.efficiency,
                charisma: e.charisma,
                fatigue: e.fatigue,
                xp: e.xp,
                taskPriority: e.taskPriority
            }))
        };

        try {
            localStorage.setItem(`street_shop_save_${slotId}`, JSON.stringify(data));
            console.log(`Game saved to slot ${slotId}`);
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            this.game.ui.showDialog('保存失败: 存储空间不足?');
            return false;
        }
    }

    getSaveSlots() {
        const slots = {};
        // Check manual slots 1-3
        for (let i = 1; i <= 3; i++) {
            const dataStr = localStorage.getItem(`street_shop_save_${i}`);
            if (dataStr) {
                try {
                    slots[i] = JSON.parse(dataStr);
                } catch (e) { }
            }
        }
        // Check auto save slot
        const autoDataStr = localStorage.getItem(`street_shop_save_auto`);
        if (autoDataStr) {
            try {
                slots['auto'] = JSON.parse(autoDataStr);
            } catch (e) { }
        }
        return slots;
    }

    update(dt) {
        // Check if we need to pause time for closing
        let shouldAdvanceTime = true;
        if (this.phase === 'CLOSING' && this.time >= 20.5 * 60) {
            // Wait for ALL customers to leave
            if (this.customers.length > 0) {
                shouldAdvanceTime = false;
            }
        }

        // Time Progression
        if (shouldAdvanceTime) {
            if (this.phase === 'EVENING') {
                this.time += dt * 15; // Fast forward night
            } else if (this.phase !== 'CLOSED') {
                this.time += dt * 5; // Normal speed
            }
        }

        // Handle Day Rollover (Midnight)
        if (this.time >= 24 * 60) {
            this.time = 0;
            this.nextDay(); // Increment day, but don't start business yet
        }

        // Phase Transitions

        // 8:00 AM - Start Business Prep
        // Ensure we are in the morning (time < 12:00) to avoid triggering during evening (20:30+)
        if (this.phase === 'EVENING' && this.time >= 8 * 60 && this.time < 12 * 60) {
            this.startDay(); // Enters PRE_OPEN
        }

        // 10:00 AM - Open Shop
        if (this.phase === 'PRE_OPEN' && this.time >= 10 * 60) {
            this.phase = 'OPEN';
            this.game.ui.showDialog("店铺开始营业！");
        }

        if (this.phase === 'OPEN') {
            // Spawn Customers
            if (Math.random() < 0.02) {
                if (this.customers.length < 5) {
                    const customer = new Customer(this.game);
                    this.customers.push(customer);
                    this.dailyStats.visitors++;
                    this.game.ui.updateHUD(this);
                }
            }

            if (this.time >= 20 * 60) {
                this.phase = 'CLOSING';
                this.game.ui.showDialog("营业结束，准备打烊收尾。");
            }
        }

        if (this.phase === 'CLOSING' && this.time >= 20.5 * 60) {
            // Only switch to evening if time is advancing (meaning no queue) AND shop is empty
            if (shouldAdvanceTime && this.customers.length === 0) {
                // Check if employees are still in shop
                let allEmployeesLeft = true;
                this.employees.forEach(emp => {
                    if (emp.isVisible) {
                        allEmployeesLeft = false;
                        if (emp.state !== 'LEAVING_SHOP') {
                            emp.leaveShop();
                        }
                    }
                });

                if (allEmployeesLeft) {
                    this.phase = 'EVENING';
                    this.startEvening();
                } else {
                    // Pause time while employees leave
                    shouldAdvanceTime = false;
                }
            }
        }

        // Update Entities
        this.employees.forEach(e => e.update(dt, this));

        // Update Customers
        for (let i = this.customers.length - 1; i >= 0; i--) {
            const c = this.customers[i];
            c.update(dt, this);
            if (c.readyToRemove) {
                this.customers.splice(i, 1);
            }
        }

        // Update UI
        this.game.ui.updateHUD(this);
    }

    startEvening() {
        // Clear all customers and employees (they go home)
        this.customers = [];
        this.employees.forEach(emp => {
            emp.state = 'RESTING'; // Employee goes home
            emp.isVisible = false; // Hide employee
        });

        // Generate tomorrow's forecast
        this.forecast = this.generateWeather();

        const weatherMap = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️' };

        // Show daily summary and forecast
        this.game.ui.showDailySummary(this.dailyStats, this.forecast);

        this.game.ui.showDialog("🌙 进入晚间时段,可以查看明日预报并补货上架。");
        this.game.ui.showDialog(`📅 明日天气预报: ${weatherMap[this.forecast]}`);
    }

    nextDay() {
        this.day++;

        // Season change every 10 days
        const seasonIndex = Math.floor((this.day - 1) / 10) % 4;
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        this.season = seasons[seasonIndex];

        // Save game to AUTO slot
        this.saveGame('auto');
    }

    handleMouseDown(x, y) {
        this.handleClick(x, y);
    }

    handleClick(x, y) {
        if (this.mode === 'EDIT') {
            this.handleEditInput(x, y);
            return;
        }

        // Check furniture (all types)
        const clickedFurniture = this.shop.facilities.find(f =>
            x >= f.x && x <= f.x + f.width &&
            y >= f.y && y <= f.y + f.height
        );

        if (clickedFurniture) {
            this.game.ui.showFurniturePanel(clickedFurniture);
            return;
        }

        // Check employees
        let clickedEmp = null;
        this.employees.forEach(emp => {
            // Expand hit box to include head (y - 16) and slightly wider
            // Visual height is approx 24, so y-8 to y+16. Let's be generous: y-16 to y+16
            if (x >= emp.x - 8 && x <= emp.x + emp.width + 8 &&
                y >= emp.y - 16 && y <= emp.y + emp.height) {
                clickedEmp = emp;
            }
        });

        if (clickedEmp) {
            this.game.selectedEntity = clickedEmp;
            this.game.ui.showEmployeeAttributePanel(clickedEmp);
            return;
        }

        // Debug: Show where we clicked if nothing hit
        // this.game.ui.showDialog(`Clicked at ${Math.floor(x)}, ${Math.floor(y)}`);

        // Check customers
        let clickedCust = null;
        this.customers.forEach(cust => {
            if (x >= cust.x && x <= cust.x + cust.width &&
                y >= cust.y && y <= cust.y + cust.height) {
                clickedCust = cust;
            }
        });

        if (clickedCust) {
            this.game.selectedEntity = clickedCust;
            this.game.ui.showCustomerPanel(clickedCust);
        } else {
            // Clicked empty space
            this.game.selectedEntity = null;
            this.game.ui.hideAllPanels();
        }

        this.game.ui.updateHUD(this);
    }

    handleEditInput(x, y) {
        // Simple hit test for furniture in edit mode
        const clickedFurniture = this.shop.facilities.find(f =>
            x >= f.x && x <= f.x + f.width &&
            y >= f.y && y <= f.y + f.height
        );

        if (clickedFurniture) {
            this.selectedFurniture = clickedFurniture;
            this.isDragging = true;
            this.dragOffsetX = x - clickedFurniture.x;
            this.dragOffsetY = y - clickedFurniture.y;
            // Store original position for revert
            this.dragStartX = clickedFurniture.x;
            this.dragStartY = clickedFurniture.y;
            // Initial validity check
            this.selectedFurniture.isValid = true;
        } else {
            this.selectedFurniture = null;
            this.isDragging = false;
        }
    }

    getFurnitureName(type) {
        const names = {
            'rack': '衣架',
            'shelf': '货架',
            'counter': '收银台',
            'fitting_room': '试衣间',
            'break_room': '休息室',
            'plant': '盆栽'
        };
        return names[type] || type;
    }

    handleMouseMove(x, y) {
        if (this.mode === 'EDIT' && this.isDragging && this.selectedFurniture) {
            // Snap to grid (16px)
            const rawX = x - (this.dragOffsetX || 0);
            const rawY = y - (this.dragOffsetY || 0);

            const newX = Math.floor(rawX / 16) * 16;
            const newY = Math.floor(rawY / 16) * 16;

            // Boundary checks
            // Map is 15x10 tiles (240x160)
            // Ensure within bounds
            if (newX >= 0 && newX + this.selectedFurniture.width <= 240 &&
                newY >= 0 && newY + this.selectedFurniture.height <= 160) {
                this.selectedFurniture.x = newX;
                this.selectedFurniture.y = newY;

                // Check validity
                this.selectedFurniture.isValid = this.checkPlacementValidity(this.selectedFurniture);
            }
        }
    }

    handleMouseUp() {
        if (this.isDragging && this.selectedFurniture) {
            if (!this.selectedFurniture.isValid) {
                // Revert to original position
                this.selectedFurniture.x = this.dragStartX;
                this.selectedFurniture.y = this.dragStartY;
                this.selectedFurniture.isValid = true; // Reset validity
                this.game.ui.showDialog("❌ 无效位置，已还原");
            }
        }
        this.isDragging = false;
    }

    checkPlacementValidity(f) {
        // Check collision with other facilities
        for (const other of this.shop.facilities) {
            if (other === f) continue;
            // Simple AABB collision
            if (f.x < other.x + other.width &&
                f.x + f.width > other.x &&
                f.y < other.y + other.height &&
                f.y + f.height > other.y) {
                return false;
            }
        }

        // Check locked regions
        // Convert to grid coordinates
        const startX = Math.floor(f.x / 16);
        const startY = Math.floor(f.y / 16);
        const endX = Math.floor((f.x + f.width - 1) / 16);
        const endY = Math.floor((f.y + f.height - 1) / 16);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                // Ensure within map bounds
                if (x < 0 || x >= this.shop.map.width || y < 0 || y >= this.shop.map.height) return false;

                const region = this.shop.getRegion(x, y);
                if (!this.shop.unlockedRegions.includes(region)) {
                    return false;
                }
            }
        }

        return true;
    }

    toggleEditMode() {
        this.mode = this.mode === 'PLAY' ? 'EDIT' : 'PLAY';
        if (this.mode === 'EDIT') {
            this.game.ui.showEditorToolbar();
            this.game.ui.showDialog("进入装修模式");
        } else {
            this.game.ui.hideEditorToolbar();
            this.selectedFurniture = null;
            this.game.ui.showDialog("退出装修模式");
        }
    }

    addFurniture(type) {
        let cost = 0;
        let capacity = 0;
        let width = 32;
        let height = 16;

        switch (type) {
            case 'rack':
                cost = 200;
                capacity = 10;
                break;
            case 'shelf':
                cost = 300;
                capacity = 15; // Adjusted capacity
                break;
            case 'plant':
                cost = 50;
                width = 16;
                break;
        }

        if (this.shop.money >= cost) {
            this.shop.money -= cost;
            // Add to center
            const f = {
                type: type,
                x: 80, y: 60,
                width: width,
                height: height,
                itemType: null,
                capacity: capacity,
                currentStock: 0
            };
            this.shop.facilities.push(f);
            this.game.ui.showDialog(`购买成功! (-${cost}G)`);
            this.game.ui.updateHUD(this);
        } else {
            this.game.ui.showDialog(`资金不足! 需要 ${cost}G`);
        }
    }

    removeFurniture() {
        if (this.selectedFurniture) {
            const idx = this.shop.facilities.indexOf(this.selectedFurniture);
            if (idx > -1) {
                this.shop.facilities.splice(idx, 1);
                this.selectedFurniture = null;
                this.game.ui.showDialog("家具已移除");
            }
        }
    }
}
