const imagemin = require('imagemin'),
      webp = require('imagemin-webp'),
      pngToJpeg = require('png-to-jpeg');
const outputFolder = './'
const pngOutputFolder = './marca'
const produceWebP = async () => {
//    await imagemin(['./ligado-na-verdade.png'], {
//        destination: pngOutputFolder,
//        plugins: [
//            pngToJpeg({
//                quality: 20
//            })
//        ]
//    })
//    console.log('PNGs processed')
    await imagemin(['./*.{jpg,jpeg,png}'], {
        destination: outputFolder,
        plugins: [
            webp({
                quality: 80
            })
        ]
    })
    console.log('JPGs and JPEGs processed')
}
produceWebP()