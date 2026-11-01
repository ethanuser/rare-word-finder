# rare-word-analyzer

Analyze text against a word-frequency map: find rarest words, unknown words, and table data (rank, frequency, Zipf, etc.). Used by [Rare Word Finder](https://github.com/ethanuser/rare-word-finder).

## Install

**From npm** (no auth):

```bash
npm install rare-word-analyzer
```

**From GitHub Packages** (after [authenticating](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages) to `npm.pkg.github.com`):

```bash
npm install @ethanuser/rare-word-analyzer
```

**Or** use the script in this repo (no build step):

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
  - **groupForms** (boolean, default `false`): Count inflected forms of a word as one word, so `gloated` and `gloating` become `gloat`.

Returns:

- **rarestWords**: Array of normalized words (rarest first).
- **unknownWords**: Array of display forms of words not in the frequency map (sorted).
- **unknownSet**: Set of normalized unknown words (for highlighting).
- **tableData**: Array of rows `[rank, word, frequencyStr, inverseFreq, zipf]` for the table.
- **baseForms**: Map of each normalized word in the text to its base form (itself unless `groupForms` is on).
- **forms**: Object of base form → the forms found in the text.
- **counts**: Object of base form → how many times it appears.
- **stats**: `{ totalWords, knownWords, rareWords, rareShare }`. `rareShare` is the share of known words with a Zipf value below 3.

### `findBaseForm(word, wordFrequencyMap)`

Returns the base form of a normalized word if one is in the map and about as common as the word or more so, otherwise the word itself.

## Example

```js
const csv = 'word,log_frequency\nthe,-2.3\nrare,-12.1\n';
const freq = parseFrequencyCSV(csv);
const result = analyzeText('The rare word.', freq, { topRarest: 5 });
// result.rarestWords, result.unknownWords, result.tableData, result.unknownSet
```
---

## License

MIT
