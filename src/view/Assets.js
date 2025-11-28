export default class Assets {
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
