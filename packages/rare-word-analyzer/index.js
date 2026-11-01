/**
 * rare-word-analyzer
 * Analyze text against a word-frequency map: find rarest words, unknown words, and table data.
 * Works in browser (script tag) and Node.
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RareWordAnalyzer = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Zipf values below this count as rare: about one occurrence per million words.
    var RARE_ZIPF = 3;

    // A base form may be a little rarer than its inflection ("gloat" vs "gloating"),
    // but not far rarer ("morn" vs "morning"). In log frequency, about a factor of 4.5.
    var BASE_FORM_TOLERANCE = 1.5;

    /**
     * Parse CSV with columns: word, log_frequency (or word,<number>).
     * First line is treated as header.
     * @param {string} csvText - Raw CSV string
     * @returns {Object.<string, number>} Map of normalized word -> log frequency
     */
    function parseFrequencyCSV(csvText) {
        var lines = csvText.trim().split('\n');
        if (lines.length < 2) return {};
        var result = {};
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i];
            var commaIndex = line.indexOf(',');
            if (commaIndex === -1) continue;
            var word = line.slice(0, commaIndex).trim();
            var logFreq = parseFloat(line.slice(commaIndex + 1).trim());
            if (word && !isNaN(logFreq)) {
                result[word] = logFreq;
            }
        }
        return result;
    }

    function stripLeadingTrailingPunctuation(s) {
        return s.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '') || s;
    }

    // Possible base forms of an inflected word. Short stems are skipped because
    // "thing" is not "th" + "ing", and "bed" is not "b" + "ed".
    function candidateBases(word) {
        var candidates = [];
        var match = word.match(/^(.{3,})(?:ed|ing)$/);
        if (match) {
            var stem = match[1];
            if (stem.length >= 4) candidates.push(stem);
            candidates.push(stem + 'e');
            if (/([b-df-hj-np-tv-z])\1$/.test(stem)) candidates.push(stem.slice(0, -1));
        }
        if (/^.{2,}ie[sd]$/.test(word)) candidates.push(word.slice(0, -3) + 'y');
        if (/(?:s|x|z|ch|sh)es$/.test(word)) candidates.push(word.slice(0, -2));
        if (/^.{2,}[^siu]s$/.test(word)) candidates.push(word.slice(0, -1));
        return candidates;
    }

    /**
     * Find the base form of an inflected word: "gloated" -> "gloat", "dirges" -> "dirge".
     * The base must be in the map and about as common as the word, or more so.
     * @param {string} word - Normalized word
     * @param {Object.<string, number>} wordFrequencyMap - Map of word -> log frequency
     * @returns {string} The base form, or the word itself
     */
    function findBaseForm(word, wordFrequencyMap) {
        var own = wordFrequencyMap[word];
        var best = word;
        var bestFrequency = own !== undefined ? own - BASE_FORM_TOLERANCE : -Infinity;
        candidateBases(word).forEach(function (candidate) {
            var frequency = wordFrequencyMap[candidate];
            if (frequency !== undefined && frequency >= bestFrequency) {
                best = candidate;
                bestFrequency = frequency;
            }
        });
        return best;
    }

    /**
     * Analyze text against a word-frequency map.
     * @param {string} text - Input text
     * @param {Object.<string, number>} wordFrequencyMap - Map of word -> log frequency (e.g. from parseFrequencyCSV)
     * @param {Object} [options]
     * @param {number} [options.topRarest=10] - Number of rarest words to return
     * @param {boolean} [options.groupForms=false] - Count inflected forms of a word as one word
     * @returns {{ rarestWords: string[], unknownWords: string[], tableData: Array.<[number, string, string, number, string]>, unknownSet: Set<string>, baseForms: Map<string, string>, forms: Object.<string, string[]>, counts: Object.<string, number>, stats: { totalWords: number, knownWords: number, rareWords: number, rareShare: number } }}
     */
    function analyzeText(text, wordFrequencyMap, options) {
        var topRarest = (options && options.topRarest != null) ? Number(options.topRarest) : 10;
        var groupForms = !!(options && options.groupForms);
        var wordFreq = {};
        var unknownWords = new Map();
        var baseForms = new Map();
        var forms = {};
        var counts = {};
        var totalWords = 0;

        var words = text.split(/\s+/);
        words.forEach(function (word) {
            var parts = word.split(/[^a-zA-Z']+/).filter(Boolean);
            parts.forEach(function (part) {
                var normalized = part.toLowerCase().replace(/[^a-z]/g, '');
                if (!normalized) return;
                var displayForm = stripLeadingTrailingPunctuation(part);
                totalWords++;
                var base = baseForms.get(normalized);
                if (base === undefined) {
                    base = groupForms ? findBaseForm(normalized, wordFrequencyMap) : normalized;
                    baseForms.set(normalized, base);
                    if (!forms[base]) forms[base] = [];
                    forms[base].push(normalized);
                }
                counts[base] = (counts[base] || 0) + 1;
                if (wordFrequencyMap[base] !== undefined) {
                    wordFreq[base] = wordFrequencyMap[base];
                } else {
                    if (!unknownWords.has(normalized)) {
                        unknownWords.set(normalized, displayForm);
                    }
                }
            });
        });

        var sortedFreq = Object.keys(wordFreq).map(function (w) { return [w, wordFreq[w]]; }).sort(function (a, b) { return a[1] - b[1]; });
        var rarestWords = sortedFreq.slice(0, topRarest).map(function (item) { return item[0]; });
        var unknownSet = new Set(unknownWords.keys());
        var tableData = sortedFreq.map(function (item, index) {
            var word = item[0];
            var logFrequency = item[1];
            var frequency = Math.exp(logFrequency);
            var inverseFreq = Math.round(1 / frequency);
            var zipf = (Math.log10(frequency) + 9).toFixed(2);
            return [index + 1, word, frequency.toExponential(1), inverseFreq, zipf];
        });

        var knownWords = 0;
        var rareWords = 0;
        sortedFreq.forEach(function (item) {
            var count = counts[item[0]];
            knownWords += count;
            if (Math.log10(Math.exp(item[1])) + 9 < RARE_ZIPF) rareWords += count;
        });

        var unknownWordsSorted = Array.from(unknownWords.values()).sort(function (a, b) {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });

        return {
            rarestWords: rarestWords,
            unknownWords: unknownWordsSorted,
            unknownSet: unknownSet,
            tableData: tableData,
            baseForms: baseForms,
            forms: forms,
            counts: counts,
            stats: {
                totalWords: totalWords,
                knownWords: knownWords,
                rareWords: rareWords,
                rareShare: knownWords ? rareWords / knownWords : 0
            }
        };
    }

    return {
        parseFrequencyCSV: parseFrequencyCSV,
        findBaseForm: findBaseForm,
        analyzeText: analyzeText
    };
}));
