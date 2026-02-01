# Preset texts for Rare Word Finder

**No config.** Put `.txt` files in this folder. The app discovers them from the server’s directory listing when you load the page.

- Use UTF-8 encoding for your text files.
- The dropdown label is the filename without `.txt` (e.g. `Bee Movie Script.txt` → **Bee Movie Script**).

**Requirement:** The app must be served over HTTP (e.g. `python3 -m http.server` from the project root). Directory discovery does not work when opening `index.html` as a file.
