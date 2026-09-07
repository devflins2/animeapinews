const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output_posts');
const HISTORY_FILE = path.join(__dirname, '..', 'posted_history.json');
const MAX_SAVED_POSTS = 25; // Keep only latest 25 posts to avoid disk full on Render.com
const MAX_HISTORY_TRACK = 150; // Keep track of last 150 posted IDs

/**
 * Ensure directories and history files exist
 */
function initStorage() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

/**
 * Read list of already generated / posted article IDs
 */
function getPostedHistory() {
  try {
    initStorage();
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Could not read posted history, resetting:', err.message);
    return [];
  }
}

/**
 * Record a newly posted article ID and prune history size
 */
function recordPostedId(id) {
  try {
    const history = getPostedHistory();
    if (!history.includes(id)) {
      history.unshift(id);
      const trimmed = history.slice(0, MAX_HISTORY_TRACK);
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to update posted history:', err.message);
  }
}

/**
 * Auto-cleanup storage:
 * - Scans output_posts folder
 * - Keeps only the latest `maxPosts` posts (matching pairs of .png and .txt)
 * - Removes older files to prevent disk exhaustion & Render crashes
 */
function cleanStorage(maxPosts = MAX_SAVED_POSTS) {
  initStorage();

  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    
    // Group files by modified time
    const imageFiles = [];
    const textFiles = [];
    let totalBytes = 0;

    files.forEach(file => {
      if (file === '.gitkeep') return;
      const filePath = path.join(OUTPUT_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        totalBytes += stats.size;
        const item = { name: file, path: filePath, mtime: stats.mtimeMs, size: stats.size };

        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
          imageFiles.push(item);
        } else if (file.endsWith('.txt') || file.endsWith('.json')) {
          textFiles.push(item);
        }
      } catch (e) {
        // Skip unreadable files
      }
    });

    // Sort newest first
    imageFiles.sort((a, b) => b.mtime - a.mtime);
    textFiles.sort((a, b) => b.mtime - a.mtime);

    let deletedCount = 0;
    let deletedBytes = 0;

    // Prune images beyond limit
    if (imageFiles.length > maxPosts) {
      const toDelete = imageFiles.slice(maxPosts);
      toDelete.forEach(item => {
        try {
          fs.unlinkSync(item.path);
          deletedCount++;
          deletedBytes += item.size;
        } catch (err) {
          console.warn(`Could not delete old file ${item.name}:`, err.message);
        }
      });
    }

    // Prune text captions beyond limit
    if (textFiles.length > maxPosts) {
      const toDelete = textFiles.slice(maxPosts);
      toDelete.forEach(item => {
        try {
          fs.unlinkSync(item.path);
          deletedCount++;
          deletedBytes += item.size;
        } catch (err) {
          console.warn(`Could not delete old file ${item.name}:`, err.message);
        }
      });
    }

    const currentFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f !== '.gitkeep');
    const remainingMb = ((totalBytes - deletedBytes) / (1024 * 1024)).toFixed(2);

    if (deletedCount > 0) {
      console.log(`🧹 Storage Auto-Cleanup: Deleted ${deletedCount} older files (${(deletedBytes / (1024 * 1024)).toFixed(2)} MB freed). Current storage: ${remainingMb} MB (${currentFiles.length} files).`);
    }

    return {
      deletedCount,
      freedMb: (deletedBytes / (1024 * 1024)).toFixed(2),
      remainingFiles: currentFiles.length,
      currentStorageMb: remainingMb
    };
  } catch (err) {
    console.error('Storage cleanup error:', err.message);
    return { error: err.message };
  }
}

/**
 * Get current storage stats
 */
function getStorageStats() {
  initStorage();
  try {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f !== '.gitkeep');
    let totalBytes = 0;
    let imagesCount = 0;
    let captionsCount = 0;

    files.forEach(f => {
      try {
        const s = fs.statSync(path.join(OUTPUT_DIR, f));
        totalBytes += s.size;
        if (f.endsWith('.png')) imagesCount++;
        if (f.endsWith('.txt')) captionsCount++;
      } catch (e) {}
    });

    return {
      totalFiles: files.length,
      imagesCount,
      captionsCount,
      sizeMb: (totalBytes / (1024 * 1024)).toFixed(2),
      maxAllowedPosts: MAX_SAVED_POSTS,
      status: totalBytes < 50 * 1024 * 1024 ? 'healthy' : 'cleanup_recommended'
    };
  } catch (err) {
    return { totalFiles: 0, sizeMb: '0.00', error: err.message };
  }
}

module.exports = {
  OUTPUT_DIR,
  initStorage,
  getPostedHistory,
  recordPostedId,
  cleanStorage,
  getStorageStats
};
