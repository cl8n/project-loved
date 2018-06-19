#!/bin/sh

mkdir -p 'config'

cp './config.json.example' './config/config.json'
touch './config/news-post-header.md'
touch './config/news-post-intro.md'

for mode in 'osu' 'taiko' 'catch' 'mania'; do
  touch "./config/spreadsheet-$mode.tsv"
done

echo "Setup complete"
