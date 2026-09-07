const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { getAllNews } = require('./services/newsAggregator');
const { renderPost, detectBadge } = require('./services/postRenderer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Helper to build Instagram caption
 */
function buildCaption(title, excerpt, source, handle) {
  const cleanHandle = handle || '@ANIREPORT';
  return `🔥 BREAKING: ${title}

📖 Details:
${excerpt}

📌 Source: ${source}

👉 Follow ${cleanHandle} for more daily anime updates, release dates, and trailers!
.
.
.
#animenews #anime #otaku #manga #${(source || 'anime').toLowerCase().replace(/[^a-z0-9]/g, '')} #animeupdate #animelover #animecommunity #anireport #weeb`;
}

// ══════════════════════════════════════════════════════════════
// 🚀 REST API V1 ENDPOINTS
// ══════════════════════════════════════════════════════════════

/**
 * 1. GET /api/v1/posts
 * Returns a list of latest news articles with their DIRECT generated image URLs and ready-to-use captions!
 */
app.get('/api/v1/posts', async (req, res) => {
  try {
    const { source, search, limit = 20, refresh, handle = '@ANIREPORT', ratio = '4:5' } = req.query;
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    let news = await getAllNews(refresh === 'true');

    if (source) {
      news = news.filter(item => item.sourceKey === source || item.source.toLowerCase().includes(source.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      news = news.filter(item => item.title.toLowerCase().includes(q) || item.excerpt.toLowerCase().includes(q));
    }

    const total = news.length;
    const paginated = news.slice(0, parseInt(limit, 10));

    const posts = paginated.map(item => {
      const badgeInfo = detectBadge(item.title);
      return {
        id: item.id,
        title: item.title,
        excerpt: item.excerpt,
        source: item.source,
        date: item.date,
        tags: item.tags,
        badge: badgeInfo.text,
        badgeColor: badgeInfo.color,
        original_image_url: item.image,
        generated_image_url: `${baseUrl}/api/v1/posts/${encodeURIComponent(item.id)}/image?ratio=${encodeURIComponent(ratio)}&handle=${encodeURIComponent(handle)}`,
        instagram_caption: buildCaption(item.title, item.excerpt, item.source, handle),
        link: item.link
      };
    });

    res.json({
      status: 'success',
      total,
      count: posts.length,
      data: posts
    });
  } catch (err) {
    console.error('API /v1/posts error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * 2. GET /api/v1/posts/latest/image
 * DIRECT IMAGE ENDPOINT: Returns the actual PNG graphic for the latest breaking anime news!
 * Perfect for <img src="...">, Discord/Telegram bots, or webhooks.
 */
app.get('/api/v1/posts/latest/image', async (req, res) => {
  try {
    const { handle = '@ANIREPORT', ratio = '4:5', badge, badgeColor } = req.query;
    const news = await getAllNews(false);

    if (!news || news.length === 0) {
      return res.status(404).send('No anime news available');
    }

    const latest = news[0];
    const buffer = await renderPost({
      title: latest.title,
      excerpt: latest.excerpt,
      image: latest.image,
      source: latest.source,
      handle,
      ratio,
      badge,
      badgeColor
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    res.send(buffer);
  } catch (err) {
    console.error('API /posts/latest/image error:', err);
    res.status(500).send('Error generating post image: ' + err.message);
  }
});

/**
 * 3. GET /api/v1/posts/:id/image
 * DIRECT IMAGE ENDPOINT: Returns the actual PNG graphic for a specific news article ID!
 */
app.get('/api/v1/posts/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const { handle = '@ANIREPORT', ratio = '4:5', badge, badgeColor } = req.query;
    
    const news = await getAllNews(false);
    const item = news.find(n => n.id === id);

    if (!item) {
      return res.status(404).json({ status: 'error', message: `Article with ID '${id}' not found` });
    }

    const buffer = await renderPost({
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      source: item.source,
      handle,
      ratio,
      badge,
      badgeColor
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes cache
    res.send(buffer);
  } catch (err) {
    console.error('API /posts/:id/image error:', err);
    res.status(500).send('Error generating post image: ' + err.message);
  }
});

/**
 * 4. POST /api/v1/generate-custom
 * Custom image generator endpoint: Send your own title, excerpt, image URL, and receive the rendered PNG!
 */
app.post('/api/v1/generate-custom', async (req, res) => {
  try {
    const {
      title = 'Breaking Anime Announcement',
      excerpt = 'Exclusive new details on the upcoming release.',
      image,
      source = 'Anime News',
      handle = '@ANIREPORT',
      badge,
      badgeColor,
      ratio = '4:5'
    } = req.body;

    if (!image) {
      return res.status(400).json({ status: 'error', message: 'Missing required field: image' });
    }

    const buffer = await renderPost({
      title,
      excerpt,
      image,
      source,
      handle,
      badge,
      badgeColor,
      ratio
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="custom_anime_post.png"');
    res.send(buffer);
  } catch (err) {
    console.error('API /generate-custom error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Backward compatibility: GET /api/news
 */
app.get('/api/news', async (req, res) => {
  try {
    const { source, search, limit = 50, refresh } = req.query;
    let news = await getAllNews(refresh === 'true');

    if (source) {
      news = news.filter(item => item.sourceKey === source || item.source.toLowerCase().includes(source.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      news = news.filter(item => item.title.toLowerCase().includes(q) || item.excerpt.toLowerCase().includes(q));
    }

    res.json({
      status: 'success',
      total: news.length,
      count: Math.min(news.length, parseInt(limit, 10)),
      data: news.slice(0, parseInt(limit, 10))
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Image Proxy to bypass frontend canvas CORS
 */
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: 8000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🔥 AniNews API & Instagram Studio is LIVE!`);
  console.log(`👉 Web Studio:  http://localhost:${PORT}`);
  console.log(`👉 REST API:    http://localhost:${PORT}/api/v1/posts`);
  console.log(`👉 Direct Pic:  http://localhost:${PORT}/api/v1/posts/latest/image`);
  console.log(`======================================================\n`);
});
