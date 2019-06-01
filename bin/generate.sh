node generate.js "$@"

shopt -s nullglob

for image in temp/*/*/*.jpg; do
    ./bin/jpeg-recompress \
        --method smallfry \
        --accurate \
        --strip \
        --no-copy \
        --quiet \
        "$image" \
        "${image/temp/'output/wiki/shared/news'}"

    if [ $? -eq 0 ]; then
        echo "Minimized `basename "$image"`"
    else
        cp "$image" "${image/temp/'output/wiki/shared/news'}"
        echo "Failed to minimize `basename "$image"`. Copied original to output folder"
    fi
done

shopt -u nullglob

rm -rf temp
