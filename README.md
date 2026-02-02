# Rare Word Finder

A web app that highlights rare words in any text using English word-frequency data (~333k words). Hover or click a highlighted word (or a word in the results table) to see its definition; if none is found, click the word to open a web search in a new tab.

---

## How to run

1. **Serve the app over HTTP** (required for loading the frequency CSV and preset texts):
   ```bash
   python3 -m http.server 8000
   ```
2. Open **http://localhost:8000** in a browser.

If you open `index.html` as a file (`file://`), the app will prompt you to load `wordFrequencyData.csv` manually and preset texts won’t appear in the dropdown.

---

## Features

- **Rare-word highlighting** – Paste or type text; the app finds words that appear in the frequency dataset and highlights the rarest ones. **Highlight colors:** **yellow/gold** = rarest words (in the database); **pink** = words not in the database. You choose how many “rarest” words to highlight (slider fixed at the bottom). The highlighted text area and results table are scrollable and resizable.

- **Results table** – For every unique word in your text that appears in the database: **Rank**, **Word**, **Frequency in English**, **1 / Frequency** (inverse of frequency, rounded to the nearest integer), and **Zipf value**. Hover or click a word in the table to see its definition (same as for highlighted words).

- **Definitions** – Hover (after a short delay) or click a highlighted word or a word in the table to see a definition in a tooltip (via [Free Dictionary API](https://dictionaryapi.dev/)). If no definition is found, the tooltip shows “Click to search online”; clicking the word opens a Google “define …” search in a new tab. (Hovering a word with no definition does not open a tab; only clicking does.)

- **Words not in database** – A section below the table lists words from your text that are not in the frequency database. The app splits on spaces, then on punctuation and dashes (hyphen, em dash, quotes, etc.), so tokens like `baby—the` or `four-fifths` are treated as separate words. Leading/trailing punctuation is stripped for display (e.g. `dyet,,` appears as `dyet`).

- **Preset texts** – Dropdown loads texts from the `texts/` folder. The included preset texts are from [Project Gutenberg](https://www.gutenberg.org/). On GitHub Pages (and other static hosts) the app uses `texts/list.json` to list presets; when adding a new `.txt` file, add its filename to that array. When served locally with a server that returns directory listings (e.g. Python’s `http.server`), the app can fall back to discovering `.txt` files automatically if `list.json` is missing.

- **Light / dark mode** – Follows system preference; a button toggles and the choice is saved in `localStorage`.

- **Word frequency data source** – When the app has loaded the frequency data, the status message “Word frequency data loaded (N words).” includes a link to the [Kaggle English word frequency dataset](https://www.kaggle.com/datasets/rtatman/english-word-frequency).

---

## File structure

| Path | Purpose |
|------|--------|
| `index.html` | Single-page app shell. |
| `app.js` | Logic: CSV load, text processing, highlighting, table, definitions, presets, theme, unknown-words list. |
| `styles.css` | Layout and theme (light/dark). |
| `wordFrequencyData.csv` | Word → log-frequency (derived from `unigram_freq.csv`). |
| `unigram_freq.csv` | Raw word counts (source data; not loaded by the app). |
| `build_log_freq_csv.py` | Script to build `wordFrequencyData.csv` from `unigram_freq.csv`. |
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
  This overwrites `wordFrequencyData.csv` with `word` and `log_frequency` columns.

---

## Tech

- Plain HTML, CSS, and JavaScript.
- [jQuery](https://jquery.com/) and [Compromise](https://github.com/spencermountain/compromise) (nlp.js) for tokenization.
- [Free Dictionary API](https://dictionaryapi.dev/) for definitions (no API key).
- No build step; run any static server from the project root.

---

## Support

If this tool helped you, you can [buy me a coffee](https://buymeacoffee.com/ethannguyen).
