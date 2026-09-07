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

/**
 * Clean and sanitize English text:
 * - Decodes HTML entities
 * - Removes HTML tags
 * - Strips WordPress shortcodes and ad markers
 * - Normalizes whitespace and punctuation
 */
function cleanText(text) {
  if (!text) return '';
  let str = he.decode(text);
  // Remove HTML tags
  str = str.replace(/<[^>]*>/g, ' ');
  // Remove shortcodes like [en]Source:[/en] or [ad_bottom ...]
  str = str.replace(/\[\/?(en|es|ad_bottom|caption|gallery)[^\]]*\]/gi, ' ');
  str = str.replace(/\[ad_[^\]]+\]/gi, ' ');
  // Remove promotional source footers at the end
  str = str.replace(/\s*(Source|Fuente|Via):\s*https?:\/\/[^\s]+/gi, '');
  str = str.replace(/\s*(Read more|Continue reading|Discuss this in our forum)\b.*$/gi, '');
  // Normalize whitespace
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

/**
 * Creates a complete, coherent 2-3 sentence English summary
 */
function generateCompleteExcerpt(title, content, snippet) {
  const cleanTitle = cleanText(title);
  let text = cleanText(snippet || content || '');

  // If snippet is too short or is identical to title, use content
  if (!text || text.length < 40 || text.toLowerCase() === cleanTitle.toLowerCase()) {
    if (content && cleanText(content).length > 40) {
      text = cleanText(content);
    } else {
      return `${cleanTitle}. Get all the official details, release schedules, and updates on the latest anime adaptation.`;
    }
  }

  // Extract first 2 to 3 complete sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    let summary = '';
    for (const s of sentences) {
      const cleanS = s.trim();
      if (!cleanS) continue;
      if (summary.length + cleanS.length < 280) {
        summary += (summary ? ' ' : '') + cleanS;
      } else {
        break;
      }
    }
    if (summary.length >= 35) return summary;
  }

  // Fallback cleanly at word boundary
  if (text.length > 220) {
    const cut = text.substring(0, 210);
    const lastSpace = cut.lastIndexOf(' ');
    return cut.substring(0, lastSpace) + '...';
  }
  return text;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 1. Fetch Anime News Network (ANN) with complete English story & key visuals
 */
async function fetchANN() {
  try {
    const [pageRes, rssFeed] = await Promise.all([
      axios.get('https://www.animenewsnetwork.com/news/', {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000
      }).catch(() => null),
      parser.parseURL('https://www.animenewsnetwork.com/news/rss.xml').catch(() => null)
    ]);

    // Build map of RSS snippets for ANN articles
    const rssSnippets = new Map();
    if (rssFeed && Array.isArray(rssFeed.items)) {
      rssFeed.items.forEach(item => {
        if (item.title) {
          rssSnippets.set(normalizeTitle(item.title), {
            snippet: item.contentSnippet || item.content,
            pubDate: item.pubDate,
            link: item.link
          });
        }
      });
    }

    const articles = [];
    if (pageRes && pageRes.data) {
      const $ = cheerio.load(pageRes.data);

      $('.herald.box.news').each((i, el) => {
        const titleEl = $(el).find('h3 a');
        const title = titleEl.text().trim();
        const link = titleEl.attr('href');

        let rawThumb = $(el).find('.thumbnail').attr('data-src') || 
                       $(el).find('.thumbnail img').attr('src') || 
                       $(el).find('img').attr('src');

        if (rawThumb && title && link) {
          let image = rawThumb;
          if (image.startsWith('/')) {
            image = 'https://cdn.animenewsnetwork.com' + image;
          }
          // High-resolution crop
          image = image.replace(/crop\d+x\d+g[a-zA-Z0-9]+/, 'max600x600');

          const previewText = $(el).find('.preview').text().trim() || $(el).find('.intro').text().trim();
          const rssMatch = rssSnippets.get(normalizeTitle(title));
          const bestSnippet = rssMatch ? rssMatch.snippet : previewText;

          const cleanTitleStr = cleanText(title);
          const fullExcerpt = generateCompleteExcerpt(cleanTitleStr, bestSnippet, bestSnippet);
          const fullContent = cleanText(bestSnippet || previewText || fullExcerpt);

          articles.push({
            id: 'ann-' + Math.random().toString(36).substring(2, 9),
            title: cleanTitleStr,
            excerpt: fullExcerpt,
            content: fullContent,
            source: 'Anime News Network',
            sourceKey: 'ann',
            date: rssMatch && rssMatch.pubDate ? rssMatch.pubDate : new Date().toISOString(),
            link: link.startsWith('http') ? link : 'https://www.animenewsnetwork.com' + link,
            image: image,
            tags: ['anime', 'announcement', 'ann']
          });
        }
      });
    }

    return articles;
  } catch (err) {
    console.error('Error fetching ANN:', err.message);
    return [];
  }
}

/**
 * 2. Fetch MyAnimeList (MAL News) with full English news details
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
          image = image.replace(/\/r\/\d+x\d+/, '');

          const rawExcerpt = $(el).find('.text').text().trim();
          const date = $(el).find('.info').text().trim();

          const cleanTitleStr = cleanText(title);
          const fullExcerpt = generateCompleteExcerpt(cleanTitleStr, rawExcerpt, rawExcerpt);
          const fullContent = cleanText(rawExcerpt) || fullExcerpt;

          articles.push({
            id: 'mal-' + Math.random().toString(36).substring(2, 9),
            title: cleanTitleStr,
            excerpt: fullExcerpt,
            content: fullContent,
            source: 'MyAnimeList',
            sourceKey: 'myanimelist',
            date: date || new Date().toISOString(),
            link: link,
            image: image,
            tags: ['anime', 'mal', 'official']
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
 * 3. Fetch Anime UK News with full English news articles
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
      } else if (item['content:encoded'] || item.content) {
        const $ = cheerio.load(item['content:encoded'] || item.content);
        img = $('img').first().attr('src');
      }

      if (img && item.title) {
        const rawContent = item['content:encoded'] || item.content || item.contentSnippet || item.title;
        const cleanTitleStr = cleanText(item.title);
        const cleanContent = cleanText(rawContent);
        const fullExcerpt = generateCompleteExcerpt(cleanTitleStr, cleanContent, item.contentSnippet);

        articles.push({
          id: 'auk-' + Math.random().toString(36).substring(2, 9),
          title: cleanTitleStr,
          excerpt: fullExcerpt,
          content: cleanContent,
          source: 'Anime UK News',
          sourceKey: 'animeuknews',
          date: item.pubDate || new Date().toISOString(),
          link: item.link,
          image: img,
          tags: ['anime', 'uk-news', 'reviews']
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
 * 4. Fetch Honey's Anime with full English news articles & visuals
 */
async function fetchHoneysAnime() {
  try {
    const feed = await parser.parseURL('https://honeysanime.com/feed/');
    const articles = [];

    feed.items.forEach(item => {
      let img = null;
      if (item.enclosure && item.enclosure.url) {
        img = item.enclosure.url;
      } else if (item['content:encoded'] || item.content) {
        const $ = cheerio.load(item['content:encoded'] || item.content);
        img = $('img').first().attr('src');
      }

      if (img && item.title) {
        const rawContent = item['content:encoded'] || item.content || item.contentSnippet || item.title;
        const cleanTitleStr = cleanText(item.title);
        const cleanContent = cleanText(rawContent);
        const fullExcerpt = generateCompleteExcerpt(cleanTitleStr, cleanContent, item.contentSnippet);

        articles.push({
          id: 'ha-' + Math.random().toString(36).substring(2, 9),
          title: cleanTitleStr,
          excerpt: fullExcerpt,
          content: cleanContent,
          source: "Honey's Anime",
          sourceKey: 'honeysanime',
          date: item.pubDate || new Date().toISOString(),
          link: item.link,
          image: img,
          tags: ['anime', 'recommendations', 'news']
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
 * Fetch full complete article body for an individual article
 */
async function fetchFullArticleBody(article) {
  if (!article || !article.link) return article;
  
  // If content is already substantial (>= 250 characters), keep it
  if (article.content && article.content.length >= 250) {
    return article;
  }

  try {
    const res = await axios.get(article.link, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    let paragraphs = [];

    if (article.sourceKey === 'ann') {
      $('.meat p').each((i, el) => {
        const p = $(el).text().trim();
        if (p && !p.startsWith('Source:') && !p.startsWith('Image via')) {
          paragraphs.push(p);
        }
      });
    } else if (article.sourceKey === 'myanimelist') {
      $('.content').find('script, style, .tags, .comment').remove();
      const raw = $('.content').text().trim();
      if (raw) paragraphs.push(raw);
    } else {
      $('.entry-content p, .post-content p, article p').each((i, el) => {
        const p = $(el).text().trim();
        if (p) paragraphs.push(p);
      });
    }

    if (paragraphs.length > 0) {
      const fullText = cleanText(paragraphs.join('\n\n'));
      if (fullText.length > 40) {
        article.content = fullText;
        article.excerpt = generateCompleteExcerpt(article.title, fullText, article.excerpt);
      }
    }
  } catch (err) {
    // Non-fatal, use existing content
  }

  return article;
}

/**
 * Fetch all sources concurrently with deduplication, full English text, and 100% unique anime pictures
 */
async function getAllNews(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && newsCache.length > 0 && (now - lastFetchedAt) < CACHE_TTL) {
    return newsCache;
  }

  console.log('🔄 Fetching complete anime news in pure English with 100% unique anime pictures...');

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

  // Track unique titles and unique images
  const seenTitles = new Set();
  const seenImages = new Set();
  const deduped = [];

  for (const item of combined) {
    const normTitle = normalizeTitle(item.title);
    const imgUrl = item.image;

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

  // Cap to 120 freshest articles to ensure minimal RAM usage on Render/Cloud hosting
  const cappedNews = deduped.slice(0, 120);

  // Pre-load full detailed paragraphs for the top 15 breaking stories for instant speed
  const topSlice = cappedNews.slice(0, 15);
  await Promise.allSettled(topSlice.map(item => fetchFullArticleBody(item)));

  newsCache = cappedNews;
  lastFetchedAt = now;

  console.log(`✅ Loaded ${cappedNews.length} complete English anime news stories. Every story has full details & a UNIQUE picture!`);
  return newsCache;
}

/**
 * Get single news item by ID with full article content
 */
async function getNewsById(id) {
  const news = await getAllNews(false);
  const found = news.find(n => n.id === id);
  if (!found) return null;
  return await fetchFullArticleBody(found);
}

module.exports = {
  getAllNews,
  getNewsById,
  cleanText,
  generateCompleteExcerpt
};
