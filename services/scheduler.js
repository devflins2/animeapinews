const fs = require('fs');
const path = require('path');
const { getAllNews } = require('./newsAggregator');
const { renderPost } = require('./postRenderer');
const { OUTPUT_DIR, getPostedHistory, recordPostedId, cleanStorage, getStorageStats } = require('./storageManager');

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours
let timerId = null;
let isJobRunning = false;

const schedulerState = {
  isRunning: false,
  intervalHours: 2,
  lastRunAt: null,
  nextRunAt: null,
  totalRuns: 0,
  lastRunSummary: null
};

/**
 * Execute automated 2-hour fetching, rendering & pruning job
 */
async function runAutoJob(maxNewPosts = 3) {
  if (isJobRunning) {
    console.log('⏳ Auto-job is already in progress, skipping duplicate invocation.');
    return { status: 'already_running' };
  }

  isJobRunning = true;
  const startTime = Date.now();
  console.log(`\n⏰ [2-Hour Auto-Scheduler] Starting scheduled anime news refresh at ${new Date().toISOString()}...`);

  try {
    // 1. Force fetch fresh news from all sources in pure English
    const news = await getAllNews(true);
    if (!news || news.length === 0) {
      console.log('⚠️ [2-Hour Auto-Scheduler] No news items returned.');
      isJobRunning = false;
      return { status: 'no_news' };
    }

    // 2. Identify unposted news articles
    const postedHistory = getPostedHistory();
    const unposted = news.filter(item => !postedHistory.includes(item.id));
    console.log(`🔎 [2-Hour Auto-Scheduler] Found ${unposted.length} new unposted anime stories.`);

    const candidates = unposted.slice(0, maxNewPosts);
    const generated = [];

    // 3. Generate Ultra HD Posts & Captions for new stories
    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      console.log(`🎨 [Auto-Poster ${i + 1}/${candidates.length}] Rendering Ultra HD Post: "${item.title.substring(0, 50)}..."`);

      try {
        const buffer = await renderPost({
          title: item.title,
          excerpt: item.excerpt,
          image: item.image,
          source: item.source,
          handle: '@ANIREPORT',
          ratio: '4:5'
        });

        const timestamp = Date.now();
        const baseName = `post_auto_${timestamp}_${i + 1}`;
        const imagePath = path.join(OUTPUT_DIR, `${baseName}.png`);
        const textPath = path.join(OUTPUT_DIR, `${baseName}_caption.txt`);

        fs.writeFileSync(imagePath, buffer);

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

        fs.writeFileSync(textPath, captionText, 'utf8');

        // Record history to prevent future duplicates
        recordPostedId(item.id);
        generated.push({ id: item.id, title: item.title, file: `${baseName}.png` });

        console.log(`   ✅ Ultra HD Post & Caption generated: ${baseName}.png`);
      } catch (postErr) {
        console.error(`   ❌ Failed to render auto-post ${item.id}:`, postErr.message);
      }
    }

    // 4. Run Storage Cleanup immediately to keep disk footprint light (< 30MB)
    const cleanupResult = cleanStorage(25);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    schedulerState.lastRunAt = new Date().toISOString();
    schedulerState.nextRunAt = new Date(Date.now() + TWO_HOURS_MS).toISOString();
    schedulerState.totalRuns += 1;
    schedulerState.lastRunSummary = {
      postsGenerated: generated.length,
      durationSec,
      cleanup: cleanupResult
    };

    console.log(`🎉 [2-Hour Auto-Scheduler] Completed in ${durationSec}s. Generated: ${generated.length} new HD posts. Next scheduled run at: ${schedulerState.nextRunAt}\n`);

    isJobRunning = false;
    return {
      status: 'success',
      generatedCount: generated.length,
      generated,
      cleanup: cleanupResult,
      nextRunAt: schedulerState.nextRunAt
    };
  } catch (err) {
    isJobRunning = false;
    console.error('❌ [2-Hour Auto-Scheduler] Job error:', err);
    return { status: 'error', message: err.message };
  }
}

/**
 * Start the recurring 2-hour scheduler
 */
function startScheduler() {
  if (timerId) {
    clearInterval(timerId);
  }

  schedulerState.isRunning = true;
  schedulerState.nextRunAt = new Date(Date.now() + TWO_HOURS_MS).toISOString();

  // Schedule recurring execution every 2 hours
  timerId = setInterval(() => {
    runAutoJob(3);
  }, TWO_HOURS_MS);

  // Initial startup execution after a small delay (12 seconds) so server boots smoothly
  setTimeout(() => {
    console.log('🚀 [2-Hour Auto-Scheduler] Running initial warm-up & post check...');
    runAutoJob(2);
  }, 12000);

  console.log(`\n⏱️  Automated 2-Hour News Scheduler & Auto-Pruner is ACTIVE! (Next run: ${schedulerState.nextRunAt})`);
}

/**
 * Get current scheduler status for API and UI
 */
function getSchedulerStatus() {
  return {
    ...schedulerState,
    storage: getStorageStats()
  };
}

module.exports = {
  startScheduler,
  runAutoJob,
  getSchedulerStatus
};
