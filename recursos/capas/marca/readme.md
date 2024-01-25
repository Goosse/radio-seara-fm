#This will compress the images to below 500kb, which is required by apple podcasts.

convert algemas-quebradas.jpg  -sampling-factor 4:2:0 -strip -quality 85 -interlace JPEG -colorspace RGB -define jpeg:extent=450kb algemas-quebradas-500.jpg


convert ligado-na-verdade.png  -sampling-factor 4:2:0 -strip -quality 85 -interlace JPEG -colorspace RGB -define jpeg:extent=450kb ligado-na-verdade.jpg
