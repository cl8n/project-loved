#!/bin/sh

for mode in 'osu' 'taiko' 'catch' 'mania'; do
  mkdir -p "./temp/$mode"
  mkdir -p "./output/images/$mode"
done

node generate.js

shopt -s nullglob

for mode in 'osu' 'taiko' 'catch' 'mania'; do
  for image in "./temp/$mode/"*'.jpg'; do
    ./jpeg-recompress \
      --method smallfry \
      --accurate \
      --strip \
      --quiet \
      "$image" \
      "./output/images/$mode/`basename "$image"`"
  done
done

shopt -u nullglob

rm -rf './temp'

echo 'Done!'
