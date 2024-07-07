const express = require('express');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');
const chokidar = require('chokidar');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const ip = require('ip');
const qrcode = require('qrcode');

const app = express();
const liveReloadServer = livereload.createServer();

const PORT = 3000;
const HOST = '0.0.0.0';

// Middleware to inject livereload script into HTML
app.use(connectLivereload());

// Serve static files
const serveFolder = (folder) => {
    app.use(express.static(folder));
};

// Watch for file changes
const watchFolder = (folder) => {
    chokidar.watch(folder).on('change', (filePath) => {
        console.log(`File changed: ${filePath}`);
        liveReloadServer.refresh(filePath);
    });
};

// Generate QR code and save as image
const generateQRCode = async (url) => {
    const qrCodePath = path.resolve(__dirname, 'qrcode.png');
    try {
        await qrcode.toFile(qrCodePath, url, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return qrCodePath;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
};

// Serve QR code image
app.get('/qrcode.png', (req, res) => {
    const qrCodePath = path.resolve(__dirname, 'qrcode.png');
    if (fs.existsSync(qrCodePath)) {
        res.sendFile(qrCodePath);
    } else {
        res.status(404).send('QR code not found');
    }
});

// Start the server
const startServer = async (folder) => {
    const { default: open } = await import('open'); // Dynamic import for ESM module

    serveFolder(folder);
    watchFolder(folder);

    app.listen(PORT, HOST, async () => {
        const localURL = `http://localhost:${PORT}`;
        const networkURL = `http://${ip.address()}:${PORT}`;
        console.log(`Server started at ${localURL}`);
        console.log(`Accessible on network at ${networkURL}`);
        
        try {
            // Generate QR code and open in browser
            const qrCodePath = await generateQRCode(networkURL);
            console.log(`QR code generated at ${qrCodePath}`);
            open(`${localURL}/qrcode.png`);  // Open QR code in browser
        } catch (error) {
            console.error('Failed to generate or open QR code:', error);
        }

        open(localURL);  // Automatically open in default browser
    });

    liveReloadServer.watch(folder);
};

// Prompt for the folder
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const documentsPath = path.resolve(process.env.HOME, 'Documents/Sites');
const folders = fs.readdirSync(documentsPath).filter(file => fs.statSync(path.join(documentsPath, file)).isDirectory());

if (folders.length === 0) {
    console.log('No folders found in ~/Documents.');
    rl.close();
    process.exit(1);
}

console.log('Spinning up, what folder?');
folders.forEach((folder, index) => {
    console.log(`${index}: ${folder}`);
});

rl.question('Select a folder by number: ', async (input) => {
    const index = parseInt(input, 10);
    if (isNaN(index) || index < 0 || index >= folders.length) {
        console.error('Invalid selection.');
        rl.close();
        process.exit(1);
    }

    const selectedFolder = path.resolve(documentsPath, folders[index]);
    rl.close();

    await startServer(selectedFolder);
});
