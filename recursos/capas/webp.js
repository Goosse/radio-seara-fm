const imagemin = require('imagemin'),
      webp = require('imagemin-webp'),
      pngToJpeg = require('png-to-jpeg');
const outputFolder = './webp'
const pngOutputFolder = './marca'
const produceWebP = async () => {
    await imagemin(['originals/marca/algemas-quebradas.png'], {
        destination: pngOutputFolder,
        plugins: [
            pngToJpeg({
                quality: 65
            })
        ]
    })
    console.log('PNGs processed')
//    await imagemin(['originals/*.{jpg,jpeg}'], {
//        destination: outputFolder,
//        plugins: [
//            webp({
//                quality: 65
//            })
//        ]
//    })
//    console.log('JPGs and JPEGs processed')
}
produceWebP()