// Project slugs that exist - update this when adding new projects
const projectSlugs = [
	'lyricloom',
	// Add more project slugs here as you create them
	// 'zenith-identity',
	// 'motion-showreel',
	// etc.
];

// Start empty - will be populated from meta tags
let projects = [];
let filterCategories = new Set(['Tous']);

// Try to load meta tags from project pages
async function enrichProjectsWithMetaTags() {
	const enrichedProjects = [];
	console.log('Starting to load projects from slugs:', projectSlugs);
	
	for (const slug of projectSlugs) {
		try {
			console.log(`Fetching project: ${slug}`);
			
			// Build absolute URL that works with both file:// and http:// protocols
			let fetchUrl = `./projects/${slug}/${slug}.html`;
			if (window.location.protocol === 'file:') {
				// If opened as file://, try to use the absolute file path
				fetchUrl = `/projects/${slug}/${slug}.html`;
			}
			
			const response = await fetch(fetchUrl);
			console.log(`Response status for ${slug}:`, response.status);
			
			if (!response.ok) {
				console.warn(`Failed to fetch ${slug}: ${response.status}`);
				continue;
			}
			
			const html = await response.text();
			console.log(`HTML length for ${slug}:`, html.length);
			
			// Extract meta tags using regex instead of DOMParser
			const titleMatch = html.match(/name="project-title"\s+content="([^"]*)"/);
			const yearMatch = html.match(/name="project-year"\s+content="([^"]*)"/);
			const tagsMatch = html.match(/name="project-tags"\s+content="([^"]*)"/);
			const imageMatch = html.match(/name="project-image"\s+content="([^"]*)"/);
			
			const title = titleMatch ? titleMatch[1] : '';
			const year = yearMatch ? yearMatch[1] : '';
			const tagsStr = tagsMatch ? tagsMatch[1] : '';
			const image = imageMatch ? imageMatch[1] : '';
			
			console.log(`Parsed ${slug}:`, { title, year, tagsStr, image });
			
			if (!title) {
				console.warn(`No title found for ${slug}`);
				continue;
			}
			
			const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
			const primaryTag = tags[0] || 'Portfolio';
			
			console.log(`${slug} - Primary tag: ${primaryTag}, All tags:`, tags);
			
			// Add tags to filter categories
			tags.forEach(tag => filterCategories.add(tag));
			
			enrichedProjects.push({
				id: enrichedProjects.length + 1,
				year: year,
				title: title,
				category: primaryTag,
				tags: tags,
				image: image || 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=400&fit=crop'
			});
			console.log(`✓ Successfully added ${slug}:`, enrichedProjects[enrichedProjects.length - 1]);
		} catch (error) {
			console.error(`✗ Error loading ${slug}:`, error);
		}
	}
	
	console.log('Final enriched projects:', enrichedProjects);
	console.log('Final filter categories:', Array.from(filterCategories));
	
	// If we got enriched projects, use them
	if (enrichedProjects.length > 0) {
		projects = enrichedProjects;
		console.log('✓✓✓ Meta tags loaded successfully!');
		// Update filter buttons with new categories
		updateFilterButtons();
		return true;
	} else {
		console.error('✗✗✗ No projects loaded from meta tags');
		return false;
	}
}

// Call enrichment immediately and wait for it
enrichProjectsWithMetaTags().then(() => {
	console.log('✓ Projects loaded:', projects);
	console.log('✓ Filter categories:', Array.from(filterCategories));
	// Once loaded, render everything
	window.heroSlides = projects.slice(0, 3);
	window_heroSlides = projects.slice(0, 3);
	console.log('✓ Hero slides set:', window.heroSlides);
	renderProjects();
	if (window.heroSlides.length > 0) {
		updateCarousel(0);
		startCarousel();
	}
	updateSectionNav();
	setupMobileCenterBehavior();
}).catch(err => {
	console.error('✗ Error during project loading:', err);
});

// Update filter buttons based on discovered categories
function updateFilterButtons() {
	const filterContainer = document.querySelector('.filter-container');
	if (!filterContainer) return;
	
	// Clear existing buttons except for restructuring
	const existingButtons = filterContainer.querySelectorAll('.filter-btn');
	existingButtons.forEach(btn => btn.remove());
	
	const allLabel = 'Tous';

	// Add "All/Tous" button
	const tousBtn = document.createElement('button');
	tousBtn.className = 'filter-btn';
	tousBtn.dataset.filter = allLabel;
	tousBtn.textContent = allLabel;
	if (activeFilter === allLabel) {
		tousBtn.classList.add('active');
	}
	filterContainer.appendChild(tousBtn);
	
	// Add category buttons sorted
	const sortedCategories = Array.from(filterCategories)
		.filter(cat => cat !== allLabel)
		.sort();
	
	sortedCategories.forEach(category => {
		const btn = document.createElement('button');
		btn.className = 'filter-btn';
		btn.dataset.filter = category;
		btn.textContent = category;
		if (activeFilter === category) {
			btn.classList.add('active');
		}
		filterContainer.appendChild(btn);
	});
	
	// Re-attach event listeners to new buttons
	document.querySelectorAll('.filter-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			activeFilter = btn.dataset.filter;
			renderProjects();
		});
	});
}

// Fallback hardcoded projects if meta tags can't be loaded
// (keeps the old data as backup, can be removed once meta tags are working)
// Helper to create URL-friendly slugs from project titles
function slugify(text) {
	return String(text)
		.toLowerCase()
		.trim()
		.replace(/\n+/g, ' ') // collapse newlines
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

let currentSlide = 0;
let activeFilter = "Tous";
let window_heroSlides = [];

// Carousel functionality
function updateCarousel(index) {
	const heroSlides = window.heroSlides || [];
	if (heroSlides.length === 0) return;
	
	if (index < 0) index = heroSlides.length - 1;
	if (index >= heroSlides.length) index = 0;
    
	currentSlide = index;
	const image = document.getElementById('hero-image');
	const yearEl = document.querySelector('.hero-slide-year');
	const titleEl = document.querySelector('.hero-slide-title');
	const categoryEl = document.querySelector('.hero-slide-category');

	// use class-based fades so :hover rules can override opacity (inline styles block CSS hover)
	image.classList.remove('fade-in');
	image.classList.add('fade-out');

	setTimeout(() => {
		// heroSlides now uses the same fields as projects
		image.src = heroSlides[index].image;
		// set current hero's project id and slug for mobile navigation
		const heroContainer = document.querySelector('.hero-image-container');
		if (heroContainer) {
			heroContainer.dataset.projectId = heroSlides[index].id || '';
			const slug = slugify(heroSlides[index].title || '') || '';
			heroContainer.dataset.projectSlug = slug || '';
			// Make hero image clickable to navigate to project
			heroContainer.onclick = () => {
				if (slug) {
					window.location.href = `./projects/${slug}/${slug}.html`;
				}
			};
			heroContainer.style.cursor = slug ? 'pointer' : 'default';
		}
		// swap classes to fade back in
		image.classList.remove('fade-out');
		image.classList.add('fade-in');
		// populate overlay fields (preserve newlines in title via textContent + CSS white-space: pre-line)
		if (yearEl) yearEl.textContent = heroSlides[index].year || '';
		if (titleEl) titleEl.textContent = heroSlides[index].title || '';
		if (categoryEl) categoryEl.innerHTML = `<div class="badge-inner">${heroSlides[index].category || ''}</div>`;
	}, 250);

	document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
		dot.classList.toggle('active', i === index);
		// update accessible selected state
		if (i === index) {
			dot.setAttribute('aria-selected', 'true');
		} else {
			dot.setAttribute('aria-selected', 'false');
		}
	});
}

function startCarousel() {
	carouselInterval = setInterval(() => {
		updateCarousel(currentSlide + 1);
	}, 5000); // auto-advance every 5 seconds
}

function resetCarousel() {
	clearInterval(carouselInterval);
	startCarousel();
}

// Bind clearer IDs for previous / next arrows
const carouselPrevBtn = document.getElementById('carousel-prev');
const carouselNextBtn = document.getElementById('carousel-next');
if (carouselPrevBtn) {
	carouselPrevBtn.addEventListener('click', () => {
		updateCarousel(currentSlide - 1);
		resetCarousel();
	});
}
if (carouselNextBtn) {
	carouselNextBtn.addEventListener('click', () => {
		updateCarousel(currentSlide + 1);
		resetCarousel();
	});
}

document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
	dot.addEventListener('click', () => {
		updateCarousel(index);
		resetCarousel();
	});
});

// Filter functionality
function renderProjects() {
	const grid = document.getElementById('project-grid');
	const filtered = activeFilter === 'Tous'
		? projects
		: projects.filter(p => p.tags && p.tags.includes(activeFilter));

	grid.innerHTML = filtered.map(project => {
		const slug = slugify(project.title);
		return `
				<a href="./projects/${slug}/${slug}.html" class="project-card" data-project-id="${project.id}" data-project-slug="${slug}">
					<div class="project-card-image" style="background-image: url('${project.image}')"></div>
					<div class="project-card-content">
						<div class="project-year">${project.year}</div>
						<div class="project-content">
							<div class="project-title">${project.title}</div>
						</div>
						<div class="project-bottom">
							<div class="project-badge">${project.category}</div>
						</div>
					</div>
				</a>
			`}).join('');

	// After rendering, ensure mobile center observers/listeners are (re)initialized
	setupMobileCenterBehavior();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		activeFilter = btn.dataset.filter;
		renderProjects();
	});
});

// Scroll functionality
function scrollToSection(sectionId) {
	const section = document.getElementById(sectionId);
	if (section) {
		section.scrollIntoView({ behavior: 'smooth' });
	}
}

// Section navigation tracking
function updateSectionNav() {
	const heroSection = document.getElementById('hero');
	const portfolioSection = document.getElementById('portfolio');
	const contactSection = document.getElementById('contact');
    
	const heroNav = document.getElementById('section-nav-hero');
	const portfolioNav = document.getElementById('section-nav-portfolio');
	const contactNav = document.getElementById('section-nav-contact');

	const scrollPos = window.scrollY + window.innerHeight / 2;

	const heroTop = heroSection.offsetTop;
	const heroBottom = heroTop + heroSection.offsetHeight;
    
	const portfolioTop = portfolioSection.offsetTop;
	const portfolioBottom = portfolioTop + portfolioSection.offsetHeight;
    
	const contactTop = contactSection.offsetTop;
	const contactBottom = contactTop + contactSection.offsetHeight;

	heroNav.classList.remove('visible');
	portfolioNav.classList.remove('visible');
	contactNav.classList.remove('visible');

	if (scrollPos >= heroTop && scrollPos < heroBottom) {
		heroNav.classList.add('visible');
	}
	else if (scrollPos >= portfolioTop && scrollPos < portfolioBottom) {
		portfolioNav.classList.add('visible');
	}
	else if (scrollPos >= contactTop && scrollPos < contactBottom) {
		contactNav.classList.add('visible');
	}
}

window.addEventListener('scroll', updateSectionNav);

// Make section-nav buttons scroll to the top of their section.
// Each .section-nav has an id like `section-nav-hero`; we derive the
// target section id by stripping the prefix and call scrollToSection.
document.querySelectorAll('.section-nav').forEach(nav => {
	const btn = nav.querySelector('.section-nav-btn');
	if (!btn) return;
	const navId = nav.id || '';
	const match = navId.replace(/^section-nav-/, '');
	if (match) {
		btn.addEventListener('click', () => {
			scrollToSection(match);
		});
	}
});

// Mobile center-detection and single-tap navigation
function setupMobileCenterBehavior() {
	// Only enable on touch / coarse pointer devices
	const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
	// remove any previously added listeners/state
	const cards = document.querySelectorAll('.project-card');
	cards.forEach(c => c.classList.remove('in-center'));
	const heroContainer = document.querySelector('.hero-image-container');
	if (heroContainer) heroContainer.classList.remove('in-center');

	if (!isTouch) return;

	function checkCenters() {
		const viewportCenterY = window.innerHeight / 2;

		// Hero
		if (heroContainer) {
			const rect = heroContainer.getBoundingClientRect();
			const centerY = rect.top + rect.height / 2;
			const distance = Math.abs(centerY - viewportCenterY);
			// threshold: within 35% of element height or 120px
			const threshold = Math.min(rect.height * 0.35, 120);
			if (distance <= threshold) heroContainer.classList.add('in-center');
			else heroContainer.classList.remove('in-center');
		}

		// Project cards
		cards.forEach(card => {
			const rect = card.getBoundingClientRect();
			const centerY = rect.top + rect.height / 2;
			const distance = Math.abs(centerY - viewportCenterY);
			const threshold = Math.min(rect.height * 0.35, 120);
			if (distance <= threshold) card.classList.add('in-center');
			else card.classList.remove('in-center');
		});
	}

	// Throttle scroll/resize with rAF
	let raf = null;
	function scheduleCheck() {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			checkCenters();
			raf = null;
		});
	}

	window.addEventListener('scroll', scheduleCheck, { passive: true });
	window.addEventListener('resize', scheduleCheck);
	window.addEventListener('orientationchange', scheduleCheck);
	window.addEventListener('touchmove', scheduleCheck, { passive: true });
	// run once to initialize
	scheduleCheck();

	// Add touch/click handlers: if tapped while in-center, navigate to project page
	cards.forEach(card => {
		card.addEventListener('touchend', (e) => {
			// prevent accidental double-handling
			const inCenter = card.classList.contains('in-center');
			const slug = card.dataset.projectSlug;
			if (inCenter && slug) {
				// navigate to project page in folder: /projects/{slug}/{slug}.html
				window.location.href = `/projects/${slug}/${slug}.html`;
			} else if (!inCenter) {
				// if not centered, scroll the card into center on first tap
				e.preventDefault();
				card.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, { passive: false });
	});

	if (heroContainer) {
		heroContainer.addEventListener('touchend', (e) => {
			const inCenter = heroContainer.classList.contains('in-center');
			const slug = heroContainer.dataset.projectSlug || '';
			if (inCenter && slug) {
				window.location.href = `/projects/${slug}/${slug}.html`;
			} else if (!inCenter) {
				e.preventDefault();
				heroContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, { passive: false });
	}
}

// Initialize (projects are loaded by enrichProjectsWithMetaTags above)
updateSectionNav();
// initialize mobile center behavior (if applicable)
setupMobileCenterBehavior();
if (typeof setupMobileCenterBehavior === 'function') setupMobileCenterBehavior();

	// Crosshair: two lines (horizontal + vertical) that follow the mouse cursor.
	(function() {
		const crosshair = document.getElementById('crosshair');
		if (!crosshair) return;
		const hLine = crosshair.querySelector('.crosshair-line.horizontal');
		const vLine = crosshair.querySelector('.crosshair-line.vertical');

		let mouseX = window.innerWidth / 2;
		let mouseY = window.innerHeight / 2;
		let raf = null;

		function render() {
			// Position lines centered on cursor
			if (hLine) hLine.style.top = mouseY + 'px';
			if (vLine) vLine.style.left = mouseX + 'px';
			raf = null;
		}

		function scheduleRender() {
			if (raf === null) raf = requestAnimationFrame(render);
		}

		window.addEventListener('mousemove', (e) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
			scheduleRender();
		});

		// Touch support: follow first touch point
		window.addEventListener('touchmove', (e) => {
			if (e.touches && e.touches[0]) {
				mouseX = e.touches[0].clientX;
				mouseY = e.touches[0].clientY;
				scheduleRender();
			}
		}, { passive: true });

		// Initialize position
		render();
	})();

// Language navigation with slider animation
function navigateLang(lang) {
	const enBtn = document.getElementById('lang-en');
	const frBtn = document.getElementById('lang-fr');
	
	if (lang === 'en') {
		enBtn.classList.add('active');
		frBtn.classList.remove('active');
		window.location.href = './index-en.html';
	} else {
		frBtn.classList.add('active');
		enBtn.classList.remove('active');
		window.location.href = './index.html';
	}
}

