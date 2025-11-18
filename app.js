//Mark: Service Worker
const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
        const thisScript = document.currentScript;
        let buildTag = thisScript.getAttribute('data-buildTag');
        await navigator.serviceWorker.register("/sw.js?build-tag=" + buildTag, {
            scope: "/",
        });
    } catch (error) {
      console.error(`Service worker registration failed:`, error);
    }
  }
};
registerServiceWorker();

//Mark: SPA Navigation (Persistent Player)
function isInternalLink(url) {
    try {
        const link = new URL(url, window.location.origin);
        // Internal if same origin
        return link.origin === window.location.origin;
    } catch {
        return false;
    }
}

async function navigateToPage(url, addToHistory = true) {
    try {
        document.body.classList.add('navigating');
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Page not found');
        
        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        
        const newContent = newDoc.getElementById('page-content');
        if (!newContent) throw new Error('No page-content found');
        
        const currentContent = document.getElementById('page-content');
        currentContent.innerHTML = newContent.innerHTML;
        currentContent.setAttribute('data-page-type', newContent.getAttribute('data-page-type') || '');
        
        document.title = newDoc.title;
        document.body.className = newDoc.body.className;
        
        if (addToHistory) {
            history.pushState({ url: url }, '', url);
        }
        
        window.scrollTo(0, 0);
        document.body.classList.remove('navigating');
        initializePage();
        
    } catch (error) {
        window.location.href = url;
    }
}

// Intercept all internal link clicks
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        
        if (link && link.href && isInternalLink(link.href) && !link.target && !link.download) {
            e.preventDefault();
            navigateToPage(link.href);
        }
    });
    initializePage();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.url) {
        navigateToPage(e.state.url, false);
    } else {
        navigateToPage(window.location.pathname, false);
    }
    updateBackButtonVisibility();
});

// Initialize with current URL in history
history.replaceState({ url: window.location.pathname }, '', window.location.pathname);
updateBackButtonVisibility();

const STREAM_CONFIG = {
    '102': {
        url: 'https://radioseara.fm/stream102',
        name: 'Nova Russas 102,7',
        coords: { lat: -4.707070, lon: -40.563689 }
    },
    '104': {
        url: 'https://radioseara.fm/stream104',
        name: 'Ibiapina 104,7',
        coords: { lat: -3.944082, lon: -40.849463 }
    }
};

const LIVE_STREAM_ARTWORK = 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp';
let currentStreamId = null; // Track active stream ID ('102' or '104')

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Get user location via IP and determine closest stream
async function determineClosestStream() {
    // Check localStorage first
    const savedStreamId = localStorage.getItem('preferredStreamId');
    if (savedStreamId && (savedStreamId === '102' || savedStreamId === '104')) {
        return savedStreamId;
    }

    try {
        // Use ipapi.co for IP-based geolocation (free tier, no API key needed)
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.latitude && data.longitude) {
            const userLat = data.latitude;
            const userLon = data.longitude;
            
            // Calculate distances to both cities
            const dist102 = calculateDistance(
                userLat, userLon,
                STREAM_CONFIG['102'].coords.lat,
                STREAM_CONFIG['102'].coords.lon
            );
            const dist104 = calculateDistance(
                userLat, userLon,
                STREAM_CONFIG['104'].coords.lat,
                STREAM_CONFIG['104'].coords.lon
            );
            
            // Return closest stream
            const closestStreamId = dist102 < dist104 ? '102' : '104';
            localStorage.setItem('preferredStreamId', closestStreamId);
            return closestStreamId;
        }
    } catch (error) {
        console.warn('Geolocation failed, defaulting to stream 102:', error);
    }
    
    // Default to stream102 if geolocation fails
    return '102';
}

function initializePage(){
    updateLiveBanner();
    ensureLiveStreamSource();
    updateBackButtonVisibility();
}

// Show/hide back button based on current URL
function updateBackButtonVisibility() {
    const backButton = document.getElementById('back-button');
    if (!backButton) return;
    
    const currentPath = window.location.pathname;
    // Show back button if not on home page
    if (currentPath === '/' || currentPath === '') {
        addClass('back-button', 'hidden');
    } else {
        removeClass('back-button', 'hidden');
    }
}

const liveProgrammingSchedule = [
    {
        title: 'Razão Para Viver',
        description: 'Compromisso com a excelência na comunicação da verdade bíblica e sua prática.',
        days: [1, 2, 3, 4, 5], // Monday - Friday
        start: '07:00',
        end: '08:00'
    },
    {
        title: 'Jornal Seara',
        description: 'As principais notícias da região com conteúdo cristão e compromisso com a verdade.',
        days: [1, 2, 3, 4, 5],
        start: '12:00',
        end: '14:00'
    },
    {
        title: 'Tarde Musical',
        description: 'Louvores que edificam e momentos de reflexão para a sua tarde.',
        days: [1, 2, 3, 4, 5],
        start: '14:00',
        end: '17:00'
    },
    {
        title: 'Programação Ao Vivo',
        description: 'Louvores, mensagens e participação dos ouvintes com a equipe Rádio Seara.',
        days: [0, 6], // Weekend
        start: '06:00',
        end: '21:00'
    }
];

const defaultLiveProgram = {
    title: 'Rádio Seara Ao Vivo',
    description: 'Acompanhe a transmissão ao vivo e fique por dentro da nossa programação.'
};

async function ensureLiveStreamSource(){
    if (!stream) return;
    const sourceEl = stream.getElementsByTagName('source')[0];
    if (!sourceEl) return;
    
    const currentSrc = sourceEl.getAttribute('src');
    
    // Detect which stream is currently set (if any)
    if (currentSrc) {
        if (currentSrc.includes('stream102')) {
            currentStreamId = '102';
        } else if (currentSrc.includes('stream104')) {
            currentStreamId = '104';
        }
    }
    
    // Only set default if no source is set and we're not already playing
    if (!currentSrc && !currentStreamId) {
        const defaultStreamId = await determineClosestStream();
        currentStreamId = defaultStreamId;
        sourceEl.setAttribute('src', STREAM_CONFIG[defaultStreamId].url);
        stream.load();
    }
}

function timeToMinutes(time){
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function findProgramFor(date){
    const day = date.getDay(); // 0 - Sunday
    const currentMinutes = date.getHours() * 60 + date.getMinutes();

    return liveProgrammingSchedule.find(program => {
        if(!program.days.includes(day)){
            return false;
        }
        const start = timeToMinutes(program.start);
        const end = timeToMinutes(program.end);
        if(end < start){
            // Overnight program (e.g., 22:00 - 02:00)
            return currentMinutes >= start || currentMinutes < end;
        }
        return currentMinutes >= start && currentMinutes < end;
    }) || defaultLiveProgram;
}

function updateLiveBanner(now = new Date()){
    const titleEl = document.getElementById('live-program-title');
    const descriptionEl = document.getElementById('live-program-description');
    if(!titleEl || !descriptionEl){
        return;
    }

    const program = findProgramFor(now);
    titleEl.textContent = program.title;
    descriptionEl.textContent = program.description;
}

//Mark: Player Controls

var stream = document.getElementById("player");
var streamFullTime = 0 //in seconds
var streamTitle = '';
var scrubUpdater
stream.volume = 0.5;
stream.addEventListener("volumechange", function() {
    // Show volume slider only on non-iOS devices
    // iOS typically doesn't allow programmatic volume control
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) {
        removeClass("volume", "hidden");
    }
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
        playStream();
      }
  });
  
  navigator.mediaSession.setActionHandler('pause', () => {
    if (!player.paused) {
        pauseStream();
      }
  });
}    
    


async function toggleLiveStream(playButton, streamId = null){
    const buttonId = playButton && playButton.id ? playButton.id : 'live-stream-play-button';
    if (!stream) return;

    const sourceEl = stream.getElementsByTagName('source')[0];
    if (!sourceEl) return;

    // Determine which stream to use
    let targetStreamId = streamId;
    if (!targetStreamId) {
        if (currentStreamId) {
            targetStreamId = currentStreamId;
        } else {
            targetStreamId = await determineClosestStream();
        }
    }

    const currentSrc = sourceEl.getAttribute('src');
    const targetStreamUrl = STREAM_CONFIG[targetStreamId].url;
    const switchingToLive = !currentSrc || (!currentSrc.includes('stream102') && !currentSrc.includes('stream104'));
    const switchingStream = currentSrc !== targetStreamUrl;
    // Reload if switching streams, or if currentStreamId doesn't match (including when it's null)
    const needsReload = switchingToLive || switchingStream || !currentStreamId || currentStreamId !== targetStreamId;

    if (needsReload) {
        // Pause if currently playing
        const wasPlaying = !stream.paused;
        if (wasPlaying) {
            stream.pause();
        }
        
        sourceEl.setAttribute('src', targetStreamUrl);
        currentStreamId = targetStreamId;
        streamFullTime = 0;
        streamTitle = 'Rádio Seara Ao Vivo';
        stream.load();
        
        // Resume if was playing
        if (wasPlaying) {
            stream.play().catch(() => {});
        }
    }

    // Always update UI when playing live stream (even if source was already set)
    if (!currentStreamId || currentStreamId !== targetStreamId) {
        currentStreamId = targetStreamId;
    }
    updateLiveStreamUI(targetStreamId);

    const shouldPlay = stream.paused || needsReload;

    if (shouldPlay) {
        removeClass("bar-player-wrapper", "closed");
        showStreamToggle();
        analyticsTriggered = 0;
        playStream();
    } else {
        pauseStream();
    }
}

// Switch between streams (called from toggle buttons)
function switchStream(streamId) {
    if (currentStreamId === streamId) return;
    
    // Save preference to localStorage
    localStorage.setItem('preferredStreamId', streamId);
    
    const wasPlaying = !stream.paused;
    toggleLiveStream(null, streamId);
    
    // If was playing, ensure it continues playing
    if (wasPlaying && stream.paused) {
        stream.play().catch(() => {});
    }
}

// Update UI elements for live stream
function updateLiveStreamUI(streamId) {
    const config = STREAM_CONFIG[streamId];
    const playerTitle = document.getElementById("bar-player-title");
    const playerSubtitle = document.getElementById("bar-player-subtitle");
    const totalTime = document.getElementById("total-time");
    const artwork = document.getElementById("bar-player-artwork");

    if (playerTitle) {
        playerTitle.textContent = "Rádio Seara Ao Vivo";
    }
    if (playerSubtitle) {
        playerSubtitle.textContent = config.name;
    }
    if (totalTime) {
        totalTime.textContent = "--:--";
    }
    if (artwork) {
        artwork.setAttribute('src', LIVE_STREAM_ARTWORK);
    }

    // Update Media Session metadata
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Rádio Seara',
            artist: config.name,
            artwork: [
                {
                    src: LIVE_STREAM_ARTWORK,
                    sizes: '256x256',
                    type: 'image/webp'
                },
                {
                    src: LIVE_STREAM_ARTWORK,
                    sizes: '512x512',
                    type: 'image/webp'
                }
            ]
        });
    }
    
    // Update toggle button states
    updateStreamToggleUI(streamId);
}

function toggleStream(playButton){
    if (stream.paused){
        playStream()
    }
    else{
        pauseStream()
    }
}
function playStream(){
    if (scrubUpdater) {
        clearInterval(scrubUpdater);
    }
    addClass("bar-play-button", "playing");
    stream.play().catch(() => {});
    scrubUpdater = window.setInterval(updateScrubber, 1000);
}

function pauseStream(){
    removeClass("bar-play-button", "playing");
    stream.pause();
    clearInterval(scrubUpdater)
}

// Helper function to update Media Session metadata for episodes
function updateMediaSessionForEpisode(title, programName, artworkUrl) {
    if ('mediaSession' in navigator) {
        const resolvedArtwork = artworkUrl && artworkUrl.trim() !== "" ? artworkUrl : LIVE_STREAM_ARTWORK;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: programName,
            album: 'Rádio Seara',
            artwork: [
                {
                    src: resolvedArtwork,
                    sizes: '256x256',
                    type: 'image/webp'
                },
                {
                    src: resolvedArtwork,
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

function showStreamToggle() {
    const scrubber = document.getElementById("scrubber");
    const toggleWrapper = document.getElementById("stream-toggle-wrapper");
    if (scrubber) {
        addClass("scrubber", "hidden");
    }
    if (toggleWrapper) {
        removeClass("stream-toggle-wrapper", "hidden");
    }
}

function showScrubber() {
    const scrubber = document.getElementById("scrubber");
    const toggleWrapper = document.getElementById("stream-toggle-wrapper");
    if (scrubber) {
        removeClass("scrubber", "hidden");
    }
    if (toggleWrapper) {
        addClass("stream-toggle-wrapper", "hidden");
    }
}

// Update toggle button active states
function updateStreamToggleUI(activeStreamId) {
    const btn102 = document.getElementById("stream-toggle-102");
    const btn104 = document.getElementById("stream-toggle-104");
    
    if (btn102) {
        if (activeStreamId === '102') {
            btn102.classList.add('active');
        } else {
            btn102.classList.remove('active');
        }
    }
    
    if (btn104) {
        if (activeStreamId === '104') {
            btn104.classList.add('active');
        } else {
            btn104.classList.remove('active');
        }
    }
}

function playEpisode(audioUrl, title, time, programName, imageUrl){
    removeClass("bar-player-wrapper", "closed");
    var player = document.getElementById("player");
    var playerTitle = document.getElementById("bar-player-title");
    var playerSubtitle = document.getElementById("bar-player-subtitle");
    var totalTime = document.getElementById("total-time");
    var artwork = document.getElementById("bar-player-artwork");
    
    if (!player || !playerTitle || !totalTime) {
        console.error('Player elements not found');
        return;
    }

    // Reset stream ID when playing episode
    currentStreamId = null;
    
    player.getElementsByTagName('source')[0].setAttribute('src', audioUrl);
    playerTitle.innerHTML = title;
    if (playerSubtitle) {
        playerSubtitle.textContent = programName || '';
    }
    var formattedTime = new Date(time * 1000).toISOString().substr(11, 8)
    if (formattedTime.substr(0,2) == "00") {
        formattedTime = formattedTime.substr(3, formattedTime.length - 3)
    }
    totalTime.innerHTML = formattedTime
    streamFullTime = time
    streamTitle = title;
    analyticsTriggered = 0;
    updateSliderVariables();  //The episode title can change the scrubber slider's length.

    if (artwork) {
        if (imageUrl && imageUrl.trim() !== "") {
            artwork.setAttribute('src', imageUrl);
        } else {
            artwork.setAttribute('src', LIVE_STREAM_ARTWORK);
        }
    }
    
    // Show scrubber for episodes
    showScrubber();
    
    // Update Media Session metadata for lock screen
    updateMediaSessionForEpisode(title, programName, imageUrl);
    
    stream.load();
    playStream()
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
        pauseStream();
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
var scrubberRect;
var analyticsTriggered = 0;

if (document.getElementById("scrubber-slider")){
    scrubberActiveRange = document.getElementById("scrubber-active-range");
    scrubberContainer = document.getElementById("scrubber-slider");
    scrubberHandleDiameter = document.getElementById("scrubber-handle").getBoundingClientRect().width - 2;
    scrubberRect = scrubberContainer.getBoundingClientRect();
}

function updateScrubber(){
    // Only update scrubber if playing an episode (live stream has no scrubber)
    if (streamFullTime > 0 && scrubberRect) {
        let x = stream.currentTime / streamFullTime * (scrubberRect.width - scrubberHandleDiameter) + scrubberHandleDiameter
        scrubberActiveRange.style.width = x + "px"
        displayFormattedCurrentTime(stream.currentTime)
        streamingAnalytics(stream.currentTime, streamFullTime)
    }
}

function displayFormattedCurrentTime(seconds){

    var currentTime = document.getElementById("current-time")
    var formattedTime = new Date(seconds * 1000).toISOString().substr(11, 8)
    if (formattedTime.substr(0,2) == "00") {
        formattedTime = formattedTime.substr(3, formattedTime.length - 3)
    }
    currentTime.innerHTML = formattedTime
}

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
    const element = document.getElementById(id);
    if (element) {
        element.classList.add(newclass);
    }
}

function removeClass(id, oldclass){
    const element = document.getElementById(id);
    if (element) {
        element.classList.remove(oldclass);
    }
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
