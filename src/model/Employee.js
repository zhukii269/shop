import { Pathfinding } from '../systems/Pathfinding.js';

export class Employee {
    constructor(game, name) {
        this.game = game;
        this.name = name;
        this.role = '全能型';
        this.level = 1;
        this.efficiency = 50;
        this.charisma = 50;
        this.fatigue = 0;
        this.loyalty = 100;
        this.taskPriority = 'balanced'; // balanced, guide, cashier

        // Leveling
        this.xp = 0;
        this.xpToNextLevel = 100;

        // Position
        this.x = 20;
        this.y = 100; // Near counter
        this.width = 16;
        this.height = 16;
        this.type = 'employee';

        this.state = 'IDLE'; // IDLE, MOVING, WORKING, RESTING
        this.expression = 'neutral'; // neutral, happy, tired, thinking
        this.path = [];
        this.pathIndex = 0;
        this.speed = 40; // Faster than customer
        this.isMoving = false;

        this.pathfinder = new Pathfinding(game);

        // 方向: 0=下, 1=左, 2=右, 3=上
        this.direction = 0;
        this.isVisible = true;
        this.restTimer = 0; // Timer for resting
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);

        // Stats increase
        this.efficiency = Math.min(100, this.efficiency + 5);
        this.charisma = Math.min(100, this.charisma + 5);

        // Happy expression on level up
        this.expression = 'happy';
        setTimeout(() => { this.expression = 'neutral'; }, 3000);

        this.game.ui.showDialog(`${this.name} 升级了！当前等级: ${this.level}`);

        // Floating Text
        this.game.addEffect({
            type: 'floating_text',
            x: this.x,
            y: this.y - 10,
            text: 'LEVEL UP!',
            color: '#00FF00',
            life: 2.0
        });
    }

    update(dt, gameState) {
        // 0. Force Stop Resting at Closing (20:30)
        // Only trigger during CLOSING phase, NOT EVENING (when they should be gone)
        if (gameState.time >= 20.5 * 60 && gameState.phase === 'CLOSING') {
            if (this.state === 'RESTING' || this.state === 'MOVING_TO_REST') {
                this.fatigue = 0;
                this.restTimer = 0;
                this.state = 'IDLE';
                this.isVisible = true;
                this.isMoving = false;
                this.expression = 'neutral';

                // Use Bubble instead of Dialog
                this.game.addEffect({
                    type: 'bubble',
                    x: this.x,
                    y: this.y - 20,
                    text: '不休息了!',
                    life: 2.0
                });

                // Move out of break room
                const breakRoom = gameState.shop.facilities.find(f => f.type === 'break_room');
                if (breakRoom) {
                    this.moveTo(breakRoom.x, breakRoom.y + 32);
                }
                return;
            }
        }

        // 1. Handle Resting State
        if (this.state === 'RESTING') {
            this.restTimer += dt;
            // Rest for 1 hour game time (12 real seconds)
            if (this.restTimer >= 12 && gameState.phase === 'OPEN') {
                this.fatigue = 0;
                this.restTimer = 0;
                this.state = 'IDLE';
                this.isVisible = true;
                this.expression = 'neutral';
                this.game.ui.showDialog(`${this.name} 休息好了，重新投入工作！`);

                // Move out of break room
                const breakRoom = gameState.shop.facilities.find(f => f.type === 'break_room');
                if (breakRoom) {
                    this.moveTo(breakRoom.x, breakRoom.y + 32);
                }
            }
            return; // Skip other updates while resting
        }

        // 2. Handle Moving to Rest
        if (this.state === 'MOVING_TO_REST') {
            this.followPath(dt);
            this.isMoving = true;

            if (this.pathFinished()) {
                this.state = 'RESTING';
                this.restTimer = 0;
                this.isVisible = false;
                this.isMoving = false;
            }
            return;
        }

        // 3. Handle Leaving Shop (Closing)
        if (this.state === 'LEAVING_SHOP') {
            this.followPath(dt);
            this.isMoving = true;

            if (this.pathFinished()) {
                this.isVisible = false;
                this.isMoving = false;
                // Stay in LEAVING_SHOP state but invisible
            }
            return;
        }

        // 4. Handle Entering Shop (Opening)
        if (this.state === 'ENTERING_SHOP') {
            this.followPath(dt);
            this.isMoving = true;

            if (this.pathFinished()) {
                this.state = 'IDLE';
                this.isMoving = false;
                this.game.ui.showDialog(`${this.name} 到岗了！`);
            }
            return;
        }

        // 5. Check for Fatigue (Trigger Rest)
        if (this.fatigue >= 20) {
            const breakRoom = gameState.shop.facilities.find(f => f.type === 'break_room');
            if (breakRoom) {
                this.game.ui.showDialog(`${this.name} 太累了，去休息室休息一下。`);
                this.moveTo(breakRoom.x, breakRoom.y + 16);
                this.state = 'MOVING_TO_REST';
                return;
            }
        }

        // 6. Standard Update
        this.isMoving = (this.state === 'MOVING');

        // Fatigue effects
        let currentEfficiency = this.efficiency;
        if (this.fatigue >= 18) {
            currentEfficiency *= 0.7;
            this.expression = 'tired';
        } else if (this.fatigue >= 23) {
            currentEfficiency *= 0.1;
            this.expression = 'tired';
        } else if (this.state === 'WORKING') {
            this.expression = 'happy';
        } else {
            this.expression = 'neutral';
        }

        if (this.state === 'IDLE') {
            this.decideAction(gameState, currentEfficiency);
        } else if (this.state === 'MOVING') {
            this.followPath(dt);
            if (this.pathFinished()) {
                if (this.targetRack) {
                    // Perform Restock
                    const restocked = gameState.shop.restockRack(this.targetRack);
                    if (restocked > 0) {
                        this.game.addEffect({
                            type: 'bubble',
                            x: this.x, y: this.y,
                            text: `补货 +${restocked}`,
                            life: 1.5
                        });
                        this.fatigue += 2;
                    }
                    this.targetRack = null;
                    this.state = 'IDLE';
                } else {
                    this.state = 'IDLE';
                }
            }
        }
    }

    decideAction(gameState, currentEfficiency) {
        // Check for customers queuing
        const queuingCustomer = gameState.customers.find(c => c.state === 'QUEUEING');
        if (queuingCustomer) {
            // Go to counter
            const counter = gameState.shop.facilities.find(f => f.type === 'counter');
            if (!counter) return;

            const targetX = counter.x + 16;
            const targetY = counter.y;

            // If already there, work
            const dist = Math.sqrt(Math.pow(this.x - queuingCustomer.x, 2) + Math.pow(this.y - queuingCustomer.y, 2));

            if (dist < 48) {
                // Work: checkout
                this.state = 'WORKING';
                this.expression = 'happy';

                this.game.addEffect({
                    type: 'bubble',
                    x: this.x + 8,
                    y: this.y,
                    text: '你好!',
                    life: 1.0
                });

                setTimeout(() => {
                    if (queuingCustomer.state !== 'QUEUEING') {
                        this.state = 'IDLE';
                        return;
                    }

                    const itemSold = queuingCustomer.desire || 'tshirt';

                    const rack = gameState.shop.facilities.find(f =>
                        (f.type === 'rack' || f.type === 'shelf') &&
                        f.itemType === itemSold
                    );

                    if (rack) {
                        rack.currentStock = Math.max(0, (rack.currentStock || 0) - 1);
                    } else {
                        gameState.shop.inventory.removeItem(itemSold);
                    }

                    gameState.shop.money += 50;
                    gameState.dailyStats.sales++;
                    gameState.dailyStats.revenue += 50;

                    if (queuingCustomer.addAffection) {
                        queuingCustomer.addAffection(10);
                    }

                    this.game.addEffect({
                        type: 'floating_text',
                        x: 20,
                        y: 90,
                        text: '+50G',
                        color: 'gold',
                        life: 1.0
                    });

                    this.gainXp(10);

                    this.game.addEffect({
                        type: 'bubble',
                        x: this.x + 8,
                        y: this.y,
                        text: '谢谢!',
                        life: 1.0
                    });

                    this.fatigue += 2;

                    queuingCustomer.state = 'LEAVING';
                    queuingCustomer.expression = 'happy';
                    const mapHeight = this.game.state.shop.map.height * 16;
                    queuingCustomer.moveTo(70 + Math.random() * 20, mapHeight - 16);

                    this.state = 'IDLE';
                }, 2000 / (currentEfficiency / 50));
            } else {
                this.moveTo(targetX, targetY);
            }
            return;
        }

        // Check for empty racks
        if (this.state === 'IDLE' && !this.currentTask) {
            const emptyRack = gameState.shop.facilities.find(f =>
                (f.type === 'rack' || f.type === 'shelf') &&
                f.itemType &&
                (f.currentStock || 0) < (f.capacity || 10) * 0.3
            );

            if (emptyRack) {
                const item = gameState.shop.inventory.items.find(i => i.id === emptyRack.itemType);
                if (item && item.quantity > 0) {
                    this.targetRack = emptyRack;
                    this.moveTo(emptyRack.x, emptyRack.y + 16);
                    return;
                }
            }
        }

        // Wander
        if (Math.random() < 0.01) {
            this.moveTo(20 + Math.random() * 100, 40 + Math.random() * 60);
        }
    }

    leaveShop() {
        this.state = 'LEAVING_SHOP';
        this.expression = 'happy';

        // Use Bubble instead of Dialog
        this.game.addEffect({
            type: 'bubble',
            x: this.x,
            y: this.y - 20,
            text: '下班啦!',
            life: 2.0
        });

        // Move to bottom of map (exit)
        const mapHeight = this.game.state.shop.map.height * 16;
        this.moveTo(70 + Math.random() * 20, mapHeight - 16);
    }

    enterShop() {
        this.state = 'ENTERING_SHOP';
        this.isVisible = true;
        this.expression = 'happy';
        // Start at bottom
        const mapHeight = this.game.state.shop.map.height * 16;
        this.x = 70 + Math.random() * 20;
        this.y = mapHeight - 16;

        // Move to counter area
        this.moveTo(20 + Math.random() * 40, 100);
    }

    moveTo(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        if (dx * dx + dy * dy < 4) return;

        this.path = this.pathfinder.findPath(this.x, this.y, x, y, this);
        this.pathIndex = 0;
        if (this.path && this.path.length > 0) {
            this.state = 'MOVING';
        }
    }

    pathFinished() {
        return !this.path || this.pathIndex >= this.path.length;
    }

    followPath(dt) {
        if (!this.path || this.pathIndex >= this.path.length) return;

        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
            this.x = target.x;
            this.y = target.y;
            this.pathIndex++;
        } else {
            const moveDist = this.speed * dt;
            this.x += (dx / dist) * moveDist;
            this.y += (dy / dist) * moveDist;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx > absDy) {
                this.direction = dx > 0 ? 2 : 1;
            } else {
                this.direction = dy > 0 ? 0 : 3;
            }
        }
    }
}
