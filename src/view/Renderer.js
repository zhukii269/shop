import Assets from './Assets.js';

export default class Renderer {
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
