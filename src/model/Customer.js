import { Pathfinding } from '../systems/Pathfinding.js';

export const CUSTOMER_TYPES = {
    boss: { name: '有钱老板', minCash: 2000, maxCash: 5000, affectionRate: 0.2, skin: 'customer_boss' },
    middle_man: { name: '中年男子', minCash: 800, maxCash: 1500, affectionRate: 0.5, skin: 'customer_middle_man' },
    middle_woman: { name: '中年女子', minCash: 800, maxCash: 1500, affectionRate: 0.6, skin: 'customer_middle_woman' },
    student: { name: '学生', minCash: 50, maxCash: 200, affectionRate: 1.5, skin: 'customer_student' },
    elderly_man: { name: '老爷爷', minCash: 300, maxCash: 800, affectionRate: 1.2, skin: 'customer_elderly_man' },
    elderly_woman: { name: '老奶奶', minCash: 300, maxCash: 800, affectionRate: 1.2, skin: 'customer_elderly_woman' },
    young_man: { name: '青年男子', minCash: 200, maxCash: 600, affectionRate: 1.0, skin: 'customer_young_man' },
    young_woman: { name: '青年女子', minCash: 200, maxCash: 600, affectionRate: 1.0, skin: 'customer_worker' },
    businesswoman: { name: '女强人', minCash: 2000, maxCash: 5000, affectionRate: 0.2, skin: 'customer_businesswoman' }
};

export default class Customer {
    constructor(game) {
        this.game = game;
        const mapHeight = this.game.state.shop.map.height * 16;
        this.x = 70 + Math.random() * 20; // Randomize door position (70-90)
        this.y = mapHeight - 16; // Start at bottom of map
        this.width = 16;
        this.height = 16;

        // Assign Type
        const types = Object.keys(CUSTOMER_TYPES);
        const typeKey = types[Math.floor(Math.random() * types.length)];
        const typeData = CUSTOMER_TYPES[typeKey];

        this.identity = typeData.name;
        this.type = typeData.skin; // Sprite key
        this.affectionRate = typeData.affectionRate;

        // Cash
        this.cash = Math.floor(typeData.minCash + Math.random() * (typeData.maxCash - typeData.minCash));

        // Affection (0-5 hearts, stored as 0-100 internally)
        this.affection = 0;
        this.maxAffection = 100;

        this.state = 'ENTERING'; // ENTERING, BROWSING, FITTING, QUEUEING, LEAVING
        this.expression = 'thinking'; // Start with curious expression
        this.target = null;
        this.path = [];
        this.pathIndex = 0;
        this.speed = 30; // pixels per second
        this.isMoving = false;
        this.isVisible = true; // For fitting room

        this.patience = 100;

        this.pathfinder = new Pathfinding(game);

        // 方向: 0=下, 1=左, 2=右, 3=上
        this.direction = 0;

        // Timers
        this.stateTimer = 0;
        this.waitingAtRack = false;
        this.deciding = false;

        // Select Desire based on Weather
        this.selectDesire();

        // Entering Bubble (30% chance)
        if (Math.random() < 0.3) {
            this.game.addEffect({
                type: 'bubble',
                x: this.x,
                y: this.y,
                text: '看看...',
                life: 2.0
            });
        }

        console.log(`[NEW CUSTOMER] Created at (${Math.floor(this.x)}, ${Math.floor(this.y)}), state: ${this.state}`);
    }

    selectDesire() {
        const weather = this.game.state.weather;
        const inventory = this.game.state.shop.inventory;

        // Get all available item IDs from inventory (even if 0 stock, we might want it)
        // But better to only desire things that exist in the game definition
        const allItems = inventory.items;

        let weightedItems = [];

        allItems.forEach(item => {
            let weight = 10; // Base weight

            if (item.tags) {
                if (weather === 'sunny') {
                    if (item.tags.includes('cool')) weight += 30;
                    if (item.tags.includes('rain')) weight -= 50; // Less likely
                } else if (weather === 'rainy') {
                    if (item.tags.includes('rain')) weight += 100; // High demand
                } else if (weather === 'snowy') {
                    if (item.tags.includes('warm')) weight += 100;
                    else weight = 1; // Almost zero for non-warm
                }
            }

            // Ensure weight is positive
            weight = Math.max(1, weight);

            // Add to weighted list
            for (let i = 0; i < weight; i++) {
                weightedItems.push(item.id);
            }
        });

        if (weightedItems.length > 0) {
            this.desire = weightedItems[Math.floor(Math.random() * weightedItems.length)];
        } else {
            this.desire = 'tshirt'; // Fallback
        }

        // Console log for debug
        // console.log(`Weather: ${weather}, Customer wants: ${this.desire}`);
    }

    update(dt, gameState) {
        // Helper for state timer
        if (this.stateTimer > 0) {
            this.stateTimer -= dt;
        }

        if (this.state === 'ENTERING') {
            // Move to center of shop (must be in Region 0: Y >= 80)
            if (!this.hasPath()) {
                console.log(`[ENTERING] Customer at (${Math.floor(this.x)}, ${Math.floor(this.y)}), moving to center`);
                this.moveTo(80, 96); // Changed from (80, 64) to be in Region 0
                this.isMoving = true;
            } else {
                this.followPath(dt);
                this.isMoving = true;
                if (this.pathFinished()) {
                    console.log(`[ENTERING] Reached center, switching to BROWSING`);
                    this.state = 'BROWSING';
                    this.expression = 'thinking';
                    this.findItem();
                    this.isMoving = false;
                }
            }
        } else if (this.state === 'BROWSING') {
            if (!this.hasPath()) {
                // Wait a bit then move to item
                const rack = gameState.shop.facilities.find(f => f.type === 'rack');
                if (rack) {
                    this.moveTo(rack.x, rack.y + 16);
                }
            } else {
                this.followPath(dt);
                if (this.pathFinished()) {
                    // Arrived at rack
                    if (this.stateTimer <= 0 && !this.waitingAtRack) {
                        // Start waiting
                        // Start waiting
                        this.waitingAtRack = true;
                        this.stateTimer = 2.0; // Wait 2 seconds

                        // Bubble (30% chance)
                        if (Math.random() < 0.3) {
                            this.game.addEffect({
                                type: 'bubble',
                                x: this.x,
                                y: this.y,
                                text: '挑选中...',
                                life: 2.0
                            });
                        }
                    } else if (this.stateTimer <= 0 && this.waitingAtRack) {
                        // Done waiting, check stock BEFORE fitting
                        this.waitingAtRack = false;

                        // Find the specific rack they were browsing
                        const rack = gameState.shop.facilities.find(f =>
                            (f.type === 'rack' || f.type === 'shelf') &&
                            f.itemType === this.desire
                        );

                        if (rack && rack.currentStock > 0) {
                            // Has stock on rack, go to fitting room
                            this.state = 'FITTING';
                            this.expression = 'neutral';

                            // Find fitting room
                            const fittingRoom = gameState.shop.facilities.find(f => f.type === 'fitting_room');
                            if (fittingRoom) {
                                this.moveTo(fittingRoom.x + 16, fittingRoom.y + 32); // Entrance
                            } else {
                                // No fitting room, skip to deciding
                                this.state = 'DECIDING';
                            }
                        } else {
                            // Out of stock!
                            this.state = 'LEAVING';
                            this.expression = 'sad';
                            const mapHeight = this.game.state.shop.map.height * 16;
                            this.moveTo(70 + Math.random() * 20, mapHeight - 16);

                            this.game.addEffect({
                                type: 'bubble',
                                x: this.x,
                                y: this.y,
                                text: '卖光了..',
                                life: 2.0
                            });
                        }
                    }
                }
            }
        } else if (this.state === 'FITTING') {
            if (this.hasPath() && !this.pathFinished()) {
                this.followPath(dt);
            } else {
                // Arrived at fitting room
                if (this.stateTimer <= 0 && this.isVisible) {
                    // Enter fitting room
                    this.isVisible = false; // Hide sprite
                    this.stateTimer = 2.0; // Change clothes time

                    // Bubble (Always show for fitting as it explains disappearance)
                    this.game.addEffect({
                        type: 'bubble',
                        x: this.x,
                        y: this.y - 16, // Bubble higher up
                        text: '试穿中...',
                        life: 2.0
                    });
                } else if (this.stateTimer <= 0 && !this.isVisible) {
                    // Done fitting
                    this.isVisible = true; // Show sprite
                    this.state = 'DECIDING';
                    // Move to a safe position in Region 0 (Y >= 80)
                    this.moveTo(this.x, 96); // Changed from 64 to be in Region 0
                }
            }
        } else if (this.state === 'DECIDING') {
            if (this.hasPath() && !this.pathFinished()) {
                this.followPath(dt);
            } else {
                // Deciding logic
                if (this.stateTimer <= 0 && !this.deciding) {
                    this.deciding = true;
                    this.stateTimer = 1.0;
                    // Bubble (30% chance)
                    if (Math.random() < 0.3) {
                        this.game.addEffect({
                            type: 'bubble',
                            x: this.x,
                            y: this.y,
                            text: '嗯...',
                            life: 1.0
                        });
                    }
                } else if (this.stateTimer <= 0 && this.deciding) {
                    this.deciding = false;
                    // 70% chance to buy
                    if (Math.random() < 0.7) {
                        // Stock already checked before fitting
                        this.state = 'QUEUEING';
                        this.expression = 'happy';

                        // Find counter
                        const counter = gameState.shop.facilities.find(f => f.type === 'counter');
                        if (counter) {
                            // Move to FRONT of counter (y + height), not center
                            this.moveTo(counter.x + 16, counter.y + 32);
                        } else {
                            // Fallback if no counter (shouldn't happen)
                            this.moveTo(16, 112);
                        }
                        this.game.addEffect({
                            type: 'bubble',
                            x: this.x,
                            y: this.y,
                            text: '买这个!',
                            life: 1.0
                        });
                    } else {
                        this.state = 'LEAVING';
                        this.expression = 'sad';
                        const mapHeight = this.game.state.shop.map.height * 16;
                        this.moveTo(70 + Math.random() * 20, mapHeight - 16);
                    }
                }
            }
        } else if (this.state === 'QUEUEING') {
            if (this.hasPath() && !this.pathFinished()) {
                this.followPath(dt);
            } else {
                // Wait for employee
            }
        } else if (this.state === 'LEAVING') {
            if (!this.hasPath()) {
                const mapHeight = this.game.state.shop.map.height * 16;
                const targetY = mapHeight - 16;

                console.log(`[LEAVING] Customer at (${Math.floor(this.x)}, ${Math.floor(this.y)}), target: (70-90, ${targetY}), mapHeight: ${mapHeight}`);

                // If we are close to the bottom edge, just leave
                if (this.y >= mapHeight - 24) {
                    console.log(`[LEAVING] Close to exit, removing`);
                    this.readyToRemove = true;
                    return;
                }

                this.moveTo(70 + Math.random() * 20, targetY);

                console.log(`[LEAVING] After moveTo, path:`, this.path);

                // If path is empty (already there) or null (stuck), force remove
                // If path is null, it means pathfinding failed (stuck in wall or no path)
                if (!this.path || this.path.length === 0) {
                    console.log(`[LEAVING] No path or empty path, removing`);
                    this.readyToRemove = true;
                }
            } else {
                this.followPath(dt);
                if (this.pathFinished()) {
                    console.log(`[LEAVING] Path finished, removing`);
                    this.readyToRemove = true; // Mark for removal
                }
            }
        }
    }

    moveTo(x, y) {
        this.path = this.pathfinder.findPath(this.x, this.y, x, y, this);
        this.pathIndex = 0;
        if (!this.path) {
            // console.log("No path found!");
        }
    }

    hasPath() {
        return this.path && this.path.length > 0;
    }

    pathFinished() {
        return this.pathIndex >= this.path.length;
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

            // 更新方向
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx > absDy) {
                // 水平移动
                this.direction = dx > 0 ? 2 : 1; // 2=右, 1=左
            } else {
                // 垂直移动
                this.direction = dy > 0 ? 0 : 3; // 0=下, 3=上
            }
        }
    }

    findItem() {
        // Find a rack that has the specific item type
        const targetRack = this.game.state.shop.facilities.find(f =>
            (f.type === 'rack' || f.type === 'shelf') && f.itemType === this.desire
        );

        if (targetRack) {
            // Target position below the rack
            this.moveTo(targetRack.x + 8, targetRack.y + 16);
        } else {
            // No rack for this item? Leave.
            // console.log(`No rack found for ${this.desire}`);
            this.state = 'LEAVING';
            const mapHeight = this.game.state.shop.map.height * 16;
            this.moveTo(70 + Math.random() * 20, mapHeight - 16);
        }
    }

    addAffection(amount) {
        const adjustedAmount = amount * this.affectionRate;
        this.affection = Math.min(this.maxAffection, this.affection + adjustedAmount);

        if (adjustedAmount > 0) {
            this.game.addEffect({
                type: 'floating_text',
                x: this.x,
                y: this.y - 10,
                text: '♥',
                color: '#E91E63',
                life: 1.0
            });
        }
    }
}
