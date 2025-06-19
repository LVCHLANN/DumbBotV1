const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const { getTempFilename, getFileType } = require('./utils');
const { execSync } = require('child_process');

ffmpeg.setFfmpegPath(ffmpegPath);

async function convertToImage(inputPath, format) {
    const type = getFileType(inputPath);
    const results = [];

    switch (type) {
        case 'image':
            results.push(await convertImage(inputPath, format));
            break;

        case 'video':
            if (format === 'gif') {
                results.push(await convertVideoToGif(inputPath));
            } else {
                results.push(await extractVideoFrame(inputPath, format));
            }
            break;

        case 'pdf':
            const pages = await convertPdfToImages(inputPath, format);
            results.push(...pages);
            break;

        case 'text':
            const rendered = await renderTextToImage(inputPath, format);
            results.push(rendered);
            break;

        default:
            throw new Error('Unsupported file type.');
    }

    return results;
}

async function convertImage(inputPath, format) {
    const outputPath = getTempFilename(format);
    await sharp(inputPath)
        .toFormat(format)
        .toFile(outputPath);
    return outputPath;
}

async function convertVideoToGif(inputPath) {
    const outputPath = getTempFilename('gif');
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions('-vf', 'fps=10,scale=320:-1:flags=lanczos')
            .toFormat('gif')
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
}

async function extractVideoFrame(inputPath, format) {
    const outputPath = getTempFilename(format);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .screenshots({
                count: 1,
                timemarks: ['0'],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
            });
    });
}

async function convertPdfToImages(inputPath, format) {
    const outputBase = getTempFilename('page');
    const outputDir = path.dirname(outputBase);
    const baseName = path.basename(outputBase).replace(/\.page$/, '');
    const command = `pdftoppm -${format} "${inputPath}" "${path.join(outputDir, baseName)}"`;

    execSync(command);

    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith(baseName))
        .map(f => path.join(outputDir, f));

    return files;
}

async function renderTextToImage(inputPath, format) {
    const content = fs.readFileSync(inputPath, 'utf8');
    const ext = path.extname(inputPath).toLowerCase();

    // Simple text render using sharp + SVG
    const lines = content.split('\n').map(line => escapeHtml(line));
    const svg = `
    <svg width="1200" height="${lines.length * 24 + 80}" xmlns="http://www.w3.org/2000/svg">
        <style>
            .line { font: 20px monospace; fill: black; white-space: pre; }
        </style>
        ${lines.map((line, i) => `<text x="20" y="${40 + i * 24}" class="line">${line}</text>`).join('\n')}
    </svg>
    `;

    const buffer = Buffer.from(svg);
    const outputPath = getTempFilename(format);
    await sharp(buffer).toFormat(format).toFile(outputPath);
    return outputPath;
}

function escapeHtml(text) {
    return text.replace(/[&<>'"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[c]));
}

module.exports = { convertToImage };
