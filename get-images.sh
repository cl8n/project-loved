#!/bin/sh

for beatmap in ./config/*.osz; do
    file=$(zipinfo -1 "$beatmap" '*.png' '*.jpg' '*.jpeg' 2> /dev/null \
           | sed -e 's/^\n+|\n+$//')
    file_count=$(echo "$file" | wc -l)

    if [ $file_count == 1 ]; then
        unzip "$beatmap" "$file" > /dev/null

        set_id=$(basename "$beatmap" | grep -o '^[0-9]\+')
        extension=$(echo "$file" | grep -o '\.[a-z]\+$')

        mv "./$file" ./config/$set_id$extension
        rm "$beatmap"
    fi
done
