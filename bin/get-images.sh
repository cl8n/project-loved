#!/bin/sh

for beatmap in config/*.osz; do
    file=$(zipinfo -1 -C "$beatmap" '*.png' '*.jpg' '*.jpeg' 2> /dev/null \
           | sed -e 's/^\n+|\n+$//')
    file_count=$(echo "$file" | wc -l)

    if test $file_count = 1 -a "$file" != ''; then
        unzip "$beatmap" "$file" > /dev/null

        set_id=$(basename "$beatmap" | grep -o '^[0-9]\+')
        extension=$(echo "$file" | grep -o '\.[a-zA-Z]\+$')

        mv "$file" config/$set_id$extension
        rm "$beatmap"
    fi
done
