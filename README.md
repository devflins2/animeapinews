# 🔥 AniReport Studio & Instagram Post Generator REST API

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Canvas](https://img.shields.io/badge/@napi--rs/canvas-0.1-E50914?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/Brooooooklyn/canvas)
[![License](https://img.shields.io/badge/License-MIT-2ed573?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Real-Time Anime News Aggregator & Automated Instagram Graphic Post Generator</b><br/>
  Styled in the high-engagement format of <code>@anireport</code>.
</p>

</div>

---

## ✨ Features

- 📰 **Multi-Source Aggregation**: Real-time anime news from *Anime News Network, MyAnimeList, Anime UK News, Honey's Anime, and more*.
- 🖼️ **100% Unique HD Posters**: Extracts original, authentic anime key visuals and trailer screenshots for every single article (zero duplicate placeholders).
- 🎨 **Signature @anireport Design**:
  - Custom Branding Header (`@ANIREPORT` or your custom handle).
  - Glowing Category Badges (`OFFICIAL ANNOUNCEMENT`, `TRAILER`, `RELEASE DATE`, `ANIME MOVIE`, `SEASON ANNOUNCEMENT`).
  - Bold Typography with deep drop-shadows & dark gradient backdrop.
  - Source attribution & Social follow footer.
- 📱 **Multi-Format Support**:
  - **📱 4:5 Portrait (`1080 × 1350 px`)** (Standard Instagram feed post)
  - **⬛ 1:1 Square (`1080 × 1080 px`)**
  - **🎬 9:16 Story (`1080 × 1920 px`)**
- ⚡ **REST API V1**: Clean endpoints returning news metadata, direct image render URLs, and formatted Instagram captions.
- 🌐 **Interactive Web Studio**: Built-in dark-mode UI with live canvas preview and 1-click HD downloads.
- 🤖 **Bot & Automation Ready**: Directly embed live post images in Discord, Telegram, or websites using standard `<img />` tags.

---

## 🚀 Quick Start (Local Setup)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

4. **Open Web Studio in browser:**
   ```
   http://localhost:3000
   ```

5. **Generate batch posts via CLI (Optional):**
   ```bash
   npm run generate
   ```
   *Generated posts will be saved in the `output_posts/` folder.*

---

## 📚 REST API Documentation

Base URL: `http://localhost:3000` *(or your deployed domain)*

### 1. `GET /api/v1/posts`
Returns latest anime news articles with their **direct generated image URLs** and ready-to-use Instagram captions.

#### Query Parameters:
| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | number | `20` | Number of articles to return |
| `handle` | string | `@ANIREPORT` | Custom watermark handle |
| `ratio` | string | `4:5` | `4:5`, `1:1`, or `9:16` |
| `source` | string | `all` | Filter by source (e.g. `ann`, `myanimelist`) |
| `search` | string | - | Keyword search in titles/excerpts |

#### Example Response:
```json
{
  "status": "success",
  "total": 275,
  "count": 1,
  "data": [
    {
      "id": "ann-v5r7syx",
      "title": "The Seven Knights of the Marronnier Kingdom Anime Reveals 2nd Trailer",
      "excerpt": "New cast members and opening theme song announced for the upcoming fantasy anime.",
      "source": "Anime News Network",
      "badge": "OFFICIAL TRAILER",
      "badgeColor": "#FF4757",
      "original_image_url": "https://cdn.animenewsnetwork.com/thumbnails/...",
      "generated_image_url": "http://localhost:3000/api/v1/posts/ann-v5r7syx/image?ratio=4:5&handle=@ANIREPORT",
      "instagram_caption": "🔥 BREAKING: The Seven Knights of the Marronnier Kingdom Anime Reveals 2nd Trailer\n\n👉 Follow @ANIREPORT for more updates!",
      "link": "https://www.animenewsnetwork.com/..."
    }
  ]
}
```

---

### 2. `GET /api/v1/posts/latest/image`
**Direct Image Route:** Returns the actual **PNG image** (`image/png`) of the latest breaking news post.

```html
<!-- Direct Image Tag in any Website/Blog -->
<img src="http://localhost:3000/api/v1/posts/latest/image?handle=@mybrand&ratio=4:5" alt="Anime News" />
```

---

### 3. `GET /api/v1/posts/:id/image`
Returns the rendered PNG graphic for a specific article ID.

---

### 4. `POST /api/v1/generate-custom`
Generates a customized post from client-provided data.

```bash
curl -X POST http://localhost:3000/api/v1/generate-custom \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Solo Leveling Season 3 Officially Greenlit",
    "excerpt": "A-1 Pictures confirms pre-production for the next thrilling arc.",
    "image": "https://cdn.myanimelist.net/images/news/12345.jpg",
    "handle": "@MYANIMEHQ",
    "badge": "SEASON ANNOUNCEMENT",
    "ratio": "4:5"
  }' \
  --output custom_post.png
```

---

## 💻 Code Examples

### Python (Bot / Automation)
```python
import requests

# 1. Fetch posts data with direct image URLs
res = requests.get('http://localhost:3000/api/v1/posts?limit=3&handle=@mybrand')
posts = res.json().get('data', [])

for post in posts:
    print(f"Title: {post['title']}")
    print(f"Image Link: {post['generated_image_url']}")
    print(f"Caption:\n{post['instagram_caption']}\n" + "-"*50)

# 2. Download latest post image directly
img_res = requests.get('http://localhost:3000/api/v1/posts/latest/image?handle=@mybrand&ratio=4:5')
with open('latest_anime_post.png', 'wb') as f:
    f.write(img_res.content)
```

### JavaScript / Fetch
```javascript
async function getAnimeNews() {
  const res = await fetch('http://localhost:3000/api/v1/posts?limit=5&handle=@mybrand');
  const { data } = await res.json();
  
  data.forEach(item => {
    console.log(item.title);
    console.log(item.generated_image_url);
  });
}

getAnimeNews();
```

---

## 🌐 Deploy to Render (Free Web Service)

1. Push this repository to **GitHub**.
2. Go to **[Render.com](https://render.com)** and click **"New +" ➔ "Web Service"**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`
5. Click **"Deploy Web Service"**!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
