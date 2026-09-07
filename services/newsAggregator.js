const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const he = require('he');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 8000
});

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let newsCache = [];
let lastFetchedAt = 0;
const CACHE_TTL = 8 * 60 * 1000; // 8 minutes

function cleanText(text) {
  if (!text) return '';
  return he.decode(text.replace(/<[^>]*>?/gm, '')).trim();
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 1. Fetch Anime News Network (ANN) - 100% Unique Anime Key Visuals
 */
async function fetchANN() {
  try {
    const res = await axios.get('https://www.animenewsnetwork.com/news/', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    const articles = [];

    $('.herald.box.news').each((i, el) => {
      const titleEl = $(el).find('h3 a');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href');

      // ANN stores thumbnail in data-src or style or img
      let rawThumb = $(el).find('.thumbnail').attr('data-src') || 
                     $(el).find('.thumbnail img').attr('src') || 
                     $(el).find('img').attr('src');

      if (rawThumb && title && link) {
        // Upgrade thumbnail to higher resolution
        let image = rawThumb;
        if (image.startsWith('/')) {
          image = 'https://cdn.animenewsnetwork.com' + image;
        }
        // Upgrade crop to max600x600 for crisp visual quality
        image = image.replace(/crop\d+x\d+g[a-zA-Z0-9]+/, 'max600x600');

        const excerpt = $(el).find('.preview').text().trim() || $(el).find('.intro').text().trim();

        articles.push({
          id: 'ann-' + Math.random().toString(36).substring(2, 9),
          title: cleanText(title),
          excerpt: cleanText(excerpt || title),
          source: 'Anime News Network',
          sourceKey: 'ann',
          date: new Date().toISOString(),
          link: link.startsWith('http') ? link : 'https://www.animenewsnetwork.com' + link,
          image: image,
          tags: ['anime', 'announcement']
        });
      }
    });

    return articles;
  } catch (err) {
    console.error('Error fetching ANN:', err.message);
    return [];
  }
}

/**
 * 2. Fetch MyAnimeList (MAL News Pages 1 & 2) - 100% Unique Anime Posters
 */
async function fetchMyAnimeList() {
  try {
    const [resPage1, resPage2] = await Promise.all([
      axios.get('https://myanimelist.net/news?p=1', { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 }),
      axios.get('https://myanimelist.net/news?p=2', { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 }).catch(() => ({ data: '' }))
    ]);

    const articles = [];

    [resPage1.data, resPage2.data].forEach(html => {
      if (!html) return;
      const $ = cheerio.load(html);

      $('.news-unit').each((i, el) => {
        const titleEl = $(el).find('.title a');
        const title = titleEl.text().trim();
        const link = titleEl.attr('href');
        
        let image = $(el).find('.image-link img').attr('src') || 
                    $(el).find('.image-link img').attr('data-src') || 
                    $(el).find('img').attr('src');

        if (image && title && link) {
          // Remove thumbnail resize to get full-res original poster
          image = image.replace(/\/r\/\d+x\d+/, '');

          const excerpt = $(el).find('.text').text().trim();
          const date = $(el).find('.info').text().trim();

          articles.push({
            id: 'mal-' + Math.random().toString(36).substring(2, 9),
            title: cleanText(title),
            excerpt: cleanText(excerpt || title),
            source: 'MyAnimeList',
            sourceKey: 'myanimelist',
            date: date || new Date().toISOString(),
            link: link,
            image: image,
            tags: ['anime', 'mal']
          });
        }
      });
    });

    return articles;
  } catch (err) {
    console.error('Error fetching MyAnimeList:', err.message);
    return [];
  }
}

/**
 * 3. Fetch Anime UK News (RSS with exact article images)
 */
async function fetchAnimeUKNews() {
  try {
    const feed = await parser.parseURL('https://animeuknews.net/feed/');
    const articles = [];

    feed.items.forEach(item => {
      let img = null;
      if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
        img = item['media:content'].$.url;
      } else if (item.enclosure && item.enclosure.url) {
        img = item.enclosure.url;
      } else if (item.content) {
        const $ = cheerio.load(item.content);
        img = $('img').first().attr('src');
      }

      if (img && item.title) {
        articles.push({
          id: 'auk-' + Math.random().toString(36).substring(2, 9),
          title: cleanText(item.title),
          excerpt: cleanText(item.contentSnippet || item.content || item.title),
          source: 'Anime UK News',
          sourceKey: 'animeuknews',
          date: item.pubDate || new Date().toISOString(),
          link: item.link,
          image: img,
          tags: ['anime', 'uk-news']
        });
      }
    });

    return articles;
  } catch (err) {
    console.error('Error fetching Anime UK News:', err.message);
    return [];
  }
}

/**
 * 4. Fetch Honey's Anime (RSS with exact visuals)
 */
async function fetchHoneysAnime() {
  try {
    const feed = await parser.parseURL('https://honeysanime.com/feed/');
    const articles = [];

    feed.items.forEach(item => {
      let img = null;
      if (item.enclosure && item.enclosure.url) {
        img = item.enclosure.url;
      } else if (item.content) {
        const $ = cheerio.load(item.content);
        img = $('img').first().attr('src');
      }

      if (img && item.title) {
        articles.push({
          id: 'ha-' + Math.random().toString(36).substring(2, 9),
          title: cleanText(item.title),
          excerpt: cleanText(item.contentSnippet || item.content || item.title),
          source: "Honey's Anime",
          sourceKey: 'honeysanime',
          date: item.pubDate || new Date().toISOString(),
          link: item.link,
          image: img,
          tags: ['anime', 'recommendations']
        });
      }
    });

    return articles;
  } catch (err) {
    console.error("Error fetching Honey's Anime:", err.message);
    return [];
  }
}

/**
 * Fetch all sources concurrently with deduplication and 100% unique image guarantee
 */
async function getAllNews(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && newsCache.length > 0 && (now - lastFetchedAt) < CACHE_TTL) {
    return newsCache;
  }

  console.log('🔄 Fetching anime news with 100% unique anime pictures from all sources...');

  const results = await Promise.allSettled([
    fetchANN(),
    fetchMyAnimeList(),
    fetchAnimeUKNews(),
    fetchHoneysAnime()
  ]);

  let combined = [];
  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      combined.push(...res.value);
    }
  });

  // Track unique titles and unique images (No duplicate pictures!)
  const seenTitles = new Set();
  const seenImages = new Set();
  const deduped = [];

  for (const item of combined) {
    const normTitle = normalizeTitle(item.title);
    const imgUrl = item.image;

    // Strict uniqueness check: Must have valid image, unique title, and unique image
    if (
      imgUrl &&
      imgUrl.startsWith('http') &&
      !seenTitles.has(normTitle) &&
      !seenImages.has(imgUrl) &&
      normTitle.length > 5
    ) {
      seenTitles.add(normTitle);
      seenImages.add(imgUrl);
      deduped.push(item);
    }
  }

  newsCache = deduped;
  lastFetchedAt = now;

  console.log(`✅ Loaded ${deduped.length} unique anime news articles. Every single article has a UNIQUE anime picture!`);
  return newsCache;
}

module.exports = {
  getAllNews
};
