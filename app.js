//Mark: Service Worker
const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
        const thisScript = document.currentScript;
        let buildTag = thisScript.getAttribute('data-buildTag');
        console.log("data-buildTag: " + buildTag);
        const registration = await navigator.serviceWorker.register("/sw.js?build-tag=" + buildTag, {
        scope: "/",
      });
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.waiting) {
        console.log("Service worker installed");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};
registerServiceWorker();

//Mark: Player Controls

var stream = document.getElementById("player");
var streamFullTime = 0 //in seconds
var streamTitle = '';
var scrubUpdater
stream.volume = 0.5;
stream.addEventListener("volumechange", function() {
    //stream volume can be controlled, so show the volume slider.
    removeClass("volume", "hidden");
});


//Mark: Media Session API
if('mediaSession' in navigator) {
  const player = document.getElementById('player');
  
  // Initialize with default live stream metadata
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Rádio Seara',
    artist: 'Ao Vivo',
    artwork: [
      {
        src: 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp',
        sizes: '256x256',
        type: 'image/webp'
      },
      {
        src: 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp',
        sizes: '512x512',
        type: 'image/webp'
      }
    ]
  });
  
  // Action handlers for play/pause from lock screen and notifications
  navigator.mediaSession.setActionHandler('play', () => {
    if (player.paused) {
        playStream('bar-play-button');
      }
  });
  
  navigator.mediaSession.setActionHandler('pause', () => {
    if (!player.paused) {
        pauseStream('bar-play-button');
      }
  });
}    
    


function toggleLiveStream(playButton){
    if (stream.paused){
        addClass(playButton.id, "playing");
        
        // Reset Media Session to live stream metadata
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Rádio Seara',
                artist: 'Ao Vivo',
                artwork: [
                    {
                        src: 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp',
                        sizes: '256x256',
                        type: 'image/webp'
                    },
                    {
                        src: 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp',
                        sizes: '512x512',
                        type: 'image/webp'
                    }
                ]
            });
        }
        
        //  stream.load();
        stream.play();
    }
    else{
        removeClass(playButton.id, "playing");
        stream.pause();
    }
}

function toggleStream(playButton){
    if (stream.paused){
        playStream(playButton.id)
    }
    else{
        pauseStream(playButton.id)
    }
}
function playStream(buttonId){
    if (scrubUpdater) {
        clearInterval(scrubUpdater);
    }
    addClass(buttonId, "playing");
    stream.play();
    scrubUpdater = window.setInterval(updateScrubber, 1000);
}

function pauseStream(buttonId){
    removeClass(buttonId, "playing");
    stream.pause();
    clearInterval(scrubUpdater)
}

// Helper function to update Media Session metadata for episodes
function updateMediaSessionForEpisode(title, programName, artworkUrl) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: programName,
            album: 'Rádio Seara',
            artwork: [
                {
                    src: artworkUrl,
                    sizes: '256x256',
                    type: 'image/webp'
                },
                {
                    src: artworkUrl,
                    sizes: '512x512',
                    type: 'image/webp'
                }
            ]
        });
    }
}

function playEpisodeWithImage(audioUrl, title, time, programName, imageUrl){
    document.getElementById("bar-player-artwork").setAttribute('src', imageUrl)
    playEpisode(audioUrl, title, time, programName, imageUrl)
}

function playEpisode(audioUrl, title, time, programName, imageUrl){
    removeClass("bar-player-wrapper", "closed");
    var player = document.getElementById("player")
    var playerTitle = document.getElementById("bar-player-title")
    var totalTime = document.getElementById("total-time")

    player.getElementsByTagName('source')[0].setAttribute('src', audioUrl)
    playerTitle.innerHTML = title
    var formattedTime = new Date(time * 1000).toISOString().substr(11, 8)
    if (formattedTime.substr(0,2) == "00") {
        formattedTime = formattedTime.substr(3, formattedTime.length - 3)
    }
    totalTime.innerHTML = formattedTime
    streamFullTime = time
    streamTitle = title;
    analyticsTriggered = 0;
    updateSliderVariables();  //The episode title can change the scrubber slider's length.
    
    // Update Media Session metadata for lock screen
    updateMediaSessionForEpisode(title, programName, imageUrl);
    
    stream.load();
    playStream("bar-play-button")
}

function minimizePlayer(){
    document.getElementById("bar-player-wrapper").classList.remove("full");
    enableScrolling();
}

function expandPlayer(){
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    var target = event.target ? event.target : event.srcElement;
    if (vw < 768 && target.id != "bar-play-button") {
        if (target.classList.contains("close")){}
        else{
            if(document.getElementById("bar-player-wrapper").classList.contains("full")){}
            else{
                document.getElementById("bar-player-wrapper").classList.add("full");
                disableScrolling();
                updateSliderVariables();
            }
        }
    }
}

function closePlayer(button){
    if(button.parentElement.classList.contains("full")){
        minimizePlayer()
    }else{
        button.parentElement.classList.add("closed");
        pauseStream("bar-play-button");
    }
}

function updateSliderVariables(){  //On small screens, the scrubber and volume sliders are hidden until the player is expanded.  So the boundingrect variables of their elements need to be updated so that they are not zero.
    scrubberHandleDiameter = document.getElementById("scrubber-handle").getBoundingClientRect().width - 2;
    scrubberRect = scrubberContainer.getBoundingClientRect();
    volumeHandleDiameter = document.getElementById("volume-handle").getBoundingClientRect().width - 2;
    volumeRect = volumeContainer.getBoundingClientRect();
}

/*Begin scrubber slider code*/
//const scrubberWrapper = document.getElementById("scrubber");

var scrubberActiveRange;
var scrubberContainer;
var scrubberHandleDiameter;
var analyticsTriggered = 0;

if (document.getElementById("scrubber-slider")){
    scrubberActiveRange = document.getElementById("scrubber-active-range");
    scrubberContainer = document.getElementById("scrubber-slider");
    scrubberHandleDiameter = document.getElementById("scrubber-handle").getBoundingClientRect().width - 2;
}

function updateScrubber(){
    let x = stream.currentTime / streamFullTime * (scrubberRect.width - scrubberHandleDiameter) + scrubberHandleDiameter
    scrubberActiveRange.style.width = x + "px"
    displayFormattedCurrentTime(stream.currentTime)
    streamingAnalytics(stream.currentTime, streamFullTime)
}

function displayFormattedCurrentTime(seconds){

    var currentTime = document.getElementById("current-time")
    var formattedTime = new Date(seconds * 1000).toISOString().substr(11, 8)
    if (formattedTime.substr(0,2) == "00") {
        formattedTime = formattedTime.substr(3, formattedTime.length - 3)
    }
    currentTime.innerHTML = formattedTime
}

//var scrubberRect = scrubberContainer.getBoundingClientRect();

if (document.getElementById("scrubber-slider")){
    var scrubberMouseIsDown = false;

    window.addEventListener("mouseup", scrubberUp);
    window.addEventListener("touchend", scrubberUp);
    scrubberContainer.addEventListener("touchstart", scrubberDown);
    scrubberContainer.addEventListener("mousedown", scrubberDown);
    scrubberContainer.addEventListener("mousedown", scrubberSlide);
    scrubberContainer.addEventListener("touchmove", scrubberSlide);
    scrubberContainer.addEventListener("mousemove", scrubberSlide);
    window.addEventListener("mousemove", scrubberSlide);
}

function scrubberDown() {
    scrubberMouseIsDown = true;
}

function scrubberUp() {
    scrubberMouseIsDown = false;
}

function scrubberSlide(event) {
    if (scrubberMouseIsDown) {
        var clientX = 0;
        if (typeof event.touches != "undefined") { //Is this a touch event?
            clientX = event.touches[0].clientX;
        }
        else{ //This is a click event.
            clientX = event.clientX;
        }

        let x = Math.floor(clientX - scrubberRect.left + scrubberHandleDiameter/2);

        if (x < scrubberHandleDiameter) x = scrubberHandleDiameter; // check if it's too far left
        if (x > scrubberRect.width) x = scrubberRect.width; // check if it's too far right

        scrubberActiveRange.style.width = x + 'px';
        stream.currentTime = Math.floor((x -  scrubberHandleDiameter)/(scrubberRect.width - scrubberHandleDiameter)* streamFullTime)
        displayFormattedCurrentTime(stream.currentTime)
    }
}

/*End scrubber slider code*/

/*Begin volume slider code*/

const volumeWrapper = document.getElementById("volume");
const volumeActiveRange = document.getElementById("volume-active-range");
const volumeContainer = document.getElementById("volume-slider");
var volumeHandleDiameter = document.getElementById("volume-handle").getBoundingClientRect().width - 2;
var volumeRect = volumeContainer.getBoundingClientRect();

let mouseIsDown = false;

window.addEventListener("mouseup", up);
window.addEventListener("touchend", up);
volumeContainer.addEventListener("touchstart", down);
volumeContainer.addEventListener("mousedown", down);
volumeContainer.addEventListener("mousedown", volumeSlide);
volumeContainer.addEventListener("touchmove", volumeSlide);
volumeContainer.addEventListener("mousemove", volumeSlide);
window.addEventListener("mousemove", volumeSlide);
document.onselectstart = () => {
    if (mouseIsDown || scrubberMouseIsDown){
        return false;// cancel selection
    }
};

function down(event) {
    mouseIsDown = true;
    if (typeof event.touches != "undefined") {
        disableScrolling();
    }
}

function up(event) {
    if (mouseIsDown  && typeof event.touches != "undefined"){
        enableScrolling();
    }
    mouseIsDown = false;
}

function volumeSlide(event) {
    if (mouseIsDown) {
        if (volumeWrapper.classList.contains("horizontal")){
            var clientX = 0;
            if (typeof event.touches != "undefined") { //Is this a touch event?
                clientX = event.touches[0].clientX;
            }
            else{ //This is a click event.
                clientX = event.clientX;
            }
            let x = Math.floor(clientX - volumeRect.left + volumeHandleDiameter/2);
            if (x < volumeHandleDiameter) x = volumeHandleDiameter; // check if it's too low
            if (x > volumeRect.width) x = volumeRect.width; // check if it's too high
            volumeActiveRange.style.width = x + 'px';
            stream.volume = (x - volumeHandleDiameter)/(volumeRect.width - volumeHandleDiameter)
        }
        else{
            var clientY = 0;
            if (typeof event.touches != "undefined") { //Is this a touch event?
                clientY = event.touches[0].clientY - document.body.top;//Window clientY is to resolve issue created by disableing scrolling on touch screens.
            }
            else{ //This is a click event.
                clientY = event.clientY + window.scrollY;
            }
            let y = Math.floor(clientY - volumeRect.top - volumeHandleDiameter/2);
            if (y < 0) y = 0; // check if it's too low
            if (y > volumeRect.height - volumeHandleDiameter) y = volumeRect.height - volumeHandleDiameter; // check if it's too high
            volumeActiveRange.style.height = volumeRect.height - y + 'px';
            stream.volume = (volumeRect.height - y - volumeHandleDiameter)/(volumeRect.height - volumeHandleDiameter)
        }
    }
}

//Mark: Misc. Functions

function shareUrl(url, title){
    var dialog = document.getElementById("share-dialog")
    var fb = document.getElementById("fb-share")
    var wa = document.getElementById("wa-share")
    var twitter = document.getElementById("twitter-share")
    var email = document.getElementById("email-share")
    var titleSpan = document.getElementById("share-title")

    fb.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURI(url)
    wa.href = "whatsapp://send?text=" + url
    twitter.href = "https://twitter.com/intent/tweet?text=" + encodeURI(url)
    email.href = "mailto:?subject=Veja%20o%20que%20eu%20descrobi!&body=" + url
    titleSpan.innerHTML = title

    dialog.classList.remove("hidden")
    disableScrolling();
}

function investirFinanceiramente(){
  var dialog = document.getElementById("investir-dialog")
  dialog.classList.remove("hidden")
  disableScrolling();
}

function copyToClipboard(string) {
  let textarea;
  let result;

  try {
    textarea = document.createElement('textarea');
    textarea.setAttribute('readonly', true);
    textarea.setAttribute('contenteditable', true);
    textarea.style.position = 'fixed'; // prevent scroll from jumping to the bottom when focus is set.
    textarea.value = string;

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const range = document.createRange();
    range.selectNodeContents(textarea);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    textarea.setSelectionRange(0, textarea.value.length);
    result = document.execCommand('copy');
  } catch (err) {
    console.error(err);
    result = null;
  } finally {
    document.body.removeChild(textarea);
  }

  // manual copy fallback using prompt
  if (!result) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const copyHotkey = isMac ? '⌘C' : 'CTRL+C';
    result = prompt(`Precione ${copyHotkey}`, string); // eslint-disable-line no-alert
    if (!result) {
      return false;
    }
  }
    confirmPixCopied()
  return true;
}

var copiarButtonText;
function confirmPixCopied(){
  var button = document.getElementById("pix-copia-cola")
    copiarButtonText = button.getElementsByTagName("span")[0].innerHTML
  button.getElementsByTagName("span")[0].innerHTML = "COPIADO!"
  addClass("pix-copia-cola", "copiado")
  setTimeout(returnPixButtonState, 1500)
}

function returnPixButtonState(){
  var button = document.getElementById("pix-copia-cola")
  button.getElementsByTagName("span")[0].innerHTML = copiarButtonText
  removeClass("pix-copia-cola", "copiado")
}

function closeDialog(button){
    button.parentElement.parentElement.classList.add("hidden");
    enableScrolling();
}

function disableScrolling(){
    document.body.style.top = -window.scrollY + 'px';
    document.body.top = -window.scrollY;
    document.body.style.position = 'fixed';

}

function enableScrolling(){
    //const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo(0, -document.body.top);
    document.body.top = '';
}

function addClass(id, newclass){
    document.getElementById(id).classList.add(newclass);
}

function removeClass(id, oldclass){
    document.getElementById(id).classList.remove(oldclass);
}

function streamingAnalytics(currentTime, fullTime){
  var percentage = 100*currentTime/fullTime

  switch (true) {
    case (percentage > 90 && analyticsTriggered < 90):
      analyticsTriggered = 90
      plausible('Streaming 90%', {props: {Episódio: streamTitle}})
      break;
      case (percentage > 75 && analyticsTriggered < 75):
        analyticsTriggered = 75
        plausible('Streaming 75%', {props: {Episódio: streamTitle}})
        break;
      case (percentage > 50 && analyticsTriggered < 50):
        analyticsTriggered = 50
        plausible('Streaming 50%', {props: {Episódio: streamTitle}})
        break;
      case (percentage > 25 && analyticsTriggered < 25):
        analyticsTriggered = 25
        plausible('Streaming 25%', {props: {Episódio: streamTitle}})
        break;
      case (percentage > 10 && analyticsTriggered < 10):
        analyticsTriggered = 10
        plausible('Streaming 10%', {props: {Episódio: streamTitle}})
        break;
    default:
  }
}
