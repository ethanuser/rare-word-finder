# Rare Word Finder

A web app that highlights rare words in any text using English word-frequency data (~333k words). Click a highlighted word, or any word in the list, to see its definition and where it appears in your text.

---

## How to run

1. **Serve the app over HTTP** (required for loading the frequency CSV and preset texts):
   ```bash
   python3 -m http.server 8000
   ```
2. Open **http://localhost:8000** in a browser.

If you open `index.html` as a file (`file://`), the app will prompt you to load a frequency CSV manually and preset texts won’t appear in the Library.

---

## Features

- **One workspace** – A live editor on the left, words on the right, and a detail card for the selected word. On phones the Text and Words views sit behind a bottom tab bar, and the card opens as a sheet.

- **Live highlighting** – Rare words are marked in place as you type. **Yellow** marks the rarest words in the frequency dataset and **pink** marks words not in it. The slider sets how many rare words are marked, and the same words are marked in the word list.

- **Getting text in** – Type, paste from the clipboard, open a `.txt` file, drag one onto the text pane, or pick a sample from the Library. Replacing your own text offers Undo, and your text is saved in the browser so it survives a refresh.

- **Word list** – Every unique word from your text, rarest first, with labelled **Rank**, **Frequency** and **Zipf** columns (tap or hover a heading for its meaning). A second tab lists words not in the database. The app splits on spaces, then on punctuation and dashes, so tokens like `baby—the` or `four-fifths` are treated as separate words. Filter with `/`, copy the list, or download it as CSV.

- **Word forms** – Inflected forms count as one word by default, so `gloated` and `gloating` are listed under `gloat`. Settings can count them separately.

- **Word details** – Click a highlighted word, press Ctrl/⌘+Enter with the cursor on it, or pick it from the list to see its definition (via [Free Dictionary API](https://dictionaryapi.dev/)), statistics, forms and buttons to step through where it appears. A button opens a Google “define …” search in a new tab. If the dictionary can't be reached, the card says so and offers Try again.

- **Rare words share** – The status bar shows the share of known words in your text with a Zipf value below 3, a quick way to compare texts.

- **Works offline** – Once loaded, a service worker keeps the app and word list available offline, and supporting browsers can install it. Definitions still need a connection.

- **Preset texts** – The Library loads texts from the `texts/` folder. The included preset texts are from [Project Gutenberg](https://www.gutenberg.org/). On GitHub Pages (and other static hosts) the app uses `texts/list.json` to list presets; when adding a new `.txt` file, add its filename to that array. When served locally with a server that returns directory listings (e.g. Python’s `http.server`), the app can fall back to discovering `.txt` files automatically if `list.json` is missing.

- **Light / dark mode** – Follows system preference by default; **Settings and about** overrides it and the choice is saved in `localStorage`.

- **Word frequency data source** – The status bar shows “Word frequency data loaded (N words).” with a link to the [Kaggle English word frequency dataset](https://www.kaggle.com/datasets/rtatman/english-word-frequency).

---

## Package

The analysis logic (parse frequency CSV, find rarest/unknown words, table data) lives in **[rare-word-analyzer](packages/rare-word-analyzer)**. The app loads it via a script tag; you can also use it in Node or other projects. See [packages/rare-word-analyzer/README.md](packages/rare-word-analyzer/README.md) for API and `npm install rare-word-analyzer`.

---

## File structure

| Path | Purpose |
|------|--------|
| `index.html` | Single-page app shell. |
| `app.js` | UI logic: CSV load, highlighting DOM, word list, word details, library, theme (uses `rare-word-analyzer` for analysis). |
| `theme-init.js` | Applies the saved theme before first paint. |
| `styles.css` | Layout and theme (light/dark). |
| `packages/rare-word-analyzer/` | **rare-word-analyzer** package: parse frequency CSV, analyze text (rarest/unknown words, table data). |
| `data/words-common.csv` | Word → log-frequency for the 50,000 most common words, loaded first (derived from `unigram_freq.csv`). |
| `data/words-rest.csv` | The remaining words, loaded in the background. |
| `sw.js` | Service worker for offline use. Bump `CACHE_NAME` when the list of app files changes. |
| `unigram_freq.csv` | Raw word counts (source data; not loaded by the app). |
| `build_log_freq_csv.py` | Script to build the `data/` files from `unigram_freq.csv`. |
| `texts/` | Preset `.txt` files (included samples from Project Gutenberg). |
| `texts/list.json` | List of preset filenames (used on GitHub Pages and other static hosts). |

See `texts/README.md` for adding your own preset texts.

---

## Frequency data

- The app uses **log frequency**: for each word, `log(count / total_count)` where `total_count` is the sum of all word counts. Rarer words have more negative values.
- **Source:** [English word frequency](https://www.kaggle.com/datasets/rtatman/english-word-frequency) (Kaggle); the repo uses `unigram_freq.csv` (word, count). Regenerate the app’s data with:
  ```bash
  python3 build_log_freq_csv.py
  ```
  This overwrites the `data/` files, which have `word` and `log_frequency` columns.

---

## Tech

- Plain HTML, CSS, and JavaScript.
- **[rare-word-analyzer](packages/rare-word-analyzer)** (in-repo package) for word-frequency analysis (parse CSV, rarest/unknown words, table data).
- [Free Dictionary API](https://dictionaryapi.dev/) for definitions (no API key).
- No build step; run any static server from the project root.

---

## Support

If this tool helped you, you can [buy me a coffee](https://buymeacoffee.com/ethannguyen).
