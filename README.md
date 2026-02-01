# Rare Word Finder

A web app that highlights rare words in any text using English word-frequency data. Hover or click a highlighted word (or a word in the results table) to see its definition; if none is found, you can open a web search in one click.

**Other names you could use:** Uncommon Word Finder · Word Rarity · Vocabulary Spotlight · Lexical Lens · Rare Word Highlighter · Word Frequency Explorer · Vocab Lens · Uncommon Words

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

- **Rare-word highlighting** – Paste or type text; the app finds words that appear in the frequency dataset and highlights the rarest ones. You choose how many “rarest” words to highlight (slider at the bottom).
- **Results table** – Rank, word, frequency in English, and Zipf value for every unique word in your text.
- **Definitions** – Hover (after a short delay) or click a highlighted word or a word in the table to see a definition (via [Free Dictionary API](https://dictionaryapi.dev/)). If no definition is found, the tooltip offers a “Search online” link and clicking the word opens a Google “define …” search in a new tab.
- **Preset texts** – Dropdown loads texts from the `texts/` folder. On GitHub Pages (and other static hosts) the app uses `texts/list.json` to list presets; when adding a new `.txt` file, add its filename to that array. When served locally with a server that returns directory listings (e.g. Python’s `http.server`), the app can fall back to discovering `.txt` files automatically if `list.json` is missing.
- **Light / dark mode** – Follows system preference; a button toggles and the choice is saved in `localStorage`.

---

## File structure

| Path | Purpose |
|------|--------|
| `index.html` | Single-page app shell. |
| `app.js` | Logic: CSV load, text processing, highlighting, table, definitions, presets, theme. |
| `styles.css` | Layout and theme (light/dark). |
| `wordFrequencyData.csv` | Word → log-frequency (derived from `unigram_freq.csv`). |
| `unigram_freq.csv` | Raw word counts (source data; not loaded by the app). |
| `build_log_freq_csv.py` | Script to build `wordFrequencyData.csv` from `unigram_freq.csv`. |
| `texts/` | Preset `.txt` files. |
| `texts/list.json` | List of preset filenames (used on GitHub Pages and other static hosts). |

See `texts/README.md` for adding your own preset texts.

---

## Frequency data

- The app uses **log frequency**: for each word, `log(count / total_count)` where `total_count` is the sum of all word counts. Rarer words have more negative values.
- **Source:** `unigram_freq.csv` (word, count). Regenerate the app’s data with:
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
