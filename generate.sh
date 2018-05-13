#!/bin/sh

for mode in 'osu' 'taiko' 'catch' 'mania'; do
  mkdir -p "./temp/$mode"
  mkdir -p "./output/images/$mode"
done

npm start

shopt -s nullglob

echo 'Minimizing JPEG size...'
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

images=('./output/images/'**/*'.jpg')
echo "Minimized ${#images[@]} images"
shopt -u nullglob

rm -rf './temp'

echo 'Done!'
