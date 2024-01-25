
function forceDownload(blob, filename) {
  var a = document.createElement('a');
  a.download = filename;
  a.href = blob;
  // For Firefox https://stackoverflow.com/a/32226068
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadResource(url, filename, button) {
    
    var article = button.parentElement
    article.style.position = "relative"
    var progressBar = document.createElement('div')
    progressBar.style.height = "5px"
    progressBar.style.width = "0px"
    progressBar.style.backgroundColor = "red"
    progressBar.style.position = "absolute"
    progressBar.style.bottom = "0"
    progressBar.style.left = "0"
    article.appendChild(progressBar)
    // Step 1: start the fetch and obtain a reader
    let response = await fetch(url);

    const reader = response.body.getReader();

    // Step 2: get total length
    const contentLength = +response.headers.get('Content-Length');

    // Step 3: read the data
    let receivedLength = 0; // received that many bytes at the moment
    let chunks = []; // array of received binary chunks (comprises the body)
    while(true) {
      const {done, value} = await reader.read();

      if (done) {
        plausible('Download', {props: {file: filename.split('/').pop()}})
        break;
      }

      chunks.push(value);
      receivedLength += value.length;
      var percent = (receivedLength / contentLength) * 100
      progressBar.style.width = percent+"%"
    }

    progressBar.style.backgroundColor = "green"
    let blob = new Blob(chunks);
    let blobUrl = window.URL.createObjectURL(blob);
    forceDownload(blobUrl, filename);
}
