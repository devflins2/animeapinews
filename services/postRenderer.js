const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

/**
 * Helper to fetch image buffer safely with browser-like headers
 */
async function fetchImageBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 8000
    });
    return Buffer.from(response.data);
  } catch (err) {
    console.warn(`Failed to load image from URL (${imageUrl}): ${err.message}. Using fallback.`);
    return null;
  }
}

/**
 * Word wrap helper for canvas context
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Determine category badge text and color based on title or tags
 */
function detectBadge(title = '', tags = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();

  if (t.includes('trailer') || t.includes('teaser') || t.includes('pv')) {
    return { text: 'OFFICIAL TRAILER', color: '#FF4757', bg: '#FF4757' };
  }
  if (t.includes('release date') || t.includes('premiere') || t.includes('broadcast')) {
    return { text: 'RELEASE DATE', color: '#FFA502', bg: '#FFA502' };
  }
  if (t.includes('movie') || t.includes('film') || t.includes('theatrical')) {
    return { text: 'ANIME MOVIE', color: '#9B59B6', bg: '#9B59B6' };
  }
  if (t.includes('season') || t.includes('sequel') || t.includes('renewal')) {
    return { text: 'SEASON ANNOUNCEMENT', color: '#2ED573', bg: '#2ED573' };
  }
  if (t.includes('cast') || t.includes('staff') || t.includes('voice')) {
    return { text: 'CAST & STAFF', color: '#1E90FF', bg: '#1E90FF' };
  }
  return { text: 'OFFICIAL ANNOUNCEMENT', color: '#E50914', bg: '#E50914' };
}

/**
 * Render Instagram News Post
 * 
 * @param {Object} options
 * @param {string} options.title - News headline
 * @param {string} options.excerpt - Short summary
 * @param {string} options.image - Poster/Key Visual URL or Buffer
 * @param {string} options.source - News source name (e.g., Crunchyroll)
 * @param {string} options.handle - Page handle (e.g., @anireport)
 * @param {string} options.badge - Custom badge text
 * @param {string} options.badgeColor - Custom badge color
 * @param {string} options.ratio - '4:5' (1080x1350), '1:1' (1080x1080), or '9:16' (1080x1920)
 * @returns {Promise<Buffer>} PNG Image Buffer
 */
async function renderPost(options = {}) {
  const {
    title = 'Exciting Anime News Announcement',
    excerpt = 'Details regarding the latest anime adaptation, release schedule and production updates.',
    image = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&q=80',
    source = 'Anime News Network',
    handle = '@ANIREPORT',
    ratio = '4:5'
  } = options;

  let width = 1080;
  let height = 1350; // default 4:5

  if (ratio === '1:1') {
    height = 1080;
  } else if (ratio === '9:16') {
    height = 1920;
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background base
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // 2. Load and draw Main Anime Image
  try {
    let imgBuffer;
    if (typeof image === 'string') {
      imgBuffer = await fetchImageBuffer(image);
    } else {
      imgBuffer = image;
    }

    if (imgBuffer) {
      const img = await loadImage(imgBuffer);

      // Smart cover-scaling
      const imgAspect = img.width / img.height;
      const targetAspect = width / height;

      let drawW, drawH, offsetX, offsetY;

      if (imgAspect > targetAspect) {
        drawH = height;
        drawW = height * imgAspect;
        offsetX = (width - drawW) / 2;
        offsetY = 0;
      } else {
        drawW = width;
        drawH = width / imgAspect;
        offsetX = 0;
        offsetY = 0; // Focus on top/center of image
      }

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }
  } catch (err) {
    console.warn('Could not render image onto canvas:', err.message);
  }

  // 3. Cinematic Vignette & Deep Bottom Gradient
  // Top gradient for header watermark clarity
  const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
  topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  topGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 180);

  // Main dark gradient overlay starting from 35% height
  const gradStartY = height * 0.32;
  const bottomGrad = ctx.createLinearGradient(0, gradStartY, 0, height);
  bottomGrad.addColorStop(0, 'rgba(5, 5, 8, 0)');
  bottomGrad.addColorStop(0.35, 'rgba(5, 5, 8, 0.7)');
  bottomGrad.addColorStop(0.7, 'rgba(5, 5, 8, 0.95)');
  bottomGrad.addColorStop(1, '#050508');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, gradStartY, width, height - gradStartY);

  // 4. Header Bar (@anireport style branding)
  const headerY = 60;

  // Header Brand Badge
  ctx.save();
  ctx.fillStyle = '#E50914';
  ctx.beginPath();
  ctx.roundRect(50, headerY - 24, 40, 40, 8);
  ctx.fill();

  // Play/Flame symbol icon inside badge
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(64, headerY - 14);
  ctx.lineTo(78, headerY - 4);
  ctx.lineTo(64, headerY + 6);
  ctx.closePath();
  ctx.fill();

  // Brand Name Text
  ctx.font = 'bold 28px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(handle.replace('@', '').toUpperCase(), 102, headerY + 5);

  // "NEWS" or "UPDATES" Pill on Right
  const rightPillText = 'DAILY UPDATES';
  ctx.font = 'bold 16px "Arial", sans-serif';
  const pillW = ctx.measureText(rightPillText).width + 24;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(width - 50 - pillW, headerY - 20, pillW, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(rightPillText, width - 50 - pillW + 12, headerY + 2);
  ctx.restore();

  // 5. Category Badge (e.g. OFFICIAL ANNOUNCEMENT / TRAILER)
  const badgeInfo = detectBadge(title);
  const badgeText = options.badge || badgeInfo.text;
  const badgeColor = options.badgeColor || badgeInfo.color;

  const contentStartY = height - 480;

  ctx.save();
  ctx.font = 'bold 20px "Arial", sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 36;
  const badgeHeight = 42;
  const badgeX = 50;
  const badgeY = contentStartY;

  // Glowing shadow for badge
  ctx.shadowColor = badgeColor;
  ctx.shadowBlur = 18;
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 8);
  ctx.fill();

  // Badge Text
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, badgeX + 18, badgeY + 28);
  ctx.restore();

  // 6. News Headline (Main Title)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  let fontSize = 46;
  if (title.length > 90) fontSize = 38;
  if (title.length > 130) fontSize = 34;

  ctx.font = `bold ${fontSize}px "Arial", sans-serif`;
  const maxTextWidth = width - 100; // 50px padding on each side
  const titleLines = wrapText(ctx, title, maxTextWidth).slice(0, 3);

  let textY = badgeY + badgeHeight + 45;
  for (const line of titleLines) {
    ctx.fillText(line, 50, textY);
    textY += fontSize + 12;
  }
  ctx.restore();

  // 7. News Excerpt / Summary
  if (excerpt && ratio !== '1:1') {
    ctx.save();
    ctx.font = '22px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(230, 230, 240, 0.88)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;

    const excerptLines = wrapText(ctx, excerpt, maxTextWidth).slice(0, 2);
    textY += 10;
    for (const line of excerptLines) {
      ctx.fillText(line, 50, textY);
      textY += 32;
    }
    ctx.restore();
  }

  // 8. Footer Section with Divider & Social CTA
  const footerY = height - 65;

  // Thin separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, footerY - 30);
  ctx.lineTo(width - 50, footerY - 30);
  ctx.stroke();

  // Source info on left
  ctx.font = 'bold 18px "Arial", sans-serif';
  ctx.fillStyle = '#a0a5b5';
  ctx.fillText(`SOURCE: ${source.toUpperCase()}`, 50, footerY);

  // Follow CTA on right
  ctx.font = 'bold 18px "Arial", sans-serif';
  ctx.fillStyle = '#E50914';
  const ctaText = `FOLLOW ${handle.toUpperCase()}`;
  const ctaWidth = ctx.measureText(ctaText).width;
  ctx.fillText(ctaText, width - 50 - ctaWidth, footerY);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderPost,
  detectBadge
};
