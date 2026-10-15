// applies the saved or system theme before first paint
try { var t = localStorage.getItem('tg-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; } catch (e) {}
