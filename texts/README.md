# Preset texts

**On GitHub Pages (and other static hosts):** The app loads presets from **`list.json`**. Add your filename to that array when you add a new `.txt` file so it appears in the dropdown.

**When served locally** (e.g. `python3 -m http.server`): If `list.json` is missing or fails to load, the app falls back to discovering `.txt` files from the server’s directory listing.

- Use UTF-8 encoding for your text files.
- The dropdown label is the filename without `.txt` (e.g. `Bee Movie Script.txt` → **Bee Movie Script**).

## Example `list.json`

```json
[
  "sample.txt",
  "Bee Movie Script.txt",
  "My Essay.txt"
]
```

Keep valid JSON: commas between entries, no trailing comma after the last one.
