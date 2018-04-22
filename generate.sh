#!/bin/sh

if [ ! -a './jpeg-recompress'* ]; then
  echo 'Missing jpeg-recompress binary. Please download it from' \
       '> https://github.com/danielgtaylor/jpeg-archive/releases' \
       'and place it in this folder.'
  exit 1
fi

mkdir -p './temp'
mkdir -p './output'

npm start

echo 'Minimizing JPEG size...'
for mode in 'osu' 'taiko' 'catch' 'mania'; do
  mkdir -p "./output/images/$mode"

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

shopt -s nullglob
images=('./output/images/'**/*'.jpg')
echo "Minimized ${#images[@]} images"
shopt -u nullglob

rm -rf './temp'

echo 'Done!'
