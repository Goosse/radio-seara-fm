var es = new EventSource('http://localhost:3000/updates/current-song-stream');

es.onmessage = function (event) {
  console.log("on message: " + event.data)
};

es.addEventListener('new-song', function (event) {
    console.log(event.data)
    var parsedData = JSON.parse(event.data)
    console.log(parsedData)
    document.getElementById("artist").innerHTML = parsedData.artist ? parsedData.artist : ""
    document.getElementById("title").innerHTML = parsedData.title ? parsedData.title : ""
    document.getElementById("artwork").setAttribute("src", parsedData.artwork ? 'http://localhost:3000/' + parsedData.artwork : "/recursos/missingArtwork.jpg")
    document.getElementById("lyrics").innerHTML = parsedData.lyrics ? parsedData.lyrics : ""
});