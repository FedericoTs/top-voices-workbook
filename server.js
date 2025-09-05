const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache configuration - use /tmp for serverless environments
const CACHE_DIR = process.env.VERCEL ? '/tmp/thumbnail-cache' : path.join(__dirname, 'thumbnail-cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Ensure cache directory exists (with error handling for serverless)
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (error) {
  console.warn('Could not create cache directory:', error.message);
}

// Load workbooks configuration
const workbooksConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'workbooks-config.json'), 'utf8'));
const workbooks = new Map(); // Store parsed workbooks data

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));

// Generic workbook content parser
function parseWorkbookContent(workbookConfig) {
  try {
    const workbookPath = path.join(__dirname, 'content', workbookConfig.filename);
    const content = fs.readFileSync(workbookPath, 'utf8');
    
    const chapters = [];
    
    // Handle ## Chapter format
    const doublePoundSplit = content.split(/^## Chapter (\d+):/gm);
    for (let i = 1; i < doublePoundSplit.length; i += 2) {
      const chapterNum = parseInt(doublePoundSplit[i]);
      const chapterData = doublePoundSplit[i + 1] || '';
      const lines = chapterData.split('\n');
      const chapterTitle = lines[0]?.trim() || '';
      const chapterContent = lines.slice(1).join('\n').trim();
      
      if (chapterTitle && chapterContent) {
        chapters.push({
          id: chapterNum,
          title: chapterTitle,
          section: workbookConfig.sectionMapping[chapterNum.toString()] || Object.values(workbookConfig.sectionMapping)[0],
          content: chapterContent,
          html: marked(chapterContent)
        });
      }
    }
    
    // Handle # Chapter format
    const singlePoundSplit = content.split(/^# Chapter (\d+):/gm);
    for (let i = 1; i < singlePoundSplit.length; i += 2) {
      const chapterNum = parseInt(singlePoundSplit[i]);
      const chapterData = singlePoundSplit[i + 1] || '';
      const lines = chapterData.split('\n');
      const chapterTitle = lines[0]?.trim() || '';
      const chapterContent = lines.slice(1).join('\n').trim();
      
      if (chapterTitle && chapterContent && !chapters.find(c => c.id === chapterNum)) {
        chapters.push({
          id: chapterNum,
          title: chapterTitle,
          section: workbookConfig.sectionMapping[chapterNum.toString()] || Object.values(workbookConfig.sectionMapping)[0],
          content: chapterContent,
          html: marked(chapterContent)
        });
      }
    }
    
    return chapters.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error(`Error parsing workbook content for ${workbookConfig.slug}:`, error);
    return [];
  }
}

// Generate table of contents for a workbook
function generateTableOfContents(chapters) {
  const toc = [];
  let currentSection = '';
  
  chapters.forEach(chapter => {
    if (chapter.section !== currentSection) {
      currentSection = chapter.section;
      toc.push({
        type: 'section',
        title: currentSection,
        chapters: []
      });
    }
    
    const sectionIndex = toc.length - 1;
    toc[sectionIndex].chapters.push({
      id: chapter.id,
      title: chapter.title
    });
  });
  
  return toc;
}

// Initialize all workbooks
function initializeWorkbooks() {
  workbooksConfig.workbooks.forEach(workbookConfig => {
    console.log(`Loading workbook: ${workbookConfig.title}`);
    const chapters = parseWorkbookContent(workbookConfig);
    const tableOfContents = generateTableOfContents(chapters);
    
    workbooks.set(workbookConfig.slug, {
      config: workbookConfig,
      chapters,
      toc: tableOfContents
    });
    
    console.log(`  Loaded ${chapters.length} chapters`);
  });
}

// Initialize all workbooks on startup
initializeWorkbooks();

console.log(`Loaded ${workbooks.size} workbooks:`);
workbooks.forEach((workbook, slug) => {
  console.log(`  - ${workbook.config.title}: ${workbook.chapters.length} chapters`);
});

// Routes
app.get('/', (req, res) => {
  // Homepage showing all available workbooks
  const workbooksList = Array.from(workbooks.values()).map(workbook => ({
    ...workbook.config,
    totalChapters: workbook.chapters.length,
    firstChapters: workbook.chapters.slice(0, 3) // Preview chapters
  }));
  
  res.render('index', {
    workbooks: workbooksList
  });
});

// Workbook table of contents
app.get('/course/:workbookSlug', (req, res) => {
  const workbookSlug = req.params.workbookSlug;
  const workbook = workbooks.get(workbookSlug);
  
  if (!workbook) {
    return res.status(404).render('404');
  }
  
  res.render('toc', {
    workbook: workbook.config,
    toc: workbook.toc,
    totalChapters: workbook.chapters.length
  });
});

// Individual chapter view
app.get('/course/:workbookSlug/:chapterId', (req, res) => {
  const workbookSlug = req.params.workbookSlug;
  const chapterId = parseInt(req.params.chapterId);
  const workbook = workbooks.get(workbookSlug);
  
  if (!workbook) {
    return res.status(404).render('404');
  }
  
  const chapter = workbook.chapters.find(c => c.id === chapterId);
  if (!chapter) {
    return res.status(404).render('404');
  }
  
  const prevChapter = workbook.chapters.find(c => c.id === chapterId - 1);
  const nextChapter = workbook.chapters.find(c => c.id === chapterId + 1);
  
  res.render('course', {
    workbook: workbook.config,
    toc: workbook.toc,
    currentChapter: chapterId,
    chapter,
    prevChapter,
    nextChapter,
    progress: Math.round((chapterId / workbook.chapters.length) * 100),
    workbookSlug
  });
});

// Legacy route redirect to maintain compatibility
app.get('/toc', (req, res) => {
  // Redirect to the first workbook's TOC for backward compatibility
  const firstWorkbookSlug = Array.from(workbooks.keys())[0];
  if (firstWorkbookSlug) {
    res.redirect(`/course/${firstWorkbookSlug}`);
  } else {
    res.status(404).render('404');
  }
});

// Legacy workbook route redirect
app.get('/course', (req, res) => {
  // Redirect to homepage to show all workbooks
  res.redirect('/');
});

// API endpoints
app.get('/api/workbooks', (req, res) => {
  const workbooksList = Array.from(workbooks.values()).map(workbook => ({
    slug: workbook.config.slug,
    title: workbook.config.title,
    author: workbook.config.author,
    description: workbook.config.description,
    totalChapters: workbook.chapters.length,
    tags: workbook.config.tags,
    difficulty: workbook.config.difficulty
  }));
  
  res.json({ workbooks: workbooksList });
});

app.get('/api/workbooks/:workbookSlug/chapters', (req, res) => {
  const workbookSlug = req.params.workbookSlug;
  const workbook = workbooks.get(workbookSlug);
  
  if (!workbook) {
    return res.status(404).json({ error: 'Workbook not found' });
  }
  
  res.json({
    workbook: workbook.config.title,
    chapters: workbook.chapters.map(c => ({
      id: c.id,
      title: c.title,
      section: c.section
    })),
    totalChapters: workbook.chapters.length
  });
});

// Helper function to generate cache key
function generateCacheKey(url, width, height) {
  const hash = crypto.createHash('md5');
  hash.update(`${url}-${width}-${height}`);
  return hash.digest('hex');
}

// Helper function to check if cached file is valid
function isCacheValid(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const now = new Date().getTime();
    const fileTime = new Date(stats.mtime).getTime();
    return (now - fileTime) < CACHE_DURATION;
  } catch (error) {
    return false;
  }
}

// Dynamic thumbnail generation endpoint with caching
app.get('/api/thumbnail', async (req, res) => {
  try {
    const { url = 'http://localhost:3000/', width = 1200, height = 630 } = req.query;
    const cacheKey = generateCacheKey(url, width, height);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.png`);
    
    // Check if cached version exists and is valid
    if (fs.existsSync(cachePath) && isCacheValid(cachePath)) {
      console.log('Serving cached thumbnail for:', url);
      const cachedImage = fs.readFileSync(cachePath);
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': cachedImage.length,
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT'
      });
      
      return res.send(cachedImage);
    }
    
    console.log('Generating new thumbnail for:', url);
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 2
    });

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot of the hero section
    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: parseInt(width),
        height: parseInt(height)
      }
    });

    await browser.close();

    // Save to cache (with error handling)
    try {
      // Ensure cache directory exists before writing
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(cachePath, screenshot);
      console.log('Thumbnail cached at:', cachePath);
    } catch (cacheError) {
      console.warn('Could not cache thumbnail:', cacheError.message);
      // Continue without caching - the thumbnail will still be served
    }

    // Set headers for image response
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': screenshot.length,
      'Cache-Control': 'public, max-age=3600',
      'X-Cache': 'MISS'
    });

    res.send(screenshot);

  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// Sitemap.xml endpoint
app.get('/sitemap.xml', (req, res) => {
  try {
    const baseUrl = `https://${req.get('host')}`;
    const currentDate = new Date().toISOString();
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // Add workbook pages
    workbooks.forEach((workbook, slug) => {
      // Table of contents page
      sitemap += `  <url>
    <loc>${baseUrl}/course/${slug}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;

      // Individual chapters
      workbook.chapters.forEach(chapter => {
        sitemap += `  <url>
    <loc>${baseUrl}/course/${slug}/${chapter.id}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      });
    });

    sitemap += `</urlset>`;

    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt endpoint
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

# Sitemap
Sitemap: https://www.topvoicesworkbook.com/sitemap.xml

# Allow important pages
Allow: /course/
Allow: /api/thumbnail

# Block unnecessary paths  
Disallow: /api/
Allow: /api/thumbnail

# Cache policy
Crawl-delay: 1`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Top Voices Workbook webapp running at http://localhost:${PORT}`);
  console.log(`View all workbooks at: http://localhost:${PORT}/`);
  
  // Show available workbook URLs
  workbooks.forEach((workbook, slug) => {
    console.log(`  - ${workbook.config.title}: http://localhost:${PORT}/course/${slug}`);
  });
});