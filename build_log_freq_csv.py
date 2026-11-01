#!/usr/bin/env python3
"""Convert unigram_freq.csv to the app's two word-frequency files.

Frequency = count(word) / total_count_of_all_words
log_frequency = log(frequency)

Input is sorted by count. The most common words load first so the app is usable
quickly; the rest arrive in the background.
"""
import csv
import math

INPUT = "unigram_freq.csv"
OUTPUT_COMMON = "data/words-common.csv"
OUTPUT_REST = "data/words-rest.csv"
COMMON_WORDS = 50000

# First pass: load rows and compute total count of all words
rows = []
total_count = 0
with open(INPUT, newline="", encoding="utf-8") as fin:
    reader = csv.DictReader(fin)
    for row in reader:
        count = int(row["count"])
        rows.append((row["word"], count))
        total_count += count



def write_rows(path, part):
    with open(path, "w", newline="", encoding="utf-8") as fout:
        writer = csv.DictWriter(fout, fieldnames=["word", "log_frequency"], lineterminator="\n")
        writer.writeheader()
        for word, count in part:
            frequency = count / total_count if total_count > 0 else 0.0
            log_freq = math.log(frequency) if frequency > 0 else float("-inf")
            writer.writerow({"word": word, "log_frequency": f"{log_freq:.6f}"})


# Second pass: write log_frequency = log(count / total_count)
write_rows(OUTPUT_COMMON, rows[:COMMON_WORDS])
write_rows(OUTPUT_REST, rows[COMMON_WORDS:])

print(f"Wrote {OUTPUT_COMMON} and {OUTPUT_REST} (total count = {total_count})")
