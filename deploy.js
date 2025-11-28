const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const assetsDir = path.join(__dirname, 'assets');

// 1. Create dist directory
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// 2. Files to copy
const filesToCopy = [
    'index.html',
    'game.css',
    'game.bundle.js'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file}`);
    } else {
        console.error(`Missing file: ${file}`);
    }
});

// Helper function to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${entry.name}`);
        }
    }
}

// 3. Copy Assets folder
if (fs.existsSync(assetsDir)) {
    const destAssetsDir = path.join(distDir, 'assets');
    copyDir(assetsDir, destAssetsDir);
}

console.log('Deployment build created in /dist folder!');
