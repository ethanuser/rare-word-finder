#!/usr/bin/env python3
"""Convert unigram_freq.csv to wordFrequencyData.csv with log frequencies.

Frequency = count(word) / total_count_of_all_words
log_frequency = log(frequency)
"""
import csv
import math

INPUT = "unigram_freq.csv"
OUTPUT = "wordFrequencyData.csv"

# First pass: load rows and compute total count of all words
rows = []
total_count = 0
with open(INPUT, newline="", encoding="utf-8") as fin:
    reader = csv.DictReader(fin)
    for row in reader:
        count = int(row["count"])
        rows.append((row["word"], count))
        total_count += count

# Second pass: write log_frequency = log(count / total_count)
with open(OUTPUT, "w", newline="", encoding="utf-8") as fout:
    writer = csv.DictWriter(fout, fieldnames=["word", "log_frequency"])
    writer.writeheader()
    for word, count in rows:
        frequency = count / total_count if total_count > 0 else 0.0
        log_freq = math.log(frequency) if frequency > 0 else float("-inf")
        writer.writerow({"word": word, "log_frequency": f"{log_freq:.6f}"})

print(f"Wrote {OUTPUT} (total count = {total_count})")
