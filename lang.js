(function() {
	const LANG_KEY = 'preferredLang';
	const SUPPORTED_LANGS = ['fr', 'en'];

	function normalizeLang(lang) {
		if (!lang) return 'fr';
		const normalized = String(lang).toLowerCase();
		return SUPPORTED_LANGS.includes(normalized) ? normalized : 'fr';
	}

	function getStoredLang() {
		try {
			return localStorage.getItem(LANG_KEY);
		} catch (error) {
			return null;
		}
	}

	function getCurrentLang() {
		const stored = getStoredLang();
		if (stored) return normalizeLang(stored);
		return normalizeLang(document.documentElement.getAttribute('lang') || 'fr');
	}

	function updateLangButtons(lang) {
		const btnFr = document.getElementById('lang-fr');
		const btnEn = document.getElementById('lang-en');
		if (btnFr) btnFr.classList.toggle('active', lang === 'fr');
		if (btnEn) btnEn.classList.toggle('active', lang === 'en');
	}

	function updateTextContent(lang) {
		const textNodes = document.querySelectorAll('[data-i18n-fr][data-i18n-en]');
		textNodes.forEach((node) => {
			const value = node.getAttribute(`data-i18n-${lang}`);
			if (value !== null) {
				node.textContent = value;
			}
		});

		const htmlNodes = document.querySelectorAll('[data-i18n-html-fr][data-i18n-html-en]');
		htmlNodes.forEach((node) => {
			const value = node.getAttribute(`data-i18n-html-${lang}`);
			if (value !== null) {
				node.innerHTML = value;
			}
		});

		const attrNodes = document.querySelectorAll('[data-i18n-attr]');
		attrNodes.forEach((node) => {
			const attrName = node.getAttribute('data-i18n-attr');
			if (!attrName) return;
			const value = node.getAttribute(`data-i18n-${lang}-attr`);
			if (value !== null) {
				node.setAttribute(attrName, value);
			}
		});
	}

	function setLanguage(lang, options = {}) {
		const normalized = normalizeLang(lang);
		document.documentElement.setAttribute('lang', normalized);
		updateLangButtons(normalized);
		updateTextContent(normalized);

		if (options.store !== false) {
			try {
				localStorage.setItem(LANG_KEY, normalized);
			} catch (error) {
				// Ignore storage errors (private mode, etc.)
			}
		}

		window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: normalized } }));
	}

	function bindLangButtons() {
		const btnFr = document.getElementById('lang-fr');
		const btnEn = document.getElementById('lang-en');
		if (btnFr) btnFr.addEventListener('click', () => setLanguage('fr'));
		if (btnEn) btnEn.addEventListener('click', () => setLanguage('en'));
	}

	function init() {
		bindLangButtons();
		setLanguage(getCurrentLang(), { store: false });
	}

	window.setLanguage = setLanguage;
	window.getCurrentLang = getCurrentLang;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
