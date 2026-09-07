const fs = require('fs');
const path = require('path');
const { getAllNews } = require('./services/newsAggregator');
const { renderPost } = require('./services/postRenderer');

async function runCli() {
  console.log('🚀 Starting Automated Anime News Instagram Post Generator...\n');

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
  console.log(`📸 Generating ${sampleCount} Instagram Posts (1080x1350 4:5 format) in '${outputDir}'...\n`);

  for (let i = 0; i < sampleCount; i++) {
    const item = news[i];
    console.log(`[${i + 1}/${sampleCount}] Rendering: "${item.title.substring(0, 50)}..."`);

    try {
      const buffer = await renderPost({
        title: item.title,
        excerpt: item.excerpt,
        image: item.image,
        source: item.source,
        handle: '@TODAYANIMENEWS',
        ratio: '4:5'
      });

      const fileName = `post_${i + 1}_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, buffer);

      console.log(`   ✅ Saved -> ${fileName}`);
    } catch (err) {
      console.error(`   ❌ Failed to render post ${i + 1}:`, err.message);
    }
  }

  console.log(`\n🎉 Done! All images generated in: ${outputDir}`);
}

runCli();
