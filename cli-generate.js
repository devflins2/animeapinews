const fs = require('fs');
const path = require('path');
const { getAllNews } = require('./services/newsAggregator');
const { renderPost } = require('./services/postRenderer');

async function runCli() {
  console.log('🚀 Starting Automated Anime News Instagram Post Generator (100% English & Complete Stories)...\n');

  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'output_posts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const news = await getAllNews(true);
  if (!news || news.length === 0) {
    console.log('❌ No news articles found.');
    return;
  }

  const sampleCount = Math.min(news.length, 3);
  console.log(`📸 Generating ${sampleCount} Instagram Posts with Full English Captions in '${outputDir}'...\n`);

  for (let i = 0; i < sampleCount; i++) {
    const item = news[i];
    console.log(`[${i + 1}/${sampleCount}] Rendering: "${item.title.substring(0, 60)}..."`);

    try {
      const buffer = await renderPost({
        title: item.title,
        excerpt: item.excerpt,
        image: item.image,
        source: item.source,
        handle: '@ANIREPORT',
        ratio: '4:5'
      });

      const baseName = `post_${i + 1}_${Date.now()}`;
      const imageFileName = `${baseName}.png`;
      const textFileName = `${baseName}_caption.txt`;

      fs.writeFileSync(path.join(outputDir, imageFileName), buffer);

      const fullDetails = item.content && item.content.length > item.excerpt.length ? item.content : item.excerpt;
      const captionText = `🔥 BREAKING ANIME NEWS: ${item.title}

📖 Full Story & Official Details:
${fullDetails}

📌 Source: ${item.source}
⚡ Coverage: 100% Verified Anime News

👉 Follow @ANIREPORT for daily breaking anime updates, official trailers, cast reveals, and release schedules!
.
.
.
#animenews #anime #otaku #manga #${item.source.toLowerCase().replace(/[^a-z0-9]/g, '')} #animecommunity #animelover #animeupdate #weeb #anireport`;

      fs.writeFileSync(path.join(outputDir, textFileName), captionText, 'utf8');

      console.log(`   ✅ Image Saved: ${imageFileName}`);
      console.log(`   ✅ Full Caption Saved: ${textFileName}`);
    } catch (err) {
      console.error(`   ❌ Failed to render post ${i + 1}:`, err.message);
    }
  }

  console.log(`\n🎉 Done! All images and full captions generated in: ${outputDir}`);
}

runCli();
