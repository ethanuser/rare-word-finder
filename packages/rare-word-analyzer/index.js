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

    /**
     * Analyze text against a word-frequency map.
     * @param {string} text - Input text
     * @param {Object.<string, number>} wordFrequencyMap - Map of word -> log frequency (e.g. from parseFrequencyCSV)
     * @param {Object} [options]
     * @param {number} [options.topRarest=10] - Number of rarest words to return
     * @returns {{ rarestWords: string[], unknownWords: string[], tableData: Array.<[number, string, string, number, string]>, unknownSet: Set<string> }}
     */
    function analyzeText(text, wordFrequencyMap, options) {
        var topRarest = (options && options.topRarest != null) ? Number(options.topRarest) : 10;
        var wordFreq = {};
        var unknownWords = new Map();

        var words = text.split(/\s+/);
        words.forEach(function (word) {
            var parts = word.split(/[^a-zA-Z']+/).filter(Boolean);
            parts.forEach(function (part) {
                var normalized = part.toLowerCase().replace(/[^a-z]/g, '');
                if (!normalized) return;
                var displayForm = stripLeadingTrailingPunctuation(part);
                if (wordFrequencyMap[normalized] !== undefined) {
                    wordFreq[normalized] = wordFrequencyMap[normalized];
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

        var unknownWordsSorted = Array.from(unknownWords.values()).sort(function (a, b) {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        });

        return {
            rarestWords: rarestWords,
            unknownWords: unknownWordsSorted,
            unknownSet: unknownSet,
            tableData: tableData
        };
    }

    return {
        parseFrequencyCSV: parseFrequencyCSV,
        analyzeText: analyzeText
    };
}));
