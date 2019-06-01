node generate.js "$@"

shopt -s nullglob

for image in storage/*/*/*.jpg; do
    ./bin/jpeg-recompress \
        --method smallfry \
        --accurate \
        --strip \
        --no-copy \
        --quiet \
        "$image" \
        "${image/storage/'output/wiki/shared/news'}"

    if [ $? -eq 0 ]; then
        echo "Minimized `basename "$image"`"
    else
        cp "$image" "${image/storage/'output/wiki/shared/news'}"
        echo "Failed to minimize `basename "$image"`. Copied original to output folder"
    fi
done

shopt -u nullglob

# TODO
# This is an ultra garbage way to delete the folders under `storage` but not the files
rm -rf storage/*/
