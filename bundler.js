const fs = require('fs');
const path = require('path');

const files = [
    'src/core/Utils.js',
    'src/systems/Pathfinding.js',
    'src/view/Assets.js',
    'src/model/Inventory.js',
    'src/model/Shop.js',
    'src/model/Employee.js',
    'src/model/Customer.js',
    'src/model/GameState.js',
    'src/core/Loop.js',
    'src/core/Input.js',
    'src/view/UI.js',
    'src/view/Renderer.js',
    'src/core/Game.js',
    'main.js'
];

let bundle = '// Bundled Game Script\n\n';

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Strip imports
        content = content.replace(/import .* from .*/g, '');

        // Strip exports
        content = content.replace(/export default class/g, 'class');
        content = content.replace(/export class/g, 'class');
        content = content.replace(/export const/g, 'const');
        content = content.replace(/export default/g, '');

        bundle += `\n// --- ${file} ---\n`;
        bundle += content;
        bundle += '\n';
    } else {
        console.error(`File not found: ${file}`);
    }
});

fs.writeFileSync(path.join(__dirname, 'game.bundle.js'), bundle);
console.log('Bundle created at game.bundle.js');
