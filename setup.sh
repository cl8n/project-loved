#!/bin/sh

npm install

mkdir -p config

cp ./config.json.example ./config/config.json
touch ./config/document
touch ./config/news-post-header.md
touch ./config/news-post-intro.md
