import Inventory from './Inventory.js';

export default class Shop {
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
