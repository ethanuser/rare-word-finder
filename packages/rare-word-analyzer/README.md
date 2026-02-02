# rare-word-analyzer

Analyze text against a word-frequency map: find rarest words, unknown words, and table data (rank, frequency, Zipf, etc.). Used by [Rare Word Finder](https://github.com/ethanuser/rare-word-finder).

## Install

```bash
npm install rare-word-analyzer
```

Or use the script in this repo (no build step):

```html
<script src="path/to/packages/rare-word-analyzer/index.js"></script>
<script>
  const { parseFrequencyCSV, analyzeText } = window.RareWordAnalyzer;
</script>
```

## API

### `parseFrequencyCSV(csvText)`

Parse a CSV string with columns `word, log_frequency` (first line = header). Returns a map `{ word: logFreq }`.

### `analyzeText(text, wordFrequencyMap, options)`

- **text** (string): Input text.
- **wordFrequencyMap** (object): Map of word → log frequency (e.g. from `parseFrequencyCSV`).
- **options** (object, optional):
  - **topRarest** (number, default `10`): Number of rarest words to return.

Returns:

- **rarestWords**: Array of normalized words (rarest first).
- **unknownWords**: Array of display forms of words not in the frequency map (sorted).
- **unknownSet**: Set of normalized unknown words (for highlighting).
- **tableData**: Array of rows `[rank, word, frequencyStr, inverseFreq, zipf]` for the table.

## Example

```js
const csv = 'word,log_frequency\nthe,-2.3\nrare,-12.1\n';
const freq = parseFrequencyCSV(csv);
const result = analyzeText('The rare word.', freq, { topRarest: 5 });
// result.rarestWords, result.unknownWords, result.tableData, result.unknownSet
```

## License

MIT
