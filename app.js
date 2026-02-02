let wordFrequency = {};
const THEME_STORAGE_KEY = 'rare-word-finder-theme';

function getCurrentTheme() {
    const override = document.documentElement.getAttribute('data-theme');
    if (override === 'light' || override === 'dark') return override;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButtonLabel();
}

function updateThemeButtonLabel() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const current = getCurrentTheme();
    btn.textContent = current === 'light' ? 'Dark mode' : 'Light mode';
    btn.setAttribute('aria-label', current === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
}

function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
        applyTheme(saved);
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeButtonLabel();
    }
    document.getElementById('theme-toggle').addEventListener('click', function () {
        const next = getCurrentTheme() === 'light' ? 'dark' : 'light';
        applyTheme(next);
        localStorage.setItem(THEME_STORAGE_KEY, next);
    });
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return {};
    const result = {};
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const commaIndex = line.indexOf(',');
        if (commaIndex === -1) continue;
        const word = line.slice(0, commaIndex).trim();
        const logFreq = parseFloat(line.slice(commaIndex + 1).trim());
        if (word && !isNaN(logFreq)) {
            result[word] = logFreq;
        }
    }
    return result;
}

function setStatus(el, status, message) {
    el.className = status;
    el.textContent = message;
}

function loadFromURL(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load CSV');
            return response.text();
        })
        .then(csvText => {
            wordFrequency = parseCSV(csvText);
            return Object.keys(wordFrequency).length;
        });
}

function loadFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            wordFrequency = parseCSV(e.target.result);
            resolve(Object.keys(wordFrequency).length);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

const FREQ_DATA_URL = 'https://www.kaggle.com/datasets/rtatman/english-word-frequency';

function initApp() {
    const statusEl = document.getElementById('load-status');
    const textInput = document.getElementById('text-input');
    const fileInputDiv = document.getElementById('csv-file-input');

    loadFromURL('wordFrequencyData.csv')
        .then((count) => {
            statusEl.className = 'ready';
            statusEl.innerHTML = '<a href="' + FREQ_DATA_URL + '" target="_blank" rel="noopener">Word frequency data</a> loaded (' + count.toLocaleString() + ' words).';
            textInput.disabled = false;
            $('#text-input').trigger('input');
        })
        .catch(() => {
            setStatus(statusEl, 'error', 'Could not load wordFrequencyData.csv. Serve this page from a server or choose the CSV file below.');
            fileInputDiv.style.display = 'block';
        });

    document.getElementById('csv-file').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        setStatus(statusEl, 'loading', 'Loading…');
        loadFromFile(file)
            .then((count) => {
                statusEl.className = 'ready';
                statusEl.innerHTML = '<a href="' + FREQ_DATA_URL + '" target="_blank" rel="noopener">Word frequency data</a> loaded (' + count.toLocaleString() + ' words).';
                textInput.disabled = false;
                $('#text-input').trigger('input');
            })
            .catch(() => {
                setStatus(statusEl, 'error', 'Failed to parse CSV.');
            });
    });

    initPresets();
}

function initPresets() {
    const select = document.getElementById('text-preset');
    if (!select) return;

    function addPresetOption(filename) {
        const opt = document.createElement('option');
        opt.value = 'texts/' + encodeURI(filename);
        opt.textContent = filename.replace(/\.txt$/i, '');
        select.appendChild(opt);
    }

    function tryDirectoryListing() {
        return fetch('texts/')
            .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Not ok'))))
            .then((html) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = doc.querySelectorAll('a[href]');
                const seen = new Set();
                links.forEach((a) => {
                    let href = (a.getAttribute('href') || '').trim();
                    if (!/\.txt$/i.test(href)) return;
                    try {
                        href = decodeURIComponent(href);
                    } catch (e) {}
                    if (seen.has(href)) return;
                    seen.add(href);
                    addPresetOption(href);
                });
            });
    }

    fetch('texts/list.json')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No list'))))
        .then((filenames) => {
            if (Array.isArray(filenames)) {
                filenames.forEach((filename) => {
                    if (typeof filename === 'string' && filename.trim()) addPresetOption(filename.trim());
                });
            } else {
                return tryDirectoryListing();
            }
        })
        .catch(() => tryDirectoryListing());

    select.addEventListener('change', function () {
        const url = this.value;
        if (!url) return;
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load text');
                return res.text();
            })
            .then((text) => {
                $('#text-input').val(text).trigger('input');
            })
            .catch(() => {});
    });
}

$(document).ready(function () {
    initTheme();
    initApp();

    function processText() {
        const text = $('#text-input').val();
        const numWords = $('#num-words-slider').val();

        if (Object.keys(wordFrequency).length === 0) return;

        const doc = nlp(text);
        const words = doc.text().split(/\s+/);
        const wordFreq = {};
        const unknownWords = new Map();

        function stripLeadingTrailingPunctuation(s) {
            return s.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '') || s;
        }

        words.forEach(word => {
            const parts = word.split(/[^a-zA-Z']+/).filter(Boolean);
            parts.forEach((part) => {
                const normalized = part.toLowerCase().replace(/[^a-z]/g, '');
                if (!normalized) return;
                const displayForm = stripLeadingTrailingPunctuation(part);
                if (wordFrequency[normalized] !== undefined) {
                    wordFreq[normalized] = wordFrequency[normalized];
                } else {
                    if (!unknownWords.has(normalized)) {
                        unknownWords.set(normalized, displayForm);
                    }
                }
            });
        });

        const sortedFreq = Object.entries(wordFreq).sort((a, b) => a[1] - b[1]);
        const rarestWords = sortedFreq.slice(0, numWords).map(item => item[0]);
        const unknownSet = new Set(unknownWords.keys());
        const tableData = sortedFreq.map((item, index) => {
            const word = item[0];
            const logFrequency = item[1];
            const frequency = Math.exp(logFrequency);
            const inverseFreq = Math.round(1 / frequency);
            const zipf = (Math.log10(frequency) + 9).toFixed(2);
            return [index + 1, word, frequency.toExponential(1), inverseFreq, zipf];
        });

        highlightText(text, rarestWords, unknownSet);
        displayTable(tableData);
        displayUnknownWords(Array.from(unknownWords.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
    }

    $('#text-input').on('input', processText);

    $('#num-words-slider').on('input', function () {
        $('#slider-value').text($(this).val());
        processText();
    });

    function highlightText(text, rarestWords, unknownWordsSet) {
        const container = document.getElementById('highlighted-text');
        if (!container) return;
        container.replaceChildren();

        if (!text) return;

        // Single pass: find all word tokens (letters and apostrophes), then classify as rare, unknown, or neither.
        // XSS-safe: we only use match[0] as textContent, never innerHTML.
        const wordRegex = /\b[a-zA-Z']+\b/g;
        const rarestSet = new Set(Array.isArray(rarestWords) ? rarestWords.map(w => w.toLowerCase()) : []);
        const unknownSet = unknownWordsSet instanceof Set ? unknownWordsSet : new Set();

        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        while ((match = wordRegex.exec(text)) !== null) {
            const start = match.index;
            const end = wordRegex.lastIndex;
            if (start > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }

            const normalized = match[0].toLowerCase().replace(/[^a-z]/g, '');
            const span = document.createElement('span');
            span.dataset.word = match[0].toLowerCase();
            span.textContent = match[0]; // preserves original casing
            if (rarestSet.has(normalized)) {
                span.className = 'highlight';
            } else if (unknownSet.has(normalized)) {
                span.className = 'highlight highlight-unknown';
            } else {
                frag.appendChild(document.createTextNode(match[0]));
                lastIndex = end;
                continue;
            }
            frag.appendChild(span);

            lastIndex = end;
        }

        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        container.appendChild(frag);
    }

    const definitionCache = {};
    const DEFINITION_NOT_FOUND = '__NOT_FOUND__';
    let tooltipHoverTimer = null;

    function getSearchUrl(word) {
        return 'https://www.google.com/search?q=define+' + encodeURIComponent(word);
    }

    function fetchDefinition(word) {
        if (definitionCache[word] !== undefined) return Promise.resolve(definitionCache[word]);
        return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word))
            .then((res) => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then((data) => {
                const parts = [];
                const entry = Array.isArray(data) ? data[0] : data;
                if (!entry || !entry.meanings) throw new Error('No meanings');
                entry.meanings.slice(0, 3).forEach((m) => {
                    const def = m.definitions && m.definitions[0];
                    if (def && def.definition) {
                        const pos = m.partOfSpeech ? m.partOfSpeech + ': ' : '';
                        parts.push(pos + def.definition);
                    }
                });
                const text = parts.length ? parts.join('\n\n') : DEFINITION_NOT_FOUND;
                definitionCache[word] = text;
                return text;
            })
            .catch(() => {
                definitionCache[word] = DEFINITION_NOT_FOUND;
                return DEFINITION_NOT_FOUND;
            });
    }

    function showTooltip(el, word, openSearchIfNotFound) {
        const tip = document.getElementById('definition-tooltip');
        if (!tip) return;
        tip.innerHTML = '<span class="tooltip-loading">Loading…</span>';
        tip.classList.add('visible');
        tip.setAttribute('aria-hidden', 'false');
        const rect = el.getBoundingClientRect();
        const pad = 8;
        let left = rect.left;
        if (left + 336 > window.innerWidth - pad) left = window.innerWidth - 336 - pad;
        if (left < pad) left = pad;
        tip.style.left = left + 'px';
        const below = rect.bottom + 6;
        const above = rect.top - 4;
        if (below + 200 < window.innerHeight - pad) {
            tip.style.top = below + 'px';
        } else {
            tip.style.top = (above - 150) + 'px';
        }
        fetchDefinition(word).then((text) => {
            if (text === DEFINITION_NOT_FOUND) {
                const searchUrl = getSearchUrl(word);
                tip.innerHTML = '<div class="tooltip-word">' + escapeHtml(word) + '</div><div class="tooltip-error">Definition not found.</div><a href="' + escapeHtml(searchUrl) + '" target="_blank" rel="noopener" class="tooltip-search-link">Click to search online</a>';
                if (openSearchIfNotFound) window.open(searchUrl, '_blank', 'noopener');
            } else {
                tip.innerHTML = '<div class="tooltip-word">' + escapeHtml(word) + '</div><div>' + escapeHtml(text).replace(/\n\n/g, '</div><div>') + '</div>';
            }
        });
    }

    function hideTooltip() {
        const tip = document.getElementById('definition-tooltip');
        if (tip) {
            tip.classList.remove('visible');
            tip.setAttribute('aria-hidden', 'true');
        }
        if (tooltipHoverTimer) {
            clearTimeout(tooltipHoverTimer);
            tooltipHoverTimer = null;
        }
    }

    function showTooltipForWord(el, word) {
        if (!word) return;
        if (tooltipHoverTimer) clearTimeout(tooltipHoverTimer);
        tooltipHoverTimer = null;
        showTooltip(el, word, true);
    }

    function onWordHoverStart(el, word) {
        if (!word) return;
        tooltipHoverTimer = setTimeout(() => showTooltip(el, word, false), 400);
    }

    $('#highlighted-text').on('mouseenter', '.highlight', function () {
        const word = $(this).data('word');
        onWordHoverStart(this, word);
    });
    $('#highlighted-text').on('mouseleave', '.highlight', hideTooltip);
    $('#highlighted-text').on('click', '.highlight', function (e) {
        e.preventDefault();
        const word = $(this).data('word');
        showTooltipForWord(this, word);
    });

    $('#results-table').on('mouseenter', '.word-cell', function () {
        const word = $(this).data('word');
        onWordHoverStart(this, word);
    });
    $('#results-table').on('mouseleave', '.word-cell', hideTooltip);
    $('#results-table').on('click', '.word-cell', function (e) {
        e.preventDefault();
        const word = $(this).data('word');
        showTooltipForWord(this, word);
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.highlight').length && !$(e.target).closest('.word-cell').length && !$(e.target).closest('#definition-tooltip').length) hideTooltip();
    });

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function displayTable(data) {
        document.getElementById('word-col-header').textContent = `Word (${data.length})`;
        const tableBody = $('#results-table tbody');
        tableBody.empty();
        data.forEach(function (row) {
            const tr = $('<tr></tr>');
            row.forEach(function (cell, i) {
                const td = $('<td></td>').text(cell);
                if (i === 1) {
                    td.addClass('word-cell').attr('data-word', row[1]);
                }
                tr.append(td);
            });
            tableBody.append(tr);
        });
    }

    function displayUnknownWords(words) {
        const section = document.getElementById('unknown-words-section');
        const listEl = document.getElementById('unknown-words-list');
        if (!section || !listEl) return;
        if (words.length === 0) {
            section.style.display = 'none';
            listEl.textContent = '';
            return;
        }
        section.style.display = 'block';
        listEl.textContent = words.join(', ');
    }
});
