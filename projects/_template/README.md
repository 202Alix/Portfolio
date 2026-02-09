# Project Page Template Guide

This template provides a modular structure for creating new project pages. You can mix and match different section types without being forced to include images.

## How to Use

1. **Copy the template file** to a new project folder:
   ```
   /projects/your-project-slug/your-project-slug.html
   ```

2. **Replace the placeholders** with your content:
    - `PROJECT_TITLE` - Your project name
    - `HERO_IMAGE_URL` - Square hero image (400x400px suggested)
    - `TAG_1`, `TAG_2`, `TAG_3` - Project category tags
    - `SECTION_IMAGE_URL` - Images for content sections
    - `PREVIOUS_PROJECT_URL` & `NEXT_PROJECT_URL` - Navigation links
    - `IMAGE_URL_FULL` & `IMAGE_URL_THUMB` - Gallery images

## Language Versions (URL-Based)

The portfolio uses a simple URL-based language system: a French page and a separate English page.

### Create the English Version

1. Copy the French file and add `-en` to the filename:
    ```
    /projects/your-project-slug/your-project-slug.html
    /projects/your-project-slug/your-project-slug-en.html
    ```
2. Translate all visible text in the `-en` file.
3. Keep meta tags single-language per file:
    ```html
    <meta name="project-title" content="Your Title">
    <meta name="project-tags" content="Tag 1,Tag 2,Tag 3">
    ```
4. Update `script-en.js` to include the project slug:
    ```js
    const projectSlugs = ['your-project-slug'];
    ```

The language toggle uses `navigateLang()` to swap between `your-project-slug.html` and `your-project-slug-en.html`.

## Section Types

### 1. Image Left + Text Right
```html
<section class="section-pad">
    <div class="section-content">
        <h2>Section Title</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
            <div>
                <img src="IMAGE_URL" alt="">
            </div>
            <div>
                <p>Text content...</p>
            </div>
        </div>
    </div>
</section>
```

### 2. Text Left + Image Right
Same grid structure, but swap the order of the divs:
```html
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
    <div>
        <p>Text content...</p>
    </div>
    <div>
        <img src="IMAGE_URL" alt="">
    </div>
</div>
```

### 3. Text Only (No Image)
```html
<section class="section-pad">
    <div class="section-content">
        <h2>Section Title</h2>
        <div>
            <p style="max-width: 900px;">
                Full-width text content...
            </p>
        </div>
    </div>
</section>
```

## Key Classes & CSS Variables

- `.section-pad` - Provides 64px padding top/bottom between sections
- `.section-content` - Max-width 1440px with 132px side padding
- `.project-gallery` - Pinterest masonry layout (column-count: 3)
- `var(--off-white)` - #FDFEFE (white)
- `var(--vivid-blue)` - #058ED9 (blue)
- `var(--cyan)` - #00D6FF (cyan)
- `var(--jet-black)` - #060606 (background)

## Spacing Standards

- **Between sections**: 64px (handled by `.section-pad`)
- **Between heading and content**: 32px (use `margin-bottom: 32px` on h2)
- **Between paragraphs**: 24px (use `margin-top: 24px`)
- **Grid gap (image + text)**: 48px
- **Gallery gap**: 24px column gap

## Typography

All typography is handled through inline styles for consistency:

- **Headings (h2)**: Bricolage Grotesque, 48px, 700 weight
- **Body text**: Plus Jakarta Sans, 18px, line-height 1.7, 80% opacity white
- **Max-width for text**: 900px

## Gallery

Gallery items use a lightbox that supports both images and videos:

```html
<button class="gallery-item" data-type="image" data-src="FULL_IMAGE_URL">
    <img src="THUMB_IMAGE_URL" alt="">
</button>

<!-- For videos: -->
<button class="gallery-item" data-type="video" data-src="VIDEO_URL">
    <img src="VIDEO_THUMBNAIL_URL" alt="">
</button>
```

- Click to open lightbox
- Click outside or press Escape to close
- Images use `object-fit: cover` to fill column space

## Navigation

- **Side arrows**: Fixed left/right positioned, link to previous/next projects
- **Back button**: Links to `../../index.html` (homepage)
- **Logo**: Clickable in header, redirects to homepage with gradient hover effect

## Tips

- Keep section headings to 1-2 lines maximum
- Use `max-width: 900px` on full-width text for readability
- Keep images at consistent aspect ratios for clean gallery layout
- Use high-quality images (suggest 1600px+ width for full-screen)
- Test navigation links before publishing new pages
