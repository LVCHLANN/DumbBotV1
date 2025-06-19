const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');

// Supported extensions categorized by file type
const supportedExtensions = {
    image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.ico', '.svg', '.eps', '.psd'],
    video: ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.ts', '.mpeg', '.3gp'],
    pdf: ['.pdf'],
    text: ['.txt', '.md']
};

// Flatten into a list of all supported extensions
const allSupported = Object.values(supportedExtensions).flat();

/**
 * Generate a unique temporary filename with extension inside ./temp
 */
function getTempFilename(ext) {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const id = crypto.randomBytes(6).toString('hex');
    return path.join(tempDir, `temp_${id}.${ext}`);
}

/**
 * Download a file from Discord's CDN and save it locally
 */
async function downloadFile(url, originalName) {
    const ext = path.extname(originalName).slice(1) || 'tmp';
    const filePath = getTempFilename(ext);
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Failed to fetch file from ${url}`);

    const stream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body.pipe(stream);
        res.body.on('error', reject);
        stream.on('finish', resolve);
    });

    return filePath;
}

/**
 * Check if the file extension is one of the supported types
 */
function isSupportedFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return allSupported.includes(ext);
}

/**
 * Determine what category the file falls under
 */
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (supportedExtensions.image.includes(ext)) return 'image';
    if (supportedExtensions.video.includes(ext)) return 'video';
    if (supportedExtensions.pdf.includes(ext)) return 'pdf';
    if (supportedExtensions.text.includes(ext)) return 'text';
    return 'unsupported';
}

/**
 * Delete an array of file paths
 */
function deleteFiles(files) {
    for (const file of files) {
        try {
            fs.unlinkSync(file);
        } catch (err) {
            console.warn(`⚠️ Failed to delete ${file}: ${err.message}`);
        }
    }
}

module.exports = {
    getTempFilename,
    downloadFile,
    isSupportedFile,
    getFileType,
    deleteFiles
};
