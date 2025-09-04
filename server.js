const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Course content parser
function parseCourseContent() {
  try {
    const coursePath = path.join(__dirname, 'Personal_Brand_Course_Enhanced.md');
    const content = fs.readFileSync(coursePath, 'utf8');
    
    // Define section structure based on timestamps
    const sectionMapping = {
      1: 'Brand',
      2: 'Brand', 
      3: 'Brand',
      4: 'Brand',
      5: 'Brand',
      6: 'Brand',
      7: 'Content',
      8: 'Content',
      9: 'Content',
      10: 'Content',
      11: 'Content',
      12: 'Content',
      13: 'Content',
      14: 'Team',
      15: 'Team',
      16: 'Team',
      17: 'Team',
      18: 'Team',
      19: 'Team',
      20: 'Team',
      21: 'Team',
      22: 'Team',
      23: 'Monetize',
      24: 'Monetize',
      25: 'Monetize',
      26: 'Monetize',
      27: 'Monetize',
      28: 'Monetize',
      29: 'Monetize'
    };
    
    // Split content by both ## Chapter and # Chapter formats
    const chapters = [];
    
    // First handle ## Chapter format
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
          section: sectionMapping[chapterNum] || 'Brand',
          content: chapterContent,
          html: marked(chapterContent)
        });
      }
    }
    
    // Then handle # Chapter format
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
          section: sectionMapping[chapterNum] || 'Brand',
          content: chapterContent,
          html: marked(chapterContent)
        });
      }
    }
    
    return chapters.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Error parsing course content:', error);
    return [];
  }
}

// Generate table of contents
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

// Parse course content on startup
const chapters = parseCourseContent();
const tableOfContents = generateTableOfContents(chapters);

console.log(`Loaded ${chapters.length} chapters from course content`);

// Routes
app.get('/', (req, res) => {
  res.render('index', {
    chapters: chapters.slice(0, 6), // First 6 chapters for preview
    totalChapters: chapters.length,
    toc: tableOfContents
  });
});

app.get('/course', (req, res) => {
  res.render('course', {
    toc: tableOfContents,
    currentChapter: 1,
    chapter: chapters[0] || null,
    progress: chapters.length > 0 ? Math.round((1 / chapters.length) * 100) : 0,
    prevChapter: null,
    nextChapter: chapters.find(c => c.id === 2) || null
  });
});

app.get('/course/:chapterId', (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const chapter = chapters.find(c => c.id === chapterId);
  
  if (!chapter) {
    return res.status(404).render('404');
  }
  
  const prevChapter = chapters.find(c => c.id === chapterId - 1);
  const nextChapter = chapters.find(c => c.id === chapterId + 1);
  
  res.render('course', {
    toc: tableOfContents,
    currentChapter: chapterId,
    chapter,
    prevChapter,
    nextChapter,
    progress: Math.round((chapterId / chapters.length) * 100)
  });
});

app.get('/toc', (req, res) => {
  res.render('toc', {
    toc: tableOfContents,
    totalChapters: chapters.length
  });
});

app.get('/api/chapters', (req, res) => {
  res.json({
    chapters: chapters.map(c => ({
      id: c.id,
      title: c.title,
      section: c.section
    })),
    totalChapters: chapters.length
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Personal Brand Course webapp running at http://localhost:${PORT}`);
  console.log(`View course at: http://localhost:${PORT}/course`);
  console.log(`Table of contents at: http://localhost:${PORT}/toc`);
});