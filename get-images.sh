#!/bin/sh

for beatmap in ./config/*.osz; do
    FILE=$(zipinfo -1 "$beatmap" '*.png' '*.jpg' '*.jpeg' 2> /dev/null \
           | sed -e 's/^\n+|\n+$//')
    LINES=$(echo "$FILE" | wc -l)

    if [ $LINES == 1 ]; then
        unzip "$beatmap" "$FILE" > /dev/null

        SID=$(basename "$beatmap" | grep -o '^[0-9]\+')
        EXT=$(echo "$FILE" | grep -o '\.[a-z]\+$')

        mv "./$FILE" ./config/$SID$EXT
        rm "$beatmap"
    fi
done
