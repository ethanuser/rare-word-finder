const THEME_STORAGE_KEY = 'rare-word-finder-theme';
const FREQ_DATA_URL = 'https://www.kaggle.com/datasets/rtatman/english-word-frequency';
const DRAFT_STORAGE_KEY = 'rare-word-finder-draft';
const SLIDER_STORAGE_KEY = 'rare-word-finder-highlight-count';
const FORMS_STORAGE_KEY = 'rare-word-finder-word-forms';
const DEFINITION_NOT_FOUND = '__NOT_FOUND__';
const DEFINITION_UNREACHABLE = '__UNREACHABLE__';
const LARGE_TEXT_LENGTH = 20000;
const SAMPLE_CHIPS = ['The Raven', 'Jabberwocky', 'Gettysburg Address'];
const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024;

let wordFrequency = {};

const state = {
    result: null,
    rowByWord: new Map(),
    tab: 'rarest',
    filter: '',
    groupForms: true,
    dataReady: false,
    activePreset: '',
    selected: null,
    forcedKey: '',
    occurrences: [],
    occurrenceIndex: -1,
    markedUpTo: 0,
    definitionRequest: 0,
    analyzeTimer: null,
    draftTimer: null,
    hoverSpan: null,
    pointerType: 'mouse'
};

const definitionCache = {};
const presets = [];

const el = (id) => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const normalizeWord = (word) => word.toLowerCase().replace(/[^a-z]/g, '');
const getSearchUrl = (word) => 'https://www.google.com/search?q=define+' + encodeURIComponent(word);
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 0 });

function getSavedTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch (e) {
        return 'system';
    }
}

function readPref(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function writePref(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
}

function saveTheme(theme) {
    try {
        if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
}

// Radio group with arrow keys and one tab stop. The thumb, when present, is the only thing painting the selection.
function initRadioGroup(control, onSelect, options) {
    const { thumb: wantsThumb = true } = options || {};
    const radios = Array.from(control.querySelectorAll('[role="radio"]'));
    let thumb = null;

    function placeThumb(animate) {
        if (!thumb) return;
        const on = control.querySelector('[aria-checked="true"]');
        if (!on || !on.offsetWidth) return;
        thumb.classList.toggle('is-instant', !animate);
        thumb.style.width = on.offsetWidth + 'px';
        thumb.style.height = on.offsetHeight + 'px';
        thumb.style.transform = 'translate(' + on.offsetLeft + 'px, ' + on.offsetTop + 'px)';
    }

    function setValue(value) {
        radios.forEach((radio) => {
            const on = radio.dataset.value === value;
            radio.setAttribute('aria-checked', on);
            radio.tabIndex = on ? 0 : -1;
        });
        placeThumb(true);
    }

    if (wantsThumb) {
        thumb = document.createElement('span');
        thumb.className = 'segment-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        control.prepend(thumb);
        new ResizeObserver(() => placeThumb(false)).observe(control);
    }

    control.addEventListener('click', function (e) {
        const radio = e.target.closest('[role="radio"]');
        if (!radio || radio.disabled) return;
        setValue(radio.dataset.value);
        onSelect(radio.dataset.value);
    });

    control.addEventListener('keydown', function (e) {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const enabled = radios.filter((radio) => !radio.disabled);
        const next = enabled[(enabled.indexOf(e.target.closest('[role="radio"]')) + step + enabled.length) % enabled.length];
        next.focus();
        next.click();
    });

    placeThumb(false);
    return { setValue };
}

// Shared interface tooltip for anything with data-tip; a trailing "(X)" renders as a key cap.
function initUiTips() {
    const tip = el('ui-tip');
    let showTimer = null;
    let hideTimer = null;
    let lastHidden = 0;
    let current = null;

    function place(target) {
        const rect = target.getBoundingClientRect();
        const pad = 8;
        const left = Math.min(Math.max(pad, rect.left + (rect.width - tip.offsetWidth) / 2), window.innerWidth - tip.offsetWidth - pad);
        const below = rect.bottom + 6;
        const top = below + tip.offsetHeight > window.innerHeight - pad ? rect.top - tip.offsetHeight - 6 : below;
        tip.style.transform = 'translate(' + Math.round(left) + 'px, ' + Math.round(top) + 'px)';
    }

    function show(target) {
        clearTimeout(hideTimer);
        // Crossing an icon's inner shapes reports the same target again; leave the open tip alone.
        if (target === current && !tip.hidden) return;
        current = target;
        const match = target.dataset.tip.match(/^(.*) \((.+)\)$/);
        tip.textContent = match ? match[1] : target.dataset.tip;
        if (match) {
            const key = document.createElement('kbd');
            key.textContent = match[2];
            tip.appendChild(key);
        }
        const host = target.closest('dialog') || document.body;
        if (tip.parentElement !== host) host.appendChild(tip);
        tip.hidden = false;
        place(target);
    }

    function hide() {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        if (!tip.hidden) lastHidden = Date.now();
        tip.hidden = true;
        current = null;
    }

    document.addEventListener('pointerover', function (e) {
        if (e.pointerType === 'touch') return;
        const target = e.target.closest('[data-tip]');
        if (!target) return;
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        const warm = !tip.hidden || Date.now() - lastHidden < 600;
        if (warm) show(target);
        else showTimer = setTimeout(() => show(target), 400);
    });

    document.addEventListener('pointerout', function (e) {
        const target = e.target.closest('[data-tip]');
        if (!target || target.contains(e.relatedTarget)) return;
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 150);
    });

    document.addEventListener('focusin', function (e) {
        const target = e.target.closest('[data-tip]');
        if (target && target.matches(':focus-visible')) show(target);
    });

    // Column headers explain themselves on touch too, where nothing hovers.
    document.addEventListener('click', function (e) {
        const target = e.target.closest('[data-tip-tap]');
        if (target && state.pointerType === 'touch') show(target);
    });

    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', function (e) {
        state.pointerType = e.pointerType;
        hide();
    });
    document.addEventListener('keydown', hide);
    window.addEventListener('scroll', hide, true);
}

function showToast(message, options) {
    const { error = false, action = '', onAction = null } = options || {};
    const stack = el('toast-stack');
    const toast = document.createElement('div');
    toast.className = error ? 'toast is-error' : 'toast';
    toast.textContent = message;
    const dismiss = () => toast.remove();
    if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action;
        button.addEventListener('click', onAction);
        toast.appendChild(button);
    }
    toast.addEventListener('click', dismiss);
    stack.appendChild(toast);
    while (stack.children.length > 3) stack.firstChild.remove();
    setTimeout(dismiss, error || action ? 6000 : 2600);
}

// Confirms in place: the icon becomes a check, then returns.
function confirmOn(button) {
    const use = button.querySelector('use');
    clearTimeout(button.confirmTimer);
    if (!button.restoreIcon) button.restoreIcon = use.getAttribute('href');
    use.setAttribute('href', '#i-check');
    button.classList.add('is-confirmed');
    button.confirmTimer = setTimeout(() => {
        use.setAttribute('href', button.restoreIcon);
        button.classList.remove('is-confirmed');
        button.restoreIcon = null;
    }, 1600);
}

function copyText(text, button) {
    navigator.clipboard.writeText(text)
        .then(() => confirmOn(button))
        .catch(() => showToast('Could not copy to the clipboard', { error: true }));
}

function parseCSV(csvText) {
    return typeof RareWordAnalyzer !== 'undefined' && RareWordAnalyzer.parseFrequencyCSV
        ? RareWordAnalyzer.parseFrequencyCSV(csvText)
        : {};
}

function setStatus(status, message) {
    const statusEl = el('load-status');
    statusEl.className = status;
    statusEl.textContent = message;
}

function enableEditor() {
    el('text-input').disabled = false;
    el('csv-file-input').hidden = true;
    state.dataReady = true;
    setControlsEnabled();
}

function setDataReady() {
    const statusEl = el('load-status');
    const count = Object.keys(wordFrequency).length;
    statusEl.className = 'ready';
    statusEl.innerHTML = '<a href="' + FREQ_DATA_URL + '" target="_blank" rel="noopener">Word frequency data</a> loaded (' + count.toLocaleString() + ' words).';
    enableEditor();
    processText();
}

function loadFromURL(url) {
    return fetch(url).then(response => {
        if (!response.ok) throw new Error('Failed to load CSV');
        return response.text();
    }).then(parseCSV);
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// The common words make the app usable quickly; the long tail follows in the background.
function initData() {
    loadFromURL('data/words-common.csv')
        .then((words) => {
            wordFrequency = words;
            setStatus('loading', 'Loading the full word list…');
            enableEditor();
            restoreDraft();
            return loadFromURL('data/words-rest.csv')
                .then((rest) => {
                    Object.assign(wordFrequency, rest);
                    setDataReady();
                })
                .catch(() => {
                    setStatus('error', 'Using the most common words only. The full word list could not load.');
                });
        })
        .catch(() => {
            setStatus('error', 'Could not load the word list. Serve this page from a server or choose a frequency CSV.');
            el('csv-file-input').hidden = false;
        });

    el('csv-file').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        setStatus('loading', 'Loading…');
        readFile(file)
            .then((csvText) => {
                wordFrequency = parseCSV(csvText);
                setDataReady();
            })
            .catch(() => {
                setStatus('error', 'Failed to parse CSV.');
            });
    });
}

/* Text */

// Everything that replaces the whole text goes through here so it can be undone.
function replaceText(text, source) {
    const previousText = el('text-input').value;
    const replacingOwnText = !state.activePreset && previousText.trim();
    state.activePreset = source.preset || '';
    setEditorText(text);
    if (replacingOwnText) {
        showToast(source.message, {
            action: 'Undo',
            onAction() {
                state.activePreset = '';
                setEditorText(previousText);
            }
        });
    }
}

function setEditorText(text) {
    const input = el('text-input');
    input.value = text;
    input.scrollTop = 0;
    closeDetail();
    syncLibrary();
    processText();
}

function saveDraftSoon() {
    clearTimeout(state.draftTimer);
    state.draftTimer = setTimeout(function () {
        const text = el('text-input').value;
        const draft = state.activePreset ? { preset: state.activePreset } : { text };
        try {
            if (text) localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
            else localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (e) {}
    }, 500);
}

function restoreDraft() {
    let draft = null;
    try {
        draft = JSON.parse(readPref(DRAFT_STORAGE_KEY));
    } catch (e) {}
    if (!draft) {
        processText();
    } else if (draft.preset) {
        fetch(draft.preset)
            .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed to load text'))))
            .then((text) => {
                state.activePreset = draft.preset;
                setEditorText(text);
            })
            .catch(() => processText());
    } else {
        setEditorText(draft.text || '');
    }
}

function loadPreset(preset) {
    const label = el('library-label');
    const previousLabel = label.textContent;
    const busyTimer = setTimeout(() => {
        label.textContent = 'Loading…';
    }, 150);
    fetch(preset.url)
        .then((res) => {
            if (!res.ok) throw new Error('Failed to load text');
            return res.text();
        })
        .then((text) => {
            replaceText(text, { preset: preset.url, message: 'Replaced your text with ' + preset.name });
        })
        .catch(() => {
            label.textContent = previousLabel;
            showToast('Could not load ' + preset.name, { error: true });
        })
        .finally(() => {
            clearTimeout(busyTimer);
            syncLibrary();
        });
}

function openTextFile(file) {
    if (!file) return;
    if (file.size > MAX_TEXT_FILE_BYTES || !(file.type.startsWith('text/') || /\.txt$/i.test(file.name))) {
        showToast('Choose a plain text file under 10 MB', { error: true });
        return;
    }
    readFile(file)
        .then((text) => replaceText(text, { message: 'Replaced your text with ' + file.name }))
        .catch(() => showToast('Could not read ' + file.name, { error: true }));
}

function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        focusEditorForPaste();
        return;
    }
    navigator.clipboard.readText()
        .then((text) => {
            if (text.trim()) replaceText(text, { message: 'Replaced your text with the clipboard' });
            else showToast('The clipboard has no text');
        })
        .catch(focusEditorForPaste);
}

function focusEditorForPaste() {
    el('text-input').focus();
    showToast('Press ' + (isMac ? '⌘V' : 'Ctrl+V') + ' to paste');
}

function setControlsEnabled() {
    const hasText = !!el('text-input').value.trim();
    const dataReady = !el('text-input').disabled;
    el('paste-button').disabled = !dataReady;
    el('open-button').disabled = !dataReady;
    el('empty-paste').disabled = !dataReady;
    el('empty-open').disabled = !dataReady;
    el('clear-button').disabled = !hasText;
    el('copy-button').disabled = !hasText;
    el('download-button').disabled = !hasText;
    el('empty-state').hidden = hasText;
}

function setView(view) {
    el('app').dataset.view = view;
    viewControl.setValue(view);
    if (view === 'text') showOccurrence(true);
}

/* Analysis */

function getSliderValue() {
    return parseInt(el('num-words-slider').value, 10) || 10;
}

function processText() {
    const text = el('text-input').value;
    const numWords = getSliderValue();

    setControlsEnabled();
    saveDraftSoon();
    if (!state.dataReady) return;
    if (typeof RareWordAnalyzer === 'undefined' || !RareWordAnalyzer.analyzeText) {
        return;
    }

    const result = RareWordAnalyzer.analyzeText(text, wordFrequency, { topRarest: numWords, groupForms: state.groupForms });
    state.result = result;
    state.rowByWord = new Map(result.tableData.map((row) => [row[1], row]));

    if (state.selected && !state.rowByWord.has(state.selected.key) && !result.unknownSet.has(state.selected.key)) {
        closeDetail();
    }

    highlightText(text, result.rarestWords, result.unknownSet);
    renderWordList();
    renderCounts();
    refreshOccurrences();
}

// The table is already sorted rarest first, so the slider needs no re-analysis.
function applySlider() {
    if (!state.result) return;
    const numWords = getSliderValue();
    writePref(SLIDER_STORAGE_KEY, numWords);
    const rarestWords = state.result.tableData.slice(0, numWords).map((row) => row[1]);
    highlightText(el('text-input').value, rarestWords, state.result.unknownSet);
    markWordRows(numWords);
    refreshOccurrences();
}

// At most one render per frame; a full analysis outranks a slider update.
let queuedRender = null;
function queueRender(render) {
    if (!queuedRender) {
        requestAnimationFrame(() => {
            const next = queuedRender;
            queuedRender = null;
            next();
        });
    }
    queuedRender = queuedRender === processText ? processText : render;
}

function updateSliderFill(slider) {
    const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    slider.style.setProperty('--fill', 'calc(' + percent + '% + ' + (8 - percent * 0.16) + 'px)');
}

function highlightText(text, rarestWords, unknownWordsSet) {
    const container = el('highlighted-text');
    if (!text) {
        container.replaceChildren();
        return;
    }

    // Single pass: find all word tokens (letters and apostrophes), then classify as rare, unknown, or neither.
    // Plain words stay inside one text run, so the node count follows the highlights, not the text length.
    // XSS-safe: we only use match[0] as textContent, never innerHTML.
    const wordRegex = /\b[a-zA-Z']+\b/g;
    const rarestSet = new Set(Array.isArray(rarestWords) ? rarestWords.map(w => w.toLowerCase()) : []);
    const unknownSet = unknownWordsSet instanceof Set ? unknownWordsSet : new Set();
    const baseForms = state.result.baseForms;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
        const normalized = normalizeWord(match[0]);
        const key = baseForms.get(normalized) || normalized;
        let className = '';
        if (rarestSet.has(key)) {
            className = 'highlight';
        } else if (unknownSet.has(normalized)) {
            className = 'highlight highlight-unknown';
        } else if (key === state.forcedKey) {
            className = 'highlight highlight-forced';
        } else {
            continue;
        }

        if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const span = document.createElement('span');
        span.className = className;
        span.dataset.key = key;
        span.dataset.word = match[0].toLowerCase();
        span.dataset.start = match.index;
        span.textContent = match[0]; // preserves original casing
        frag.appendChild(span);

        lastIndex = wordRegex.lastIndex;
    }

    // The trailing newline keeps this layer as tall as the editor when the text ends on a blank line.
    frag.appendChild(document.createTextNode(text.slice(lastIndex) + '\n'));

    container.replaceChildren(frag);
    syncHighlightScroll();
}

function syncHighlightScroll() {
    el('highlighted-text').scrollTop = el('text-input').scrollTop;
}

function renderCounts() {
    const { tableData, unknownWords, stats } = state.result;
    const statsEl = el('text-stats');
    statsEl.replaceChildren();
    if (stats.totalWords) {
        const rareShare = (stats.rareShare * 100).toFixed(1) + '%';
        [
            [stats.totalWords.toLocaleString() + ' words'],
            [(tableData.length + unknownWords.length).toLocaleString() + ' unique'],
            ['Rare words ' + rareShare, 'Share of known words with a Zipf value below 3']
        ].forEach(([label, tip]) => {
            const item = document.createElement('span');
            item.textContent = label;
            if (tip) {
                item.dataset.tip = tip;
                item.dataset.tipTap = '';
            }
            statsEl.appendChild(item);
        });
    }
    el('rarest-count').textContent = tableData.length ? tableData.length.toLocaleString() : '';
    el('unknown-count').textContent = unknownWords.length ? unknownWords.length.toLocaleString() : '';
}

/* Word list */

function getVisibleRows() {
    if (!state.result) return [];
    const filter = normalizeWord(state.filter);
    const matches = (word) => !filter || normalizeWord(word).includes(filter);
    if (state.tab === 'rarest') return state.result.tableData.filter((row) => matches(row[1]));
    return state.result.unknownWords.filter(matches).map((word) => [0, word]);
}

function buildWordRow(row, index) {
    const [rank, word, , inverseFrequency, zipf] = row;
    const li = document.createElement('li');
    li.className = 'word-row';
    li.setAttribute('role', 'option');
    li.dataset.key = normalizeWord(word);
    li.dataset.word = word;
    li.tabIndex = index === 0 ? 0 : -1;
    li.setAttribute('aria-selected', !!state.selected && state.selected.key === li.dataset.key);

    const name = document.createElement('span');
    name.className = 'word-name';
    name.textContent = word;

    if (!rank) {
        li.classList.add('is-plain');
        li.appendChild(name);
        return li;
    }

    li.dataset.rank = rank;
    const rankEl = document.createElement('span');
    rankEl.className = 'word-rank';
    rankEl.textContent = rank;
    const frequency = document.createElement('span');
    frequency.className = 'word-frequency';
    frequency.textContent = '1 in ' + compactNumber.format(inverseFrequency);
    const zipfEl = document.createElement('span');
    zipfEl.className = 'word-zipf';
    zipfEl.textContent = zipf;
    li.append(rankEl, name, frequency, zipfEl);
    return li;
}

function renderWordList() {
    const rows = getVisibleRows();
    const frag = document.createDocumentFragment();
    rows.forEach((row, index) => frag.appendChild(buildWordRow(row, index)));
    el('word-list').replaceChildren(frag);
    el('word-columns').hidden = state.tab !== 'rarest' || rows.length === 0;
    state.markedUpTo = 0;
    if (state.tab === 'rarest') markWordRows(getSliderValue());

    const hasText = !!el('text-input').value.trim();
    let emptyMessage = 'Words from your text appear here, rarest first.';
    if (hasText && state.filter) emptyMessage = 'No words match this filter.';
    else if (hasText && state.tab === 'unknown') emptyMessage = 'Every word is in the database.';
    else if (hasText) emptyMessage = 'No words found in this text.';
    el('word-list-empty').textContent = emptyMessage;
}

// Rows run in rank order, so only those between the old and new slider positions change.
function markWordRows(count) {
    if (state.tab !== 'rarest') return;
    const highest = Math.max(count, state.markedUpTo);
    for (const row of el('word-list').children) {
        const rank = Number(row.dataset.rank);
        if (rank > highest) break;
        row.classList.toggle('is-marked', rank <= count);
    }
    state.markedUpTo = count;
}

function getListCsv() {
    if (state.tab === 'unknown') return ['Word'].concat(state.result.unknownWords).join('\n');
    const header = 'Rank,Word,Frequency in English,1 / Frequency,Zipf Value';
    return [header].concat(state.result.tableData.map((row) => row.join(','))).join('\n');
}

function downloadList() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([getListCsv()], { type: 'text/csv' }));
    link.download = state.tab === 'unknown' ? 'words-not-in-database.csv' : 'rare-words.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    confirmOn(el('download-button'));
}

/* Word detail */

function fetchDefinition(word) {
    if (definitionCache[word] !== undefined) return Promise.resolve(definitionCache[word]);
    const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word);
    return fetch(url)
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
                    parts.push({ pos: m.partOfSpeech || '', definition: def.definition });
                }
            });
            const result = parts.length ? parts : DEFINITION_NOT_FOUND;
            definitionCache[word] = result;
            return result;
        })
        // The API sends its 404s without CORS headers, so a missing word looks like a network failure.
        // An opaque request tells them apart: it only fails when the server can't be reached.
        .catch(() => fetch(url, { mode: 'no-cors' }).then(
            () => {
                definitionCache[word] = DEFINITION_NOT_FOUND;
                return DEFINITION_NOT_FOUND;
            },
            () => DEFINITION_UNREACHABLE
        ));
}

function renderStats(key) {
    const stats = el('detail-stats');
    stats.replaceChildren();
    const row = state.rowByWord.get(key);
    const items = row
        ? [['Rank', row[0].toLocaleString()], ['Zipf', row[4]], ['1 in', row[3].toLocaleString()], ['Frequency', row[2]]]
        : [['Not in the frequency database', '']];
    items.forEach(([label, value]) => {
        const item = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const detail = document.createElement('dd');
        detail.textContent = value;
        item.append(term, detail);
        stats.appendChild(item);
    });
}

function renderForms(key) {
    const forms = (state.result.forms[key] || []).filter((form) => form !== key);
    el('detail-forms').hidden = forms.length === 0;
    el('detail-forms').textContent = 'In your text as ' + forms.join(', ');
}

function renderDefinition(word) {
    const body = el('detail-body');
    const request = ++state.definitionRequest;
    body.replaceChildren();
    const loadingTimer = setTimeout(() => {
        const note = document.createElement('p');
        note.className = 'detail-note';
        note.textContent = 'Looking up…';
        body.replaceChildren(note);
    }, 150);

    fetchDefinition(word).then((definition) => {
        clearTimeout(loadingTimer);
        if (request !== state.definitionRequest) return;
        if (definition === DEFINITION_NOT_FOUND) {
            const note = document.createElement('p');
            note.className = 'detail-note';
            note.textContent = 'No dictionary definition found. Use the search button to look it up online.';
            body.replaceChildren(note);
            return;
        }
        if (definition === DEFINITION_UNREACHABLE) {
            const note = document.createElement('p');
            note.className = 'detail-note';
            note.textContent = 'Can’t reach the dictionary right now.';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'button detail-retry';
            retry.textContent = 'Try again';
            retry.addEventListener('click', () => renderDefinition(word));
            body.replaceChildren(note, retry);
            return;
        }
        body.replaceChildren(...definition.map((part) => {
            const line = document.createElement('p');
            line.className = 'detail-def';
            if (part.pos) {
                const pos = document.createElement('span');
                pos.className = 'detail-pos';
                pos.textContent = part.pos;
                line.appendChild(pos);
            }
            line.appendChild(document.createTextNode(part.definition));
            return line;
        }));
    });
}

function selectWord(key, word, options) {
    const { fromText = null } = options || {};
    state.selected = { key, word };
    el('word-detail').hidden = false;
    el('detail-word').textContent = word;
    el('detail-search').href = getSearchUrl(word);
    renderStats(key);
    renderForms(key);
    renderDefinition(word);

    // A word picked in the text brings its own list into view.
    const wordTab = state.rowByWord.has(key) ? 'rarest' : 'unknown';
    if (fromText && state.tab !== wordTab) {
        state.tab = wordTab;
        listControl.setValue(wordTab);
        renderWordList();
    }

    for (const row of el('word-list').querySelectorAll('[aria-selected="true"]')) {
        row.setAttribute('aria-selected', 'false');
    }
    const row = el('word-list').querySelector('[data-key="' + key + '"]');
    if (row) {
        row.setAttribute('aria-selected', 'true');
        if (fromText) row.scrollIntoView({ block: 'nearest' });
    }

    // Words beyond the slider have no marks yet; add them while selected.
    const needsMarks = !el('highlighted-text').querySelector('[data-key="' + key + '"]');
    if (state.forcedKey !== key && (needsMarks || state.forcedKey)) {
        state.forcedKey = needsMarks ? key : '';
        if (state.result) applySlider();
    } else {
        refreshOccurrences();
    }

    if (fromText) {
        state.occurrenceIndex = state.occurrences.findIndex((span) => span.dataset.start === fromText.dataset.start);
        showOccurrence(false);
    } else if (state.occurrences.length) {
        state.occurrenceIndex = 0;
        showOccurrence(true);
    }
}

function closeDetail() {
    if (!state.selected) return;
    state.selected = null;
    state.definitionRequest++;
    el('word-detail').hidden = true;
    for (const row of el('word-list').querySelectorAll('[aria-selected="true"]')) {
        row.setAttribute('aria-selected', 'false');
    }
    const hadForced = !!state.forcedKey;
    state.forcedKey = '';
    if (hadForced && state.result) applySlider();
    else refreshOccurrences();
}

function refreshOccurrences() {
    for (const span of el('highlighted-text').querySelectorAll('.is-selected')) {
        span.classList.remove('is-selected', 'is-current');
    }
    state.occurrences = state.selected
        ? Array.from(el('highlighted-text').querySelectorAll('[data-key="' + state.selected.key + '"]'))
        : [];
    state.occurrences.forEach((span) => span.classList.add('is-selected'));
    if (state.occurrenceIndex >= state.occurrences.length) state.occurrenceIndex = state.occurrences.length ? 0 : -1;
    renderOccurrenceCount();
}

function renderOccurrenceCount() {
    const total = state.occurrences.length;
    el('detail-occurrences').hidden = total === 0;
    el('occurrence-count').textContent = total === 1
        ? '1 place in your text'
        : (state.occurrenceIndex + 1) + ' of ' + total.toLocaleString() + ' in your text';
    el('occurrence-prev').disabled = total < 2;
    el('occurrence-next').disabled = total < 2;
}

function showOccurrence(scroll) {
    for (const span of el('highlighted-text').querySelectorAll('.is-current')) span.classList.remove('is-current');
    const span = state.occurrences[state.occurrenceIndex];
    if (span) {
        span.classList.add('is-current');
        const input = el('text-input');
        if (scroll && input.offsetParent) {
            // A long smooth scroll outruns painting and flashes an empty pane, so far jumps are instant.
            const top = span.offsetTop - input.clientHeight / 2;
            const nearby = Math.abs(top - input.scrollTop) < input.clientHeight * 2;
            input.scrollTo({ top, behavior: nearby && !reducedMotion() ? 'smooth' : 'auto' });
        }
    }
    renderOccurrenceCount();
}

function stepOccurrence(step) {
    const total = state.occurrences.length;
    if (!total) return;
    state.occurrenceIndex = (state.occurrenceIndex + step + total) % total;
    setView('text');
    showOccurrence(true);
}

/* Library */

function addPreset(filename) {
    const name = filename.replace(/\.txt$/i, '');
    presets.push({ url: 'texts/' + encodeURI(filename), name });
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'menu-option';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.tabIndex = -1;
    option.dataset.url = presets[presets.length - 1].url;
    option.textContent = name;
    el('library-menu').appendChild(option);

    if (SAMPLE_CHIPS.includes(name)) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = name;
        chip.dataset.url = presets[presets.length - 1].url;
        el('sample-chips').appendChild(chip);
    }
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
                addPreset(href);
            });
        });
}

function syncLibrary() {
    const preset = presets.find((item) => item.url === state.activePreset);
    el('library-label').textContent = preset ? preset.name : 'Library';
    el('library-button').dataset.tip = preset ? preset.name : 'Sample texts';
    for (const option of el('library-menu').children) {
        option.setAttribute('aria-selected', option.dataset.url === state.activePreset);
    }
}

function setLibraryOpen(open) {
    const menu = el('library-menu');
    menu.hidden = !open;
    el('library-button').setAttribute('aria-expanded', open);
    if (!open) return;
    const current = menu.querySelector('[aria-selected="true"]') || menu.firstElementChild;
    if (current) current.focus();
}

function initLibrary() {
    fetch('texts/list.json')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No list'))))
        .then((filenames) => {
            if (Array.isArray(filenames)) {
                filenames.forEach((filename) => {
                    if (typeof filename === 'string' && filename.trim()) addPreset(filename.trim());
                });
            } else {
                return tryDirectoryListing();
            }
        })
        .catch(() => tryDirectoryListing())
        .then(syncLibrary);

    const menu = el('library-menu');
    const button = el('library-button');

    button.addEventListener('click', () => setLibraryOpen(menu.hidden));

    menu.addEventListener('click', function (e) {
        const option = e.target.closest('.menu-option');
        if (!option) return;
        setLibraryOpen(false);
        button.focus();
        loadPreset(presets.find((item) => item.url === option.dataset.url));
    });

    menu.addEventListener('keydown', function (e) {
        const options = Array.from(menu.children);
        const index = options.indexOf(document.activeElement);
        let next = null;
        if (e.key === 'ArrowDown') next = options[Math.min(index + 1, options.length - 1)];
        else if (e.key === 'ArrowUp') next = options[Math.max(index - 1, 0)];
        else if (e.key === 'Home') next = options[0];
        else if (e.key === 'End') next = options[options.length - 1];
        else if (e.key === 'Escape' || e.key === 'Tab') {
            e.stopPropagation();
            setLibraryOpen(false);
            button.focus();
            if (e.key === 'Escape') e.preventDefault();
            return;
        }
        if (next) {
            e.preventDefault();
            next.focus();
        }
    });

    document.addEventListener('pointerdown', function (e) {
        if (!menu.hidden && !e.target.closest('.menu-anchor')) setLibraryOpen(false);
    });

    el('sample-chips').addEventListener('click', function (e) {
        const chip = e.target.closest('.chip');
        if (chip) loadPreset(presets.find((item) => item.url === chip.dataset.url));
    });
}

/* Events */

// One tab stop per list; arrow keys move between its items.
function bindRovingWords(container, selector, onActivate) {
    container.addEventListener('click', function (e) {
        const item = e.target.closest(selector);
        if (item) onActivate(item);
    });

    container.addEventListener('keydown', function (e) {
        const item = e.target.closest(selector);
        if (!item) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate(item);
            return;
        }
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const items = Array.from(container.querySelectorAll(selector));
        const next = items[items.indexOf(item) + step];
        if (!next) return;
        item.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
    });
}

function spanAtPoint(x, y) {
    for (const span of el('highlighted-text').children) {
        for (const rect of span.getClientRects()) {
            if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) return span;
        }
        if (span.getBoundingClientRect().top > y) return null;
    }
    return null;
}

function selectSpan(span) {
    const key = span.dataset.key;
    selectWord(key, state.rowByWord.has(key) ? key : span.dataset.word, { fromText: span });
}

function setHoverSpan(span) {
    if (state.hoverSpan === span) return;
    if (state.hoverSpan) state.hoverSpan.classList.remove('is-hover');
    state.hoverSpan = span;
    if (span) span.classList.add('is-hover');
    el('text-input').classList.toggle('is-over-word', !!span);
}

// The editor sits on top of the highlights, so clicks are matched to them by position.
function initEditorWords() {
    const input = el('text-input');
    let hoverQueued = false;
    let lastPointer = null;
    let touchStart = null;

    input.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        lastPointer = e;
        if (hoverQueued) return;
        hoverQueued = true;
        requestAnimationFrame(() => {
            hoverQueued = false;
            setHoverSpan(spanAtPoint(lastPointer.clientX, lastPointer.clientY));
        });
    });
    input.addEventListener('pointerleave', () => setHoverSpan(null));

    input.addEventListener('click', function (e) {
        if (input.selectionStart !== input.selectionEnd) return;
        const span = spanAtPoint(e.clientX, e.clientY);
        if (span) selectSpan(span);
    });

    // A tap on a highlight shows its details without bringing up the keyboard.
    input.addEventListener('touchstart', function (e) {
        touchStart = e.touches.length === 1 ? e.touches[0] : null;
    }, { passive: true });
    input.addEventListener('touchend', function (e) {
        const touch = e.changedTouches[0];
        if (!touchStart || Math.hypot(touch.clientX - touchStart.clientX, touch.clientY - touchStart.clientY) > 10) return;
        const span = spanAtPoint(touch.clientX, touch.clientY);
        if (!span) return;
        e.preventDefault();
        selectSpan(span);
    });

    input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
        const caret = input.selectionStart;
        const span = Array.from(el('highlighted-text').children).find((item) => {
            const start = Number(item.dataset.start);
            return caret >= start && caret <= start + item.textContent.length;
        });
        if (!span) return;
        e.preventDefault();
        selectSpan(span);
    });

    input.addEventListener('scroll', function () {
        syncHighlightScroll();
        setHoverSpan(null);
    });
}

function initInstall() {
    let installPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        installPrompt = e;
        el('install-button').hidden = false;
    });
    el('install-button').addEventListener('click', function () {
        installPrompt.prompt();
        installPrompt = null;
        this.hidden = true;
    });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

function initDragAndDrop() {
    const pane = el('text-pane');
    let depth = 0;
    pane.addEventListener('dragenter', function (e) {
        e.preventDefault();
        depth++;
        pane.classList.add('is-dragging');
    });
    pane.addEventListener('dragover', (e) => e.preventDefault());
    pane.addEventListener('dragleave', function () {
        depth--;
        if (depth === 0) pane.classList.remove('is-dragging');
    });
    pane.addEventListener('drop', function (e) {
        e.preventDefault();
        depth = 0;
        pane.classList.remove('is-dragging');
        if (e.dataTransfer.files.length) openTextFile(e.dataTransfer.files[0]);
    });
}

function initShortcuts() {
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (state.selected && !el('settings-dialog').open) closeDetail();
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest('input, textarea, dialog')) return;
        if (e.key === '/') {
            e.preventDefault();
            setView('words');
            el('word-filter').focus();
        }
    });
}

const viewControl = initRadioGroup(el('view-control'), setView, { thumb: false });
let listControl = null;

function init() {
    const themeControl = initRadioGroup(el('theme-control'), function (theme) {
        if (theme === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', theme);
        saveTheme(theme);
    });
    themeControl.setValue(getSavedTheme());

    listControl = initRadioGroup(el('list-control'), function (tab) {
        state.tab = tab;
        renderWordList();
    });

    const formsControl = initRadioGroup(el('forms-control'), function (value) {
        state.groupForms = value === 'on';
        writePref(FORMS_STORAGE_KEY, value);
        closeDetail();
        processText();
    });
    if (readPref(FORMS_STORAGE_KEY) === 'off') {
        state.groupForms = false;
        formsControl.setValue('off');
    }

    const savedCount = readPref(SLIDER_STORAGE_KEY);
    if (savedCount) {
        el('num-words-slider').value = savedCount;
        el('slider-value').textContent = el('num-words-slider').value;
    }

    el('modifier-key').textContent = isMac ? '⌘' : 'Ctrl';

    initUiTips();
    initData();
    initLibrary();
    initEditorWords();
    initDragAndDrop();
    initShortcuts();
    initInstall();
    updateSliderFill(el('num-words-slider'));
    renderWordList();
    setControlsEnabled();

    el('text-input').addEventListener('input', function () {
        state.activePreset = '';
        syncLibrary();
        clearTimeout(state.analyzeTimer);
        // Long texts wait for a pause in typing, because each analysis takes a noticeable moment.
        if (this.value.length > LARGE_TEXT_LENGTH) state.analyzeTimer = setTimeout(() => queueRender(processText), 200);
        else queueRender(processText);
    });

    el('num-words-slider').addEventListener('input', function () {
        el('slider-value').textContent = this.value;
        updateSliderFill(this);
        queueRender(applySlider);
    });

    el('word-filter').addEventListener('input', function () {
        state.filter = this.value;
        renderWordList();
    });

    el('paste-button').addEventListener('click', pasteFromClipboard);
    el('empty-paste').addEventListener('click', pasteFromClipboard);
    el('open-button').addEventListener('click', () => el('text-file').click());
    el('empty-open').addEventListener('click', () => el('text-file').click());
    el('text-file').addEventListener('change', function () {
        openTextFile(this.files[0]);
        this.value = '';
    });
    el('clear-button').addEventListener('click', () => replaceText('', { message: 'Text cleared' }));

    el('copy-button').addEventListener('click', function () {
        copyText(getVisibleRows().map((row) => row[1]).join('\n'), this);
    });
    el('download-button').addEventListener('click', downloadList);
    el('detail-copy').addEventListener('click', function () {
        copyText(state.selected.word, this);
    });
    el('detail-close').addEventListener('click', closeDetail);
    el('occurrence-prev').addEventListener('click', () => stepOccurrence(-1));
    el('occurrence-next').addEventListener('click', () => stepOccurrence(1));

    bindRovingWords(el('word-list'), '.word-row', (row) => selectWord(row.dataset.key, row.dataset.word));

    const dialog = el('settings-dialog');
    el('settings-button').addEventListener('click', () => dialog.showModal());
    el('settings-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) dialog.close();
    });
}

init();
