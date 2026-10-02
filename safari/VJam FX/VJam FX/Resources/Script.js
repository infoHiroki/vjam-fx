// 端末の言語が日本語なら html の lang を ja にする(既定は英語)。出し分けは Style.css
document.documentElement.lang = /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
