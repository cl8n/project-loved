#!/bin/sh

node generate.js

shopt -s nullglob

for image in './temp/'*/*/*'.jpg'; do
  ./jpeg-recompress \
    --method smallfry \
    --accurate \
    --strip \
    --quiet \
    "$image" \
    "${image/temp/'output/wiki/shared/news'}"

  echo "Minimized `basename "$image"`"
done

shopt -u nullglob

rm -rf './temp'

echo 'Done!'
