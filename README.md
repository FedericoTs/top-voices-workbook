# Personal Brand Course Web App

A modern, responsive web application built with Node.js, Express, Tailwind CSS, and shadcn/ui components to showcase the Personal Brand Course content.

## Features

- 🎨 **Modern Design**: Clean, professional interface with Tailwind CSS and shadcn/ui
- 📱 **Responsive**: Works perfectly on desktop, tablet, and mobile devices
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 📚 **Chapter Navigation**: Easy navigation through all 29 chapters
- 📊 **Progress Tracking**: Visual progress indicators for reading completion
- 🎯 **Table of Contents**: Organized by sections with quick access
- ⚡ **Fast Performance**: Optimized for speed and user experience
- 🔍 **SEO Friendly**: Proper meta tags and semantic HTML

## Installation & Setup

1. **Install dependencies**:
```bash
cd course-webapp
npm install
```

2. **Build Tailwind CSS**:
```bash
npm run build
```

3. **Start development server**:
```bash
npm run dev
```

4. **Or start production server**:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
course-webapp/
├── views/                 # EJS templates
│   ├── layout.ejs        # Base layout
│   ├── index.ejs         # Homepage
│   ├── course.ejs        # Chapter reading interface
│   ├── toc.ejs           # Table of contents
│   └── 404.ejs           # Error page
├── src/
│   └── input.css         # Tailwind CSS source
├── public/
│   └── styles.css        # Generated CSS
├── server.js             # Express server
├── package.json          # Dependencies
└── tailwind.config.js    # Tailwind configuration
```

## Key Routes

- `/` - Course overview and homepage
- `/course` - Redirects to first chapter
- `/course/:chapterId` - Individual chapter view
- `/toc` - Complete table of contents
- `/api/chapters` - JSON API for chapters

## Customization

### Colors & Themes
Modify `tailwind.config.js` and `src/input.css` to customize the color scheme and design tokens.

### Content
The app automatically parses the `Personal_Brand_Course_Enhanced.md` file from the parent directory.

### Styling
All components use Tailwind CSS with shadcn/ui design system for consistency and maintainability.

## Features Included

### Navigation
- Sticky navigation with course progress
- Sidebar table of contents
- Previous/Next chapter navigation
- Mobile-responsive menu

### Reading Experience
- Clean typography optimized for long-form reading
- Reading progress indicator
- Smooth scrolling and animations
- Chapter bookmarking

### Visual Elements
- Professional color scheme
- Animated icons with Lucide
- Gradient backgrounds
- Interactive hover states
- Loading animations

### Performance
- Optimized CSS bundling
- Lazy loading where appropriate
- Responsive images
- Fast server-side rendering

## Development Scripts

- `npm run dev` - Start development with auto-reload
- `npm run build` - Build production CSS
- `npm run tailwind:watch` - Watch CSS changes
- `npm start` - Start production server

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile Safari and Chrome
- Internet Explorer 11+ (with some limitations)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test across different devices
5. Submit a pull request

## License

This project is for educational purposes as part of the Personal Brand Course.