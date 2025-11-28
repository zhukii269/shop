// Bundled Game Script


// --- src/core/Utils.js ---
const Utils = {
    randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    },

    // Simple AABB collision
    rectIntersect(r1, r2) {
        return !(r2.x > r1.x + r1.w ||
            r2.x + r2.w < r1.x ||
            r2.y > r1.y + r1.h ||
            r2.y + r2.h < r1.y);
    }
};


// --- src/systems/Pathfinding.js ---
class Pathfinding {
    constructor(game) {
        this.game = game;
    }

    findPath(startX, startY, endX, endY, entity = null) {
        const map = this.game.state.shop.map;
        const grid = this.createGrid(map, entity);

        // Convert pixel coords to grid coords
        const startNode = { x: Math.floor(startX / 16), y: Math.floor(startY / 16) };
        const endNode = { x: Math.floor(endX / 16), y: Math.floor(endY / 16) };

        // Check bounds
        // Allow start node to be blocked (so we can move out of it), but must be in bounds
        if (startNode.x < 0 || startNode.x >= grid[0].length || startNode.y < 0 || startNode.y >= grid.length) {
            return null;
        }

        // End node must be valid (walkable and in bounds)
        if (!this.isValid(endNode.x, endNode.y, grid)) {
            return null;
        }

        const openList = [];
        const closedList = [];

        startNode.g = 0;
        startNode.h = this.heuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;
        startNode.parent = null;

        openList.push(startNode);

        while (openList.length > 0) {
            // Get node with lowest f
            let currentNode = openList[0];
            let currentIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < currentNode.f) {
                    currentNode = openList[i];
                    currentIndex = i;
                }
            }

            // Remove current from open, add to closed
            openList.splice(currentIndex, 1);
            closedList.push(currentNode);

            // Found destination
            if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
                const path = [];
                let curr = currentNode;
                while (curr.parent) {
                    path.push({ x: curr.x * 16, y: curr.y * 16 });
                    curr = curr.parent;
                }
                return path.reverse();
            }

            // Generate children
            const neighbors = [
                { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
            ];

            for (let neighbor of neighbors) {
                const nodeX = currentNode.x + neighbor.x;
                const nodeY = currentNode.y + neighbor.y;

                if (!this.isValid(nodeX, nodeY, grid)) continue;

                // Check if in closed list
                if (closedList.find(n => n.x === nodeX && n.y === nodeY)) continue;

                // Create new node
                const newNode = { x: nodeX, y: nodeY, parent: currentNode };
                newNode.g = currentNode.g + 1;
                newNode.h = this.heuristic(newNode, endNode);
                newNode.f = newNode.g + newNode.h;

                // Check if in open list with lower g
                const existingNode = openList.find(n => n.x === nodeX && n.y === nodeY);
                if (existingNode && existingNode.g < newNode.g) continue;

                openList.push(newNode);
            }
        }

        return null; // No path
    }

    createGrid(map, entity = null) {
        // 0 = walkable, 1 = blocked
        // In map data: 0 = floor, 1 = wall. So map data 1 is blocked.
        const grid = [];
        for (let y = 0; y < map.height; y++) {
            const row = [];
            for (let x = 0; x < map.width; x++) {
                // If map tile is not 0 (floor), it's blocked (1)
                row.push(map.tiles[y][x] !== 0 ? 1 : 0);
            }
            grid.push(row);
        }

        // Mark facilities as blocked
        // Counter is only walkable for employees
        const isEmployee = entity && entity.type === 'employee';

        this.game.state.shop.facilities.forEach(f => {
            // Skip counter and break_room if entity is an employee
            if ((f.type === 'counter' || f.type === 'break_room') && isEmployee) return;

            const tx = Math.floor(f.x / 16);
            const ty = Math.floor(f.y / 16);
            const tw = Math.ceil(f.width / 16);
            const th = Math.ceil(f.height / 16);

            for (let y = ty; y < ty + th; y++) {
                for (let x = tx; x < tx + tw; x++) {
                    if (y < grid.length && x < grid[0].length) {
                        grid[y][x] = 1;
                    }
                }
            }
        });

        return grid;
    }

    isValid(x, y, grid) {
        return x >= 0 && x < grid[0].length && y >= 0 && y < grid.length && grid[y][x] === 0;
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
}


// --- src/view/Assets.js ---
class Assets {
    constructor() {
        this.images = {};

        // Macaron Palette
        this.colors = {
            bg: '#FFF8E1',
            primary: '#FFCCBC',
            secondary: '#B3E5FC',
            accent: '#FFF9C4',
            text: '#5D4037',
            skin: '#FFE0B2',
            blush: '#FFAB91',
            hair: {
                brown: '#795548',
                black: '#3E2723',
                blonde: '#FFECB3'
            },
            clothes: {
                pink: '#F8BBD0',
                blue: '#B3E5FC',
                yellow: '#FFF9C4',
                green: '#C8E6C9',
                white: '#FFFFFF'
            }
        };
    }

    async init() {
        console.log('🎨 Assets initialization started...');

        // 始终生成环境资源
        this.generateTiles();
        this.generateFurniture();
        this.generateIcons();

        // 尝试加载外部精灵图
        let externalLoaded = false;
        try {
            await this.loadExternalSprites();
            console.log('✅ External sprites loaded successfully');
            externalLoaded = true;
        } catch (error) {
            console.warn('⚠️ Failed to load external sprites:', error.message);
            console.error('Error details:', error);
        }

        // 如果外部加载失败,生成程序化角色
        if (!externalLoaded) {
            console.log('🎨 Using procedural asset generation');
            this.generateCharacters();
        }

        console.log('✅ Assets initialization complete');
    }

    async loadExternalSprites() {
        // 1. 加载角色精灵图 (动态计算帧尺寸)
        const spriteConfigs = [
            { key: 'employee', path: './assets/characters/employee/employee.png', rows: 4, cols: 4 },
            { key: 'customer_student', path: './assets/characters/customer/student.png', rows: 4, cols: 4 },
            { key: 'customer_worker', path: './assets/characters/customer/worker.png', rows: 4, cols: 4 },
            { key: 'customer_boss', path: './assets/characters/customer/boss.png', rows: 4, cols: 4 },
            { key: 'customer_middle_man', path: './assets/characters/customer/middle_man.png', rows: 4, cols: 4 },
            { key: 'customer_middle_woman', path: './assets/characters/customer/middle_woman.png', rows: 4, cols: 4 },
            { key: 'customer_elderly_man', path: './assets/characters/customer/elderly_man.png', rows: 4, cols: 4 },
            { key: 'customer_elderly_woman', path: './assets/characters/customer/elderly_woman.png', rows: 4, cols: 4 },
            { key: 'customer_young_man', path: './assets/characters/customer/young_man.png', rows: 4, cols: 4 },
            { key: 'customer_businesswoman', path: './assets/characters/customer/businesswoman.png', rows: 4, cols: 4 }
        ];

        const characterPromises = spriteConfigs.map(config => this.loadSpriteSheet(config));

        // 2. 加载环境贴图 (家具/地板)
        const environmentConfigs = [
            { key: 'floor_light', path: './assets/environment/floor.png' },
            { key: 'wall', path: './assets/environment/wall.png' },
            // Furniture
            { key: 'rack', path: './assets/furniture/rack.png' },
            { key: 'shelf', path: './assets/furniture/clothing_counter.png' },
            { key: 'counter', path: './assets/furniture/counter.png' },
            { key: 'fitting_room', path: './assets/furniture/fitting_room.png' },
            { key: 'break_room', path: './assets/furniture/break_room.png' }
        ];

        const envPromises = environmentConfigs.map(config => this.loadImage(config));

        await Promise.all([...characterPromises, ...envPromises]);
    }


    async loadImage(config) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log(`✅ Successfully loaded: ${config.key} from ${config.path}`);
                this.images[config.key] = img;
                resolve(img);
            };
            img.onerror = (error) => {
                // 静默失败，保持程序生成作为后备
                console.warn(`❌ Failed to load ${config.key} from ${config.path}`);
                console.warn(`   Attempted URL: ${img.src}`);
                // 不要设置为 null，保留程序生成的资源
                resolve(null);
            };
            img.src = config.path;
            console.log(`🔄 Attempting to load: ${config.key} from ${config.path}`);
        });
    }

    async loadSpriteSheet(config) {
        console.log(`🔄 Loading: ${config.key} from ${config.path}`);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log(`📥 Loaded: ${config.key} (${img.width}x${img.height})`);

                // 动态计算帧尺寸
                const frameWidth = Math.floor(img.width / config.cols);
                const frameHeight = Math.floor(img.height / config.rows);

                console.log(`📏 Frame size for ${config.key}: ${frameWidth}x${frameHeight}`);

                this.images[config.key] = {
                    image: img,
                    frameWidth: frameWidth,
                    frameHeight: frameHeight,
                    rows: config.rows,
                    cols: config.cols
                };

                // 创建帧引用
                for (let row = 0; row < config.rows; row++) {
                    for (let col = 0; col < config.cols; col++) {
                        // Key format: type_direction_frame
                        // Assuming rows correspond to directions: 0=Down, 1=Left, 2=Right, 3=Up
                        const key = `${config.key}_${row}_${col}`;

                        this.images[key] = {
                            spriteSheet: config.key,
                            frame: col,
                            direction: row
                        };
                    }
                }

                console.log(`✅ Sprite ready: ${config.key}`);
                resolve(img);
            };
            img.onerror = (error) => {
                console.warn(`❌ Failed to load sprite sheet ${config.key} from ${config.path}`);
                // Resolve null instead of reject to allow other assets to load
                resolve(null);
            };
            img.src = config.path;
        });
    }

    createCanvas(width, height) {
        const SCALE = 4; // High-DPI Scale
        const c = document.createElement('canvas');
        c.width = width * SCALE;
        c.height = height * SCALE;
        const ctx = c.getContext('2d');
        ctx.scale(SCALE, SCALE);
        // Default to finer lines (0.25 logical = 1 physical pixel)
        ctx.lineWidth = 0.25;
        return c;
    }

    generateTiles() {
        const floor = this.createCanvas(16, 16);
        const ctxF = floor.getContext('2d');
        ctxF.fillStyle = '#FFF8E1';
        ctxF.fillRect(0, 0, 16, 16);
        ctxF.fillStyle = '#FFEBEE';
        this.drawHeart(ctxF, 8, 8, 4);
        this.images['floor_light'] = floor;
        this.images['floor'] = floor;

        const floorDark = this.createCanvas(16, 16);
        const ctxD = floorDark.getContext('2d');
        ctxD.fillStyle = '#E1F5FE';
        ctxD.fillRect(0, 0, 16, 16);
        ctxD.fillStyle = '#B3E5FC';
        ctxD.fillRect(0, 0, 8, 8);
        ctxD.fillRect(8, 8, 8, 8);
        this.images['floor_dark'] = floorDark;

        const wall = this.createCanvas(16, 16);
        const ctxW = wall.getContext('2d');
        ctxW.fillStyle = '#FFECB3';
        ctxW.fillRect(0, 0, 16, 16);
        ctxW.fillStyle = '#FFE082';
        ctxW.fillRect(0, 14, 16, 2);
        ctxW.fillStyle = '#FFF';
        ctxW.fillRect(4, 4, 2, 2);
        ctxW.fillRect(10, 8, 2, 2);
        this.images['wall'] = wall;

        const grass = this.createCanvas(16, 16);
        const ctxG = grass.getContext('2d');
        ctxG.fillStyle = '#C8E6C9'; // Light Green base
        ctxG.fillRect(0, 0, 16, 16);
        // Add some grass blades/texture
        ctxG.fillStyle = '#81C784'; // Darker Green
        ctxG.fillRect(2, 4, 2, 2);
        ctxG.fillRect(8, 10, 2, 2);
        ctxG.fillRect(12, 2, 2, 2);
        ctxG.fillRect(4, 12, 2, 2);
        this.images['grass'] = grass;

        // Cute White/Light Wood Fence
        const fence = this.createCanvas(16, 16);
        const ctxFence = fence.getContext('2d');
        // Posts (Rounded tops)
        ctxFence.fillStyle = '#FFF9C4'; // Cream/Light Yellow
        this.drawRoundedRect(ctxFence, 2, 2, 4, 14, 2, '#FFF9C4', null);
        this.drawRoundedRect(ctxFence, 10, 2, 4, 14, 2, '#FFF9C4', null);
        // Rails
        ctxFence.fillStyle = '#FFE0B2'; // Light Orange/Wood
        ctxFence.fillRect(0, 5, 16, 3);
        ctxFence.fillRect(0, 11, 16, 3);
        // Highlights
        ctxFence.fillStyle = '#FFFFFF';
        ctxFence.fillRect(3, 3, 1, 4);
        ctxFence.fillRect(11, 3, 1, 4);
        this.images['fence'] = fence;

        // Cute Hanging Sign
        const sign = this.createCanvas(32, 32);
        const ctxSign = sign.getContext('2d');

        // Post
        ctxSign.fillStyle = '#8D6E63'; // Dark Wood
        ctxSign.fillRect(14, 12, 4, 20);

        // Sign Board (Hanging)
        ctxSign.fillStyle = '#FFCCBC'; // Pastel Pink/Orange
        this.drawRoundedRect(ctxSign, 2, 2, 28, 18, 4, '#FFCCBC', '#8D6E63');

        // Strings holding the board
        ctxSign.strokeStyle = '#5D4037';
        ctxSign.lineWidth = 0.25;
        ctxSign.beginPath();
        ctxSign.moveTo(8, 2); ctxSign.lineTo(8, 0);
        ctxSign.moveTo(24, 2); ctxSign.lineTo(24, 0);
        ctxSign.stroke();

        // Icon: Lock (🔒) instead of text
        const cx = 16;
        const cy = 11;
        // Lock Body
        ctxSign.fillStyle = '#FFAB91'; // Darker Pink
        this.drawRoundedRect(ctxSign, cx - 5, cy - 3, 10, 8, 2, '#FFAB91', null);
        // Lock Shackle
        ctxSign.strokeStyle = '#5D4037';
        ctxSign.lineWidth = 0.5;
        ctxSign.beginPath();
        ctxSign.arc(cx, cy - 3, 3, Math.PI, 0);
        ctxSign.stroke();
        // Keyhole
        ctxSign.fillStyle = '#5D4037';
        ctxSign.beginPath(); ctxSign.arc(cx, cy + 1, 1.5, 0, Math.PI * 2); ctxSign.fill();

        this.images['sign'] = sign;
    }

    generateFurniture() {
        // 1. Rack (32x16) - Clothing Rack
        const rack = this.createCanvas(32, 16);
        const ctxR = rack.getContext('2d');

        // Floor shadow
        ctxR.fillStyle = 'rgba(0,0,0,0.1)';
        ctxR.beginPath(); ctxR.ellipse(16, 14, 14, 3, 0, 0, Math.PI * 2); ctxR.fill();

        // Side poles
        ctxR.strokeStyle = '#90A4AE'; // Metal Grey
        ctxR.lineWidth = 0.5;
        ctxR.beginPath();
        ctxR.moveTo(4, 16); ctxR.lineTo(4, 2); // Left pole
        ctxR.moveTo(28, 16); ctxR.lineTo(28, 2); // Right pole
        ctxR.stroke();

        // Top bar
        ctxR.beginPath();
        ctxR.moveTo(4, 4); ctxR.lineTo(28, 4);
        ctxR.stroke();

        // Clothes hanging
        const colors = [this.colors.clothes.pink, this.colors.clothes.blue, this.colors.clothes.yellow, this.colors.clothes.green];
        colors.forEach((color, i) => {
            const x = 7 + i * 6;
            // Hanger hook
            ctxR.strokeStyle = '#CFD8DC';
            ctxR.lineWidth = 0.25;
            ctxR.beginPath();
            ctxR.moveTo(x + 2, 4);
            ctxR.lineTo(x + 2, 2);
            ctxR.stroke();

            // Shirt body
            ctxR.fillStyle = color;
            ctxR.fillRect(x, 5, 5, 9);

            // Sleeves (simple diagonal)
            ctxR.beginPath();
            ctxR.moveTo(x, 5); ctxR.lineTo(x - 1, 7);
            ctxR.moveTo(x + 5, 5); ctxR.lineTo(x + 6, 7);
            ctxR.strokeStyle = color;
            ctxR.lineWidth = 0.25;
            ctxR.stroke();
        });
        this.images['rack'] = rack;

        // 2. Shelf (32x16) - Display Table/Shelf
        const shelf = this.createCanvas(32, 16);
        const ctxS = shelf.getContext('2d');

        // Wood structure
        ctxS.fillStyle = '#8D6E63'; // Dark Wood
        ctxS.fillRect(2, 6, 28, 10); // Base
        ctxS.fillStyle = '#A1887F'; // Top surface
        ctxS.fillRect(0, 4, 32, 4); // Table top

        // Folded clothes stacks
        const stackColors = [
            ['#F8BBD0', '#F48FB1'], // Pinks
            ['#B3E5FC', '#81D4FA'], // Blues
            ['#C8E6C9', '#A5D6A7']  // Greens
        ];

        stackColors.forEach((cols, i) => {
            const x = 4 + i * 9;
            const y = 4;
            // Bottom item
            ctxS.fillStyle = cols[1];
            ctxS.fillRect(x, y - 2, 6, 2);
            // Top item
            ctxS.fillStyle = cols[0];
            ctxS.fillRect(x, y - 4, 6, 2);
        });
        this.images['shelf'] = shelf;

        // 3. Counter (16x32) - Cash Register
        const counter = this.createCanvas(16, 32);
        const ctxC = counter.getContext('2d');

        // Wood texture
        ctxC.fillStyle = '#8D6E63'; // Darker wood
        ctxC.fillRect(0, 0, 16, 32);
        ctxC.fillStyle = '#D7CCC8'; // Lighter wood top/highlight
        ctxC.fillRect(1, 1, 14, 30);

        // Counter top surface line
        ctxC.fillStyle = '#A1887F';
        ctxC.fillRect(0, 10, 16, 2);

        // Cash Register (Top half)
        ctxC.fillStyle = '#CFD8DC'; // Silver machine
        ctxC.fillRect(2, 2, 12, 8);
        // Screen
        ctxC.fillStyle = '#263238'; // Dark screen
        ctxC.fillRect(3, 3, 10, 3);
        // Buttons
        ctxC.fillStyle = '#EF5350'; // Red button
        ctxC.fillRect(3, 7, 2, 2);
        ctxC.fillStyle = '#66BB6A'; // Green button
        ctxC.fillRect(6, 7, 2, 2);
        ctxC.fillStyle = '#FFEE58'; // Yellow button
        ctxC.fillRect(9, 7, 2, 2);

        this.images['counter'] = counter;

        // 4. Fitting Room (32x32)
        const fittingRoom = this.createCanvas(32, 32);
        const ctxF = fittingRoom.getContext('2d');

        // Frame
        ctxF.fillStyle = '#5D4037'; // Dark wood frame
        ctxF.fillRect(0, 0, 32, 32);

        // Interior (Dark)
        ctxF.fillStyle = '#3E2723';
        ctxF.fillRect(2, 2, 28, 30);

        // Curtain Rod
        ctxF.strokeStyle = '#FFD54F'; // Gold rod
        ctxF.lineWidth = 0.5;
        ctxF.beginPath();
        ctxF.moveTo(2, 6);
        ctxF.lineTo(30, 6);
        ctxF.stroke();

        // Curtain
        ctxF.fillStyle = '#EF5350'; // Red curtain

        // Left curtain panel
        ctxF.beginPath();
        ctxF.moveTo(2, 6);
        ctxF.lineTo(14, 6);
        ctxF.quadraticCurveTo(16, 20, 10, 30);
        ctxF.lineTo(2, 30);
        ctxF.fill();

        // Right curtain panel
        ctxF.beginPath();
        ctxF.moveTo(30, 6);
        ctxF.lineTo(18, 6);
        ctxF.quadraticCurveTo(16, 20, 22, 30);
        ctxF.lineTo(30, 30);
        ctxF.fill();

        // Curtain folds/shadows
        ctxF.strokeStyle = '#B71C1C';
        ctxF.lineWidth = 0.25;
        ctxF.beginPath();
        ctxF.moveTo(8, 6); ctxF.quadraticCurveTo(10, 18, 6, 30);
        ctxF.moveTo(24, 6); ctxF.quadraticCurveTo(22, 18, 26, 30);
        ctxF.stroke();

        this.images['fitting_room'] = fittingRoom;

        // 5. Break Room (32x32)
        const breakRoom = this.createCanvas(32, 32);
        const ctxB = breakRoom.getContext('2d');

        // Floor
        ctxB.fillStyle = '#D7CCC8';
        ctxB.fillRect(0, 0, 32, 32);

        // Sofa
        ctxB.fillStyle = '#8D6E63';
        this.drawRoundedRect(ctxB, 4, 16, 24, 12, 4, '#8D6E63', null);
        ctxB.fillStyle = '#A1887F'; // Cushions
        ctxB.fillRect(6, 18, 10, 8);
        ctxB.fillRect(16, 18, 10, 8);

        // Coffee Table
        ctxB.fillStyle = '#5D4037';
        ctxB.fillRect(10, 8, 12, 6);

        // Coffee Cup
        ctxB.fillStyle = '#FFF';
        ctxB.beginPath(); ctxB.arc(16, 10, 2, 0, Math.PI * 2); ctxB.fill();
        ctxB.strokeStyle = '#6D4C41'; // Coffee
        ctxB.lineWidth = 0.25;
        ctxB.beginPath(); ctxB.arc(16, 10, 1, 0, Math.PI * 2); ctxB.stroke();

        this.images['break_room'] = breakRoom;
    }

    generateCharacters() {
        this.images['employee'] = this.createChibiSet('employee');
        this.images['customer_student'] = this.createChibiSet('customer_student');
        this.images['customer_worker'] = this.createChibiSet('customer_worker');
    }

    createChibiSet(type) {
        const frames = [];
        // Directions: 0=Down, 1=Left, 2=Right, 3=Up
        for (let d = 0; d < 4; d++) {
            for (let i = 0; i < 4; i++) {
                const canvas = this.createCanvas(32, 32);
                const ctx = canvas.getContext('2d');
                this.drawChibi(ctx, type, i, d);

                // Key format: type_direction_frame (keep original type name)
                const key = `${type}_${d}_${i}`;
                this.images[key] = canvas;

                frames.push(canvas);
            }
        }
        return frames;
    }
    drawChibi(ctx, type, frame, direction) {
        const centerX = 16;
        const groundY = 28;
        const bodyY = groundY - 10;

        // Bounce for walking effect (Up/Down movement)
        const bounce = (frame === 1 || frame === 3) ? -1 : 0;
        const drawY = bodyY + bounce;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(centerX, groundY, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Body ---
        if (type === 'employee') {
            ctx.fillStyle = '#FFE0B2'; // Skin
            // Shirt
            this.drawRoundedRect(ctx, centerX - 6, drawY, 12, 10, 4, '#FFCCBC', null);
            // White apron/detail
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(centerX, drawY + 4, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Student
            ctx.fillStyle = '#3949AB'; // Pants/Skirt
            this.drawRoundedRect(ctx, centerX - 6, drawY + 4, 12, 6, 2, '#3949AB', null);
            ctx.fillStyle = '#FFF'; // Shirt
            this.drawRoundedRect(ctx, centerX - 6, drawY, 12, 6, 2, '#FFF', null);
            ctx.fillStyle = '#E53935'; // Tie
            ctx.beginPath(); ctx.arc(centerX, drawY + 2, 2, 0, Math.PI * 2); ctx.fill();
        }

        // --- Legs Animation (Draw AFTER body to ensure visibility) ---
        ctx.fillStyle = '#3E2723'; // Dark shoes
        const footY = groundY; // Feet on ground

        // Default feet position (Idle)
        let leftFootX = centerX - 3;
        let rightFootX = centerX + 3;
        let leftFootOffset = 0;
        let rightFootOffset = 0;

        // Animation Logic
        if (direction === 1) { // Left
            // Walking Left
            if (frame === 1) {
                // Step 1: Left foot forward (left), Right foot back (right)
                leftFootX = centerX - 6;
                rightFootX = centerX + 2;
                leftFootOffset = -2; // Lift
            } else if (frame === 3) {
                // Step 2: Left foot back, Right foot forward
                leftFootX = centerX;
                rightFootX = centerX - 4;
                rightFootOffset = -2; // Lift
            }
        } else if (direction === 2) { // Right
            // Walking Right
            if (frame === 1) {
                // Step 1: Right foot forward (right), Left foot back (left)
                rightFootX = centerX + 6;
                leftFootX = centerX - 2;
                rightFootOffset = -2;
            } else if (frame === 3) {
                // Step 2: Right foot back, Left foot forward
                rightFootX = centerX;
                leftFootX = centerX + 4;
                leftFootOffset = -2;
            }
        } else {
            // Down/Up - Simple marching
            if (frame === 1) { leftFootOffset = -3; }
            if (frame === 3) { rightFootOffset = -3; }
        }

        // Draw Feet
        ctx.beginPath(); ctx.arc(leftFootX, footY + leftFootOffset, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rightFootX, footY + rightFootOffset, 3, 0, Math.PI * 2); ctx.fill();


        // --- Head ---
        const headY = drawY - 12;
        const headSize = 14;

        // Back Hair (behind head)
        ctx.fillStyle = type === 'employee' ? this.colors.hair.brown : this.colors.hair.black;
        ctx.beginPath();
        ctx.arc(centerX, headY, headSize + 1, 0, Math.PI * 2);
        ctx.fill();

        // Face (Skin)
        if (direction !== 3) { // Not Up (Back view)
            ctx.fillStyle = this.colors.skin;
            ctx.beginPath();
            ctx.arc(centerX, headY + 1, headSize, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Back of head (Full hair)
            ctx.fillStyle = type === 'employee' ? this.colors.hair.brown : this.colors.hair.black;
            ctx.beginPath();
            ctx.arc(centerX, headY + 1, headSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Front Hair (Bangs)
        if (direction !== 3) {
            ctx.fillStyle = type === 'employee' ? this.colors.hair.brown : this.colors.hair.black;
            ctx.beginPath();
            ctx.arc(centerX, headY - 2, headSize, Math.PI, 0);
            ctx.fill();
        }

        // --- Face Details ---
        if (direction !== 3) { // Not Back view
            const eyeY = headY + 4;
            let eyeXOffset = 0;

            if (direction === 1) eyeXOffset = -3; // Look Left
            if (direction === 2) eyeXOffset = 3;  // Look Right

            const eyeX = 5;

            // Eyes
            ctx.fillStyle = '#5D4037';
            ctx.beginPath(); ctx.arc(centerX - eyeX + eyeXOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(centerX + eyeX + eyeXOffset, eyeY, 2, 0, Math.PI * 2); ctx.fill();

            // Blush
            ctx.fillStyle = 'rgba(255, 171, 145, 0.6)';
            ctx.beginPath(); ctx.arc(centerX - eyeX - 2 + eyeXOffset, eyeY + 3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(centerX + eyeX + 2 + eyeXOffset, eyeY + 3, 2, 0, Math.PI * 2); ctx.fill();

            // Mouth
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 0.25;
            ctx.beginPath();
            ctx.arc(centerX + eyeXOffset, eyeY + 2, 2, 0, Math.PI);
            ctx.stroke();
        }

        // Employee Hat/Accessory
        if (type === 'employee' && direction !== 3) {
            ctx.fillStyle = '#EF5350';
            this.drawHeart(ctx, centerX + 8, headY - 8, 4);
        }
    }

    generateIcons() {
        const coin = this.createCanvas(16, 16);
        const ctx = coin.getContext('2d');
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 8, 9);
        this.images['icon_coin'] = coin;
    }

    drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            // Default line width is now 0.25 from createCanvas, but we can override if passed
            ctx.stroke();
        }
    }

    drawHeart(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size / 4);
        ctx.quadraticCurveTo(x, y, x + size / 2, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + size / 2);
        ctx.quadraticCurveTo(x + size, y + size, x, y + size * 1.5);
        ctx.quadraticCurveTo(x - size, y + size, x - size, y + size / 2);
        ctx.quadraticCurveTo(x - size, y, x - size / 2, y);
        ctx.quadraticCurveTo(x, y, x, y + size / 4);
        ctx.fill();
    }

    get(name) {
        return this.images[name];
    }
}


// --- src/model/Inventory.js ---
class Inventory {
    constructor() {
        this.items = [];
    }

    init() {
        this.items = [
            // Common
            { id: 'tshirt', name: '短袖T恤', quantity: 10, cost: 10, price: 30, type: 'top', tags: ['cool', 'common'] },
            { id: 'jeans', name: '牛仔长裤', quantity: 8, cost: 15, price: 45, type: 'bottom', tags: ['common'] },
            { id: 'shirt', name: '普通衬衫', quantity: 8, cost: 12, price: 35, type: 'top', tags: ['common'] },
            { id: 'bag', name: '帆布包', quantity: 5, cost: 8, price: 25, type: 'accessory', tags: ['common'] },

            // Rain
            { id: 'umbrella', name: '雨伞', quantity: 5, cost: 15, price: 40, type: 'accessory', tags: ['rain'] },
            { id: 'raincoat', name: '雨衣', quantity: 5, cost: 20, price: 60, type: 'top', tags: ['rain'] },
            { id: 'boots', name: '防水靴', quantity: 5, cost: 25, price: 70, type: 'shoes', tags: ['rain'] },

            // Warm (Winter/Autumn)
            { id: 'down_jacket', name: '羽绒服', quantity: 5, cost: 50, price: 150, type: 'top', tags: ['warm'] },
            { id: 'scarf', name: '围巾', quantity: 5, cost: 10, price: 30, type: 'accessory', tags: ['warm'] },
            { id: 'sweater', name: '厚毛衣', quantity: 5, cost: 25, price: 80, type: 'top', tags: ['warm'] },

            // Cool (Summer)
            { id: 'sandals', name: '凉鞋', quantity: 5, cost: 12, price: 35, type: 'shoes', tags: ['cool'] },
            { id: 'sunhat', name: '遮阳帽', quantity: 5, cost: 10, price: 30, type: 'accessory', tags: ['cool'] }
        ];
    }

    removeItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item && item.quantity > 0) {
            item.quantity--;
            return true;
        }
        return false;
    }

    hasStock(itemId) {
        const item = this.items.find(i => i.id === itemId);
        return item && item.quantity > 0;
    }

    getItemsByTag(tag) {
        return this.items.filter(i => i.tags && i.tags.includes(tag));
    }
}


// --- src/model/Shop.js ---


class Shop {
    constructor() {
        this.money = 500;
        this.reputation = 0; // 0-500
        this.traffic = 0;
        this.inventory = new Inventory();
        this.facilities = [];
        this.map = {
            width: 15,
            height: 10,
            tiles: [] // 0: light, 1: wall, 2: grass
        };
        this.unlockedRegions = [0]; // Start with region 0 unlocked

        this.level = 1;
        this.upgradeCost = 1000;
        this.pendingOrders = [];
    }

    processOrders() {
        let arrived = 0;
        this.pendingOrders.forEach(order => {
            const item = this.inventory.items.find(i => i.id === order.itemId);
            if (item) {
                item.quantity += order.quantity;
                arrived += order.quantity;
            }
        });
        this.pendingOrders = [];
        return arrived;
    }

    upgrade() {
        if (this.money >= this.upgradeCost) {
            this.money -= this.upgradeCost;
            this.level++;
            this.reputation += 100;
            this.upgradeCost *= 2;

            // Unlock next region
            if (this.level <= 7) {
                this.unlockedRegions.push(this.level - 1);
                this.initMap(); // Re-init map to update tiles
            }
            return true;
        }
        return false;
    }

    init() {
        this.initMap();
        this.initFacilities();
        this.inventory.init();
    }

    initMap() {
        // 15x10 tiles
        this.map.width = 15;
        this.map.height = 10;

        // 0: Floor, 1: Wall, 2: Grass (Locked)
        this.map.tiles = []; // Reset tiles
        for (let y = 0; y < this.map.height; y++) {
            const row = [];
            for (let x = 0; x < this.map.width; x++) {
                const region = this.getRegion(x, y);
                if (this.unlockedRegions.includes(region)) {
                    row.push(0); // Floor
                } else {
                    row.push(2); // Grass (Locked)
                }
            }
            this.map.tiles.push(row);
        }
    }

    getRegion(x, y) {
        // Region 0: X 0-9, Y 5-9 (10x5) - Start Area
        if (x <= 9 && y >= 5) return 0;

        // Top Row: Y 0-4
        if (y <= 4) {
            if (x <= 3) return 1; // Region 1
            if (x <= 6) return 2; // Region 2
            if (x <= 9) return 3; // Region 3
            return 4;             // Region 4 (Top Right)
        }

        // Right Column: X 10-14, Y 5-9
        if (x >= 10 && y >= 5) {
            if (y <= 6) return 5; // Region 5
            return 6;             // Region 6
        }

        return -1; // Should not happen
    }

    initFacilities() {
        // Facilities must be in Region 0 (X:0-9, Y:5-9) -> Pixel Y: 80-144

        // Break Room (32x32) - Top-Left of Region 0
        this.facilities.push({ type: 'break_room', x: 0, y: 80, width: 32, height: 32 });

        // Counter (32x32) - Below Break Room
        this.facilities.push({ type: 'counter', x: 0, y: 112, width: 32, height: 32 });

        // Rack 1 (32x16) - T-Shirts
        this.facilities.push({
            type: 'rack', x: 48, y: 80, width: 32, height: 16,
            itemType: 'tshirt', capacity: 10, currentStock: 10
        });

        // Rack 2 (32x16) - Jeans
        this.facilities.push({
            type: 'rack', x: 80, y: 80, width: 32, height: 16,
            itemType: 'jeans', capacity: 10, currentStock: 10
        });

        // Shelf (32x16) - Bags
        this.facilities.push({
            type: 'shelf', x: 112, y: 80, width: 32, height: 16,
            itemType: 'bag', capacity: 15, currentStock: 10
        });

        // Fitting Room (32x32) - Bottom-Right of Region 0
        this.facilities.push({ type: 'fitting_room', x: 128, y: 112, width: 32, height: 32 });
    }

    restockRack(rack) {
        if (!rack.itemType) return 0;

        const item = this.inventory.items.find(i => i.id === rack.itemType);
        if (!item || item.quantity <= 0) return 0;

        const needed = (rack.capacity || 10) - (rack.currentStock || 0);
        if (needed <= 0) return 0;

        const toRestock = Math.min(needed, item.quantity);

        rack.currentStock = (rack.currentStock || 0) + toRestock;
        item.quantity -= toRestock;
        return toRestock;
    }
}


// --- src/model/Employee.js ---


class Employee {
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


// --- src/model/Customer.js ---


const CUSTOMER_TYPES = {
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

class Customer {
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


// --- src/model/GameState.js ---




class GameState {
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


// --- src/core/Loop.js ---
class Loop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;

        this.lastTime = 0;
        this.accumulator = 0;
        this.step = 1 / 60; // Fixed time step 60fps
        this.rafId = null;
    }

    start() {
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.frame.bind(this));
    }

    stop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    frame(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to prevent spiral of death if tab is inactive
        const safeDelta = Math.min(deltaTime, 0.1);

        this.accumulator += safeDelta;

        while (this.accumulator >= this.step) {
            this.updateFn(this.step);
            this.accumulator -= this.step;
        }

        this.renderFn();

        this.rafId = requestAnimationFrame(this.frame.bind(this));
    }
}


// --- src/core/Input.js ---
class Input {
    constructor(game) {
        this.game = game;
        this.mouse = { x: 0, y: 0, isDown: false };
    }

    init() {
        const canvas = this.game.canvas;

        // Mouse Events
        window.addEventListener('mousemove', (e) => {
            this.updateMousePos(e.clientX, e.clientY);
            if (this.game.state && this.game.state.handleMouseMove) {
                this.game.state.handleMouseMove(this.mouse.x, this.mouse.y);
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            this.updateMousePos(e.clientX, e.clientY);
            if (this.game.state && this.game.state.handleMouseDown) {
                this.game.state.handleMouseDown(this.mouse.x, this.mouse.y);
            }
        });

        window.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
            if (this.game.state && this.game.state.handleMouseUp) {
                this.game.state.handleMouseUp();
            }
        });

        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.mouse.isDown = true;
                this.updateMousePos(touch.clientX, touch.clientY);
                if (this.game.state && this.game.state.handleMouseDown) {
                    this.game.state.handleMouseDown(this.mouse.x, this.mouse.y);
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.updateMousePos(touch.clientX, touch.clientY);
                if (this.game.state && this.game.state.handleMouseMove) {
                    this.game.state.handleMouseMove(this.mouse.x, this.mouse.y);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            this.mouse.isDown = false;
            if (this.game.state && this.game.state.handleMouseUp) {
                this.game.state.handleMouseUp();
            }
        });
    }

    updateMousePos(clientX, clientY) {
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Convert to Logical Coordinates (160x128)
        const logicalScale = this.game.config.scale;
        this.mouse.x = ((clientX - rect.left) * scaleX) / logicalScale;
        this.mouse.y = ((clientY - rect.top) * scaleY) / logicalScale;
    }

    handleCanvasClick() {
        // Deprecated, logic moved to handleMouseDown
    }
}


// --- src/view/UI.js ---
class UIManager {
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


// --- src/view/Renderer.js ---


class Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        this.assets = new Assets();
    }

    async init() {
        await this.assets.init();
    }

    render(state) {
        if (!state.shop) return;

        try {
            this.ctx.save();

            // 1. Render Floor
            this.renderMap(state.shop.map);

            // 2. Render Furniture (including counter)
            state.shop.facilities.forEach(facility => {
                this.renderEntity(facility);
            });

            // 3. Render Characters
            // Sort by Y to handle depth
            const characters = [...state.customers, ...state.employees];
            characters.sort((a, b) => a.y - b.y);

            characters.forEach(char => {
                this.renderEntity(char);
            });

            // 5. Render Effects
            if (this.game.effects) {
                this.renderEffects(this.game.effects);
            }

            // 6. Render Edit Mode Overlays
            if (state.mode === 'EDIT') {
                this.renderGrid(state.shop.map);
                this.renderHighlights(state);
            }

            // 6. Render Night Overlay (Evening Phase)
            if (state.phase === 'EVENING') {
                this.renderNightOverlay();
            }

            this.ctx.restore();
        } catch (error) {
            console.error('❌ Render error:', error);
            console.error('Stack:', error.stack);
        }
    }

    renderGrid(map) {
        const tileSize = this.game.config.tileSize;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();

        for (let x = 0; x <= map.width; x++) {
            this.ctx.moveTo(x * tileSize, 0);
            this.ctx.lineTo(x * tileSize, map.height * tileSize);
        }

        for (let y = 0; y <= map.height; y++) {
            this.ctx.moveTo(0, y * tileSize);
            this.ctx.lineTo(map.width * tileSize, y * tileSize);
        }

        this.ctx.stroke();
    }

    renderHighlights(state) {
        if (state.selectedFurniture) {
            const f = state.selectedFurniture;
            const isValid = f.isValid !== false; // Default to true if undefined

            if (isValid) {
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // Green highlight
                this.ctx.strokeStyle = '#00FF00';
            } else {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Red highlight
                this.ctx.strokeStyle = '#FF0000';
            }

            this.ctx.fillRect(f.x, f.y, f.width, f.height);
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(f.x, f.y, f.width, f.height);
        }
    }

    renderMap(map) {
        const tileSize = this.game.config.tileSize;
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tileType = map.tiles[y][x];
                let img;
                if (tileType === 1) {
                    img = this.assets.get('wall');
                } else if (tileType === 2) {
                    img = this.assets.get('grass');
                } else {
                    img = this.assets.get('floor_light');
                }

                if (img) {
                    // Force draw to tileSize (16x16) to allow high-res textures
                    this.ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
                }

                // Render Fences for Grass tiles adjacent to Floor/Wall
                if (tileType === 2) {
                    this.renderFence(map, x, y, tileSize);
                }
            }
        }

        // Render Signs for Locked Regions
        this.renderLockedSigns(map);
    }

    renderFence(map, x, y, tileSize) {
        const fenceImg = this.assets.get('fence');
        if (!fenceImg) return;

        // Check neighbors (Up, Down, Left, Right)
        // If neighbor is NOT grass (i.e. unlocked), draw fence on that side
        const neighbors = [
            { dx: 0, dy: -1, side: 'top' },
            { dx: 0, dy: 1, side: 'bottom' },
            { dx: -1, dy: 0, side: 'left' },
            { dx: 1, dy: 0, side: 'right' }
        ];

        neighbors.forEach(n => {
            const nx = x + n.dx;
            const ny = y + n.dy;

            // Check bounds
            if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
                const neighborType = map.tiles[ny][nx];
                if (neighborType !== 2) {
                    // Neighbor is unlocked (Floor or Wall), draw fence
                    this.ctx.save();
                    this.ctx.translate(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2);

                    if (n.side === 'top') {
                        // Default orientation is horizontal
                        this.ctx.drawImage(fenceImg, -8, -8 - 6, 16, 16); // Shift up
                    } else if (n.side === 'bottom') {
                        this.ctx.drawImage(fenceImg, -8, -8 + 6, 16, 16); // Shift down
                    } else if (n.side === 'left') {
                        this.ctx.rotate(Math.PI / 2);
                        this.ctx.drawImage(fenceImg, -8, -8 - 6, 16, 16);
                    } else if (n.side === 'right') {
                        this.ctx.rotate(Math.PI / 2);
                        this.ctx.drawImage(fenceImg, -8, -8 + 6, 16, 16);
                    }
                    this.ctx.restore();
                }
            }
        });
    }

    renderLockedSigns(map) {
        const signImg = this.assets.get('sign');
        if (!signImg) return;

        // Hardcoded centers for regions 1-6
        // Region 1: (0-3, 0-4) -> Center (1.5, 2)
        // Region 2: (4-6, 0-4) -> Center (5, 2)
        // Region 3: (7-9, 0-4) -> Center (8, 2)
        // Region 4: (10-14, 0-4) -> Center (12, 2)
        // Region 5: (10-14, 5-6) -> Center (12, 5.5)
        // Region 6: (10-14, 7-9) -> Center (12, 8)

        const regions = [
            { id: 1, x: 1.5, y: 2 },
            { id: 2, x: 5, y: 2 },
            { id: 3, x: 8, y: 2 },
            { id: 4, x: 12, y: 2 },
            { id: 5, x: 12, y: 5.5 },
            { id: 6, x: 12, y: 8 }
        ];

        const unlocked = this.game.state.shop.unlockedRegions;

        regions.forEach(r => {
            if (!unlocked.includes(r.id)) {
                const drawX = r.x * 16 - 16; // Center - half width
                const drawY = r.y * 16 - 16; // Center - half height
                this.ctx.drawImage(signImg, drawX, drawY, 32, 32);
            }
        });
    }

    renderEntity(entity) {
        if (entity.isVisible === false) return;

        // Check if it's a character (employee or any customer type)
        if (entity.type === 'employee' || entity.type.startsWith('customer_')) {
            // 动态渲染 - 使用精灵图或预生成的帧
            let frame = 0;

            if (entity.isMoving) {
                // 4帧行走循环: 0 -> 1 -> 2 -> 3
                frame = Math.floor(Date.now() / 150) % 4;
            } else {
                // 空闲呼吸: 0 -> 2
                const idleFrame = Math.floor(Date.now() / 800) % 2;
                frame = idleFrame === 0 ? 0 : 2;
            }

            // 获取方向 (默认为0=向下)
            const direction = entity.direction || 0;

            // 使用 entity.type (如 'customer_student', 'employee') 直接查找
            // Key format: type_direction_frame
            const imageName = `${entity.type}_${direction}_${frame}`;
            const imgData = this.assets.get(imageName);

            if (imgData) {
                // 检查是否是精灵图引用
                if (imgData.spriteSheet) {
                    // 从精灵图中绘制并缩放
                    const spriteSheet = this.assets.get(imgData.spriteSheet);
                    if (spriteSheet && spriteSheet.image) {
                        const { image, frameWidth, frameHeight } = spriteSheet;

                        // 计算源矩形 (从精灵图中裁剪)
                        const srcX = frame * frameWidth;
                        const srcY = direction * frameHeight;

                        // 动态计算目标尺寸，保持宽高比
                        // 固定高度为 24 (缩小人物以匹配家具比例)
                        const targetHeight = 24;
                        // 根据宽高比计算宽度
                        const aspectRatio = frameWidth / frameHeight;
                        const targetWidth = Math.floor(targetHeight * aspectRatio);

                        // 计算目标位置 (底部中心对齐到实体位置)
                        const drawX = Math.floor(entity.x + 8 - targetWidth / 2);
                        const drawY = Math.floor(entity.y + 16 - targetHeight);

                        this.ctx.drawImage(
                            image,
                            srcX, srcY, frameWidth, frameHeight,  // 源矩形
                            drawX, drawY, targetWidth, targetHeight  // 目标矩形(缩放)
                        );
                    } else {
                        this.drawFallback(entity);
                    }
                } else {
                    // 程序生成的 canvas
                    const drawX = Math.floor(entity.x + 8 - 16);
                    const drawY = Math.floor(entity.y + 16 - 32);
                    this.ctx.drawImage(imgData, drawX, drawY);
                }
            } else {
                this.drawFallback(entity);
            }
        } else {
            // Static entity (furniture)
            const img = this.assets.get(entity.type);
            if (img) {
                // Enable smoothing for better quality on high-res assets
                this.ctx.imageSmoothingEnabled = true;

                let renderHeight;

                // Special handling: Stretch to fill 32x32 for fitting_room, break_room, and counter
                if (entity.type === 'fitting_room' || entity.type === 'break_room' || entity.type === 'counter') {
                    renderHeight = entity.height;
                } else {
                    // Standard behavior: Maintain aspect ratio
                    const aspectRatio = img.height / img.width;
                    renderHeight = entity.width * aspectRatio;
                }

                // Bottom align: Draw Y = Entity Bottom Y - Render Height
                const drawY = (entity.y + entity.height) - renderHeight;

                this.ctx.drawImage(img, entity.x, drawY, entity.width, renderHeight);

                // Disable smoothing back for pixel art
                this.ctx.imageSmoothingEnabled = false;
            } else {
                this.drawFallback(entity);
            }
        }
    }

    drawFallback(entity) {
        // 后备渲染
        this.ctx.fillStyle = entity.type === 'employee' ? '#42A5F5' : '#EF5350';
        this.ctx.fillRect(Math.floor(entity.x), Math.floor(entity.y), 16, 16);
    }

    renderEffects(effects) {
        effects.forEach(e => {
            if (e.type === 'bubble') {
                this.drawBubble(e);
            } else if (e.type === 'floating_text') {
                this.drawFloatingText(e.x, e.y, e.text, e.color);
            }
        });
    }

    drawBubble(effect) {
        const { x, y, text, life, maxLife } = effect;
        const ctx = this.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = true; // Smooth bubbles

        // --- Animation ---
        let scale = 1;
        let alpha = 1;
        const progress = 1 - (life / maxLife);

        if (progress < 0.1) {
            scale = progress / 0.1;
        } else if (life < 0.2) {
            alpha = life / 0.2;
            scale = 0.8 + (0.2 * alpha);
        }

        ctx.globalAlpha = alpha;

        // --- Layout ---
        ctx.font = 'bold 10px "Microsoft YaHei", sans-serif'; // Smaller font
        const padding = 4;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 16; // Reduced height

        // Anchor point: centered horizontally, above head
        const anchorX = Math.floor(x + 8); // Center of 16px tile
        const anchorY = Math.floor(y - 12); // Closer to head

        ctx.translate(anchorX, anchorY);
        ctx.scale(scale, scale);
        ctx.translate(-anchorX, -anchorY);

        const boxX = anchorX - boxWidth / 2;
        const boxY = anchorY - boxHeight;

        // --- Colors ---
        const bgColor = '#FFF9C4';   // Light Yellow
        const borderColor = '#FFF'; // White

        // --- Draw Bubble (Super Rounded) ---
        const r = 6; // Smaller radius

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        this.drawRoundedRect(ctx, boxX + 1, boxY + 1, boxWidth, boxHeight, r);
        ctx.fill();

        // Background
        ctx.fillStyle = bgColor;
        this.drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, r);
        ctx.fill();

        // Border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // Tail (Rounded Triangle)
        ctx.beginPath();
        ctx.moveTo(anchorX - 3, boxY + boxHeight - 1);
        ctx.quadraticCurveTo(anchorX, boxY + boxHeight + 4, anchorX + 3, boxY + boxHeight - 1);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.stroke();
        // Cover overlap
        ctx.fillStyle = bgColor;
        ctx.fillRect(anchorX - 2, boxY + boxHeight - 2, 4, 3);

        // --- Text ---
        ctx.fillStyle = '#5D4037'; // Dark Brown
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Adjust text Y position slightly
        ctx.fillText(text, anchorX, boxY + boxHeight / 2 + 1);

        ctx.restore();
    }

    drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    drawFloatingText(x, y, text, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = true; // Smooth text
        ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = color || '#FFD54F';
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1.5;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    renderNightOverlay() {
        // Darken the entire canvas for night time
        this.ctx.fillStyle = 'rgba(0, 0, 20, 0.6)'; // Dark blue overlay
        this.ctx.fillRect(0, 0, this.game.config.width, this.game.config.height);
    }
}


// --- src/core/Game.js ---






class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Fixed Logical Resolution (Retro Game Boy Advance style)
        const logicalWidth = 240;
        const logicalHeight = 160;

        this.config = {
            tileSize: 16,
            width: logicalWidth,
            height: logicalHeight,
            scale: 1 // Placeholder, updated in handleResize
        };

        // Handle Resize
        window.addEventListener('resize', () => this.handleResize());

        // Initial Resize
        this.handleResize();

        // Systems
        this.state = new GameState(this);
        this.renderer = new Renderer(this);
        this.ui = new UIManager(this);
        this.input = new Input(this);
        this.loop = new Loop(this.update.bind(this), this.render.bind(this));

        this.effects = []; // Visual effects
        this.selectedEntity = null; // Currently selected entity (e.g. employee)
        this.isRunning = false;
    }

    handleResize() {
        // Calculate scale to fit window while maintaining aspect ratio
        const scaleX = window.innerWidth / this.config.width;
        const scaleY = window.innerHeight / this.config.height;

        // Use the smaller scale to ensure it fits entirely (contain)
        let scale = Math.min(scaleX, scaleY);

        // Ensure minimum scale of 1
        scale = Math.max(scale, 1);

        this.config.scale = scale;

        // Set Canvas Size to the SCALED size
        this.canvas.width = this.config.width * scale;
        this.canvas.height = this.config.height * scale;

        // Scale context so drawing operations use logical coordinates
        this.ctx.scale(scale, scale);

        // Disable smoothing for pixel art look
        this.ctx.imageSmoothingEnabled = false;

        // Force render
        if (!this.isRunning && this.renderer) {
            this.render();
        }
    }

    addEffect(effect) {
        effect.maxLife = effect.life;
        this.effects.push(effect);
    }

    async init() {
        console.log('Game Initializing...');

        // Initialize systems
        this.ui.init();
        this.input.init();
        await this.renderer.init(); // Wait for assets to load

        // Start Loop
        this.loop.start();

        console.log('Game Initialized.');
    }

    startNewGame() {
        console.log('Starting New Game...');
        this.selectedEntity = null; // Ensure no selection on start
        this.state.initNewGame();
        this.ui.showScreen('hud');
        this.ui.showDialog("欢迎成为「街角衣铺」的经理！你将负责店铺整体运营，初始配备 1 名全能店员，一起把小店经营起来吧～");
        this.isRunning = true;
    }

    loadGame(slotId = 1) {
        console.log(`Loading Game from slot ${slotId}...`);
        this.selectedEntity = null; // Ensure no selection on load
        if (this.state.loadGame(slotId)) {
            this.ui.showScreen('hud');
            this.isRunning = true;
        } else {
            alert('没有找到存档！');
        }
    }

    update(dt) {
        if (!this.isRunning || this.isPaused) return;

        // In EDIT mode, we don't update game logic (time, entities), but we still render
        if (this.state.mode === 'EDIT') {
            // Only update effects if needed, or just skip entirely
            return;
        }

        this.state.update(dt);

        // Update Effects
        this.effects.forEach(e => {
            e.life -= dt;
            if (e.update) e.update(dt);
            if (e.type === 'floating_text') {
                e.y -= 10 * dt; // Float up
            }
        });
        this.effects = this.effects.filter(e => e.life > 0);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.ui.togglePauseMenu(this.isPaused);
    }

    render() {
        // Clear screen with light background
        this.ctx.fillStyle = '#f5f5f5';
        this.ctx.fillRect(0, 0, this.config.width, this.config.height);

        if (this.isRunning) {
            this.renderer.render(this.state);
        }
    }
}


// --- main.js ---


window.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.init(); // Wait for assets to load

    // Expose game instance for debugging
    window.game = game;
});

