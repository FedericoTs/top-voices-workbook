const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');

const app = express();
const PORT = process.env.PORT || 3000;

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