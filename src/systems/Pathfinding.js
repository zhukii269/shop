export class Pathfinding {
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
