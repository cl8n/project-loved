#!/bin/sh

# Arguments:
# $1    - Background image
# $2    - Title
# $3    - Artist
# $4    - Output image
# $5... - Creators

size='1000x400'
shadow='50x2+0+2'

creators=( "$@" )
creators=( "${creators[@]:4}" )
pango="<span font=\"11\" font-family=\"Exo 2\" font-weight=\"400\">mapped by <span font-weight=\"600\">${creators[0]}</span>"

if [ ${#creators[@]} -gt 1 ]; then
  for creator in "${creators[@]:1:${#creators[@]}-2}"; do
    pango+=", <span font-weight=\"600\">$creator</span>"
  done

  if [ "${creators[-1]}" == 'et al.' ]; then
    pango+=' et al.'
  else
    pango+=" and <span font-weight=\"600\">${creators[-1]}</span>"
  fi
fi

pango+='</span>'

magick "$1" overlay.png \
  -gravity center -fill white -background none \
  \( pango:"$pango" -extent $size -repage +0+157 \) \
  -background black -size $size -gravity north \
  \( +clone -shadow $shadow \) +swap \
  -family 'Exo 2' -weight 600 -style italic \
  \( xc:none -pointsize 20 -annotate +0+316 "$3" \) \
  \( +clone -shadow $shadow \) +swap \
  \( xc:none -pointsize 30 -annotate +0+281 "$2" \) \
  \( +clone -shadow $shadow \) +swap \
  -flatten "$4"
