// Runs before first paint so a saved theme never flashes the system one.
(function () {
    try {
        const saved = localStorage.getItem('rare-word-finder-theme');
        if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    } catch (e) {}
})();
