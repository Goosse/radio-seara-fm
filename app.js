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

//Mark: YouTube Autoplay Based on Connection Speed
// COMMENTED OUT - Disabled to avoid interference with live audio streams
// function shouldAutoplayYouTube() {
//     // Check Network Information API
//     if (navigator.connection) {
//         const connection = navigator.connection;
//         const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
//         const downlink = connection.downlink; // Bandwidth in Mbps
//         
//         // Autoplay if 4g connection or downlink > 1.5 Mbps
//         if (effectiveType === '4g' || (downlink && downlink > 1.5)) {
//             return true;
//         }
//     }
//     // Default to no autoplay for slower connections
//     return false;
// }

// function setupYouTubeAutoplay() {
//     const shouldAutoplay = shouldAutoplayYouTube();
//     
//     // Update home page YouTube embed
//     const homeEmbed = document.getElementById('home-youtube-embed');
//     if (homeEmbed) {
//         const currentSrc = homeEmbed.src;
//         // Remove autoplay first to get clean URL
//         let cleanSrc = currentSrc.replace(/[&?]autoplay=1/, '').replace(/autoplay=1[&?]/, '');
//         
//         if (shouldAutoplay) {
//             // Add autoplay parameter
//             const separator = cleanSrc.includes('?') ? '&' : '?';
//             homeEmbed.src = cleanSrc + separator + 'autoplay=1';
//         } else {
//             // Ensure autoplay is removed
//             homeEmbed.src = cleanSrc;
//         }
//     }
//     
//     // Update parceiros page YouTube embed
//     const parceirosEmbed = document.getElementById('parceiros-youtube-embed');
//     if (parceirosEmbed) {
//         const currentSrc = parceirosEmbed.src;
//         // Remove autoplay first to get clean URL
//         let cleanSrc = currentSrc.replace(/[&?]autoplay=1/, '').replace(/autoplay=1[&?]/, '');
//         
//         if (shouldAutoplay) {
//             // Add autoplay parameter
//             const separator = cleanSrc.includes('?') ? '&' : '?';
//             parceirosEmbed.src = cleanSrc + separator + 'autoplay=1';
//         } else {
//             // Ensure autoplay is removed
//             parceirosEmbed.src = cleanSrc;
//         }
//     }
// }

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
        url: 'https://radioseara.fm/stream102', //'https://radioseara.fm/stream102'
        name: 'Nova Russas 102,7',
        coords: { lat: -4.707070, lon: -40.563689 }
    },
    '104': {
        url: 'https://radioseara.fm/stream104', //'https://radioseara.fm/stream104'
        name: 'Ibiapina 104,7',
        coords: { lat: -3.944082, lon: -40.849463 }
    }
};

const LIVE_STREAM_ARTWORK = 'https://radioseara.fm/recursos/capas/semmarca/ao-vivo.webp';
// Loading indicator management (only for bar player)
function showLoadingIndicator() {
    const barButton = document.getElementById('bar-play-button');
    if (barButton) barButton.classList.add('buffering');
}

function hideLoadingIndicator() {
    const barButton = document.getElementById('bar-play-button');
    if (barButton) barButton.classList.remove('buffering');
}

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
    updateLiveSchedule();
    renderListenProgress();
    updateBackButtonVisibility();
    // setupYouTubeAutoplay(); // COMMENTED OUT - Disabled to avoid interference with live audio streams
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

//Mark: Live Schedule
// The schedule is defined in LiveSchedule.swift and embedded in the page as JSON.
function getLiveSchedule(){
    const dataEl = document.getElementById('live-schedule');
    if(!dataEl){
        return null;
    }
    try {
        return JSON.parse(dataEl.textContent);
    } catch (error) {
        console.error('Invalid live schedule data:', error);
        return null;
    }
}

// Program times are station time, so use Nova Russas' clock rather than the listener's.
const STATION_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function stationTime(date){
    const parts = {};
    STATION_TIME_FORMAT.formatToParts(date).forEach(part => {
        parts[part.type] = part.value;
    });
    return {
        day: WEEKDAY_INDEX[parts.weekday],
        minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute)
    };
}

function timeToMinutes(time){
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Returns the index of the program on the air, or -1 when none is.
function findProgramIndex(programs, time){
    return programs.findIndex(program => {
        if(!program.days.includes(time.day)){
            return false;
        }
        const start = timeToMinutes(program.start);
        const end = timeToMinutes(program.end);
        if(end < start){
            // Overnight program (e.g., 22:00 - 02:00)
            return time.minutes >= start || time.minutes < end;
        }
        return time.minutes >= start && time.minutes < end;
    });
}

// The next `count` program starts within the coming week, soonest first.
function findUpcomingPrograms(programs, time, count){
    const upcoming = [];
    programs.forEach(program => {
        const start = timeToMinutes(program.start);
        for(let dayOffset = 0; dayOffset <= 7; dayOffset++){
            if(!program.days.includes((time.day + dayOffset) % 7)){
                continue;
            }
            const minutesUntil = dayOffset * 24 * 60 + start - time.minutes;
            if(minutesUntil > 0){
                upcoming.push({ program, minutesUntil, dayOffset });
            }
        }
    });
    return upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil).slice(0, count);
}

function dayLabel(entry, time){
    // A program starting at midnight tonight reads better as "às 00:00" than "amanhã às 00:00".
    if(entry.dayOffset === 0 || (entry.dayOffset === 1 && entry.program.start === '00:00')){
        return '';
    }
    if(entry.dayOffset === 1){
        return 'amanhã';
    }
    return WEEKDAY_NAMES[(time.day + entry.dayOffset) % 7];
}

function describeNextProgram(next, time){
    const day = dayLabel(next, time);
    return next.program.title + ' ' + (day ? day + ' ' : '') + 'às ' + next.program.start;
}

function renderUpcomingList(listEl, upcoming, time){
    listEl.replaceChildren(...upcoming.map(entry => {
        const item = document.createElement('li');
        const timeEl = document.createElement('span');
        const titleEl = document.createElement('span');
        const day = dayLabel(entry, time);
        timeEl.className = 'time';
        timeEl.textContent = (day ? day + ' ' : '') + entry.program.start;
        titleEl.className = 'program-title';
        titleEl.textContent = entry.program.title;
        item.append(timeEl, titleEl);
        return item;
    }));
}

function updateLiveSchedule(now = new Date()){
    const schedule = getLiveSchedule();
    if(!schedule){
        return;
    }
    const time = stationTime(now);
    const currentIndex = findProgramIndex(schedule.programs, time);
    updateLiveBanner(schedule, currentIndex, time);
    highlightCurrentProgram(currentIndex, time);
}

function updateLiveBanner(schedule, currentIndex, time){
    const titleEl = document.getElementById('live-program-title');
    const descriptionEl = document.getElementById('live-program-description');
    if(!titleEl || !descriptionEl){
        return;
    }

    const program = currentIndex === -1 ? schedule.fallback : schedule.programs[currentIndex];
    titleEl.textContent = program.title;
    descriptionEl.textContent = program.description;

    const upcoming = findUpcomingPrograms(schedule.programs, time, 3);
    const listEl = document.getElementById('live-upcoming-list');
    if(listEl){
        renderUpcomingList(listEl, upcoming, time);
    }

    const nextEl = document.getElementById('live-program-next');
    if(nextEl){
        nextEl.textContent = upcoming.length ? describeNextProgram(upcoming[0], time) : 'Ver programação completa';
    }
}

function highlightCurrentProgram(currentIndex, time){
    document.querySelectorAll('.schedule-day').forEach(dayEl => {
        dayEl.classList.toggle('today', Number(dayEl.dataset.day) === time.day);
    });
    document.querySelectorAll('.schedule-program').forEach(programEl => {
        const onAir = Number(programEl.dataset.day) === time.day &&
                      Number(programEl.dataset.programIndex) === currentIndex;
        programEl.classList.toggle('on-air', onAir);
    });
}

// Keep the banner and highlight current as programs start and end.
setInterval(() => updateLiveSchedule(), 60 * 1000);

//Mark: Player Controls

var stream = document.getElementById("player");
var streamFullTime = 0 //in seconds
var streamTitle = '';
var scrubUpdater
stream.volume = 0.5;

stream.addEventListener("loadstart", function() {
    if (!stream.paused) {
        showLoadingIndicator();
    }
});
stream.addEventListener("canplay", function() {
    hideLoadingIndicator();
});

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

// Lock-screen and headset seeking, only while an episode is loaded.
const EPISODE_SEEK_ACTIONS = {
    seekbackward: details => skipBy(-(details.seekOffset || 15)),
    seekforward: details => skipBy(details.seekOffset || 30),
    seekto: details => seekTo(details.seekTime)
};

function setEpisodeSeekHandlers(enabled){
    if (!('mediaSession' in navigator)) return;
    Object.entries(EPISODE_SEEK_ACTIONS).forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, enabled ? handler : null);
        } catch (error) {} // Older browsers reject actions they don't know.
    });
    if (!enabled && navigator.mediaSession.setPositionState) {
        try {
            navigator.mediaSession.setPositionState();
        } catch (error) {}
    }
}

function updatePositionState(){
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !currentEpisodeUrl) return;
    const duration = episodeDuration();
    if (!(duration > 0)) return;
    try {
        navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: stream.playbackRate,
            position: Math.min(stream.currentTime, duration)
        });
    } catch (error) {}
}
['seeked', 'ratechange', 'play', 'pause'].forEach(type => stream.addEventListener(type, updatePositionState));

//Mark: Skip and Speed
const PLAYBACK_RATES = [1, 1.25, 1.5, 2];

function episodeDuration(){
    return Number.isFinite(stream.duration) && stream.duration > 0 ? stream.duration : streamFullTime;
}

function skipBy(seconds){
    seekTo(stream.currentTime + seconds);
}

function seekTo(seconds){
    if (!(streamFullTime > 0)) return;
    stream.currentTime = Math.min(Math.max(seconds, 0), episodeDuration());
    updateScrubber();
    saveCurrentProgress();
}

function savedPlaybackRate(){
    const rate = Number(localStorage.getItem('playbackRate'));
    return PLAYBACK_RATES.includes(rate) ? rate : 1;
}

function applyPlaybackRate(rate){
    stream.defaultPlaybackRate = rate;
    stream.playbackRate = rate;
    const button = document.getElementById('speed-toggle');
    if (button) {
        button.textContent = String(rate).replace('.', ',') + '×';
    }
}

function cycleSpeed(){
    const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(stream.playbackRate) + 1) % PLAYBACK_RATES.length];
    localStorage.setItem('playbackRate', next);
    applyPlaybackRate(next);
}

//Mark: Listening Progress
// Each episode's position is kept on the listener's device, keyed by audio URL.
const PROGRESS_KEY = 'listenProgress';
const PROGRESS_MAX_ENTRIES = 50;
const PROGRESS_SAVE_INTERVAL = 5000;
const RESUME_MIN_SECONDS = 15;
const RESUME_REWIND_SECONDS = 20; // Replay a little so listeners can pick the thread back up.
const FINISHED_MARGIN_SECONDS = 30;

// Set only after the saved position is restored, so a fresh load can't overwrite it with 0.
let currentEpisodeUrl = null;
let pendingEpisodeUrl = null;
let lastProgressSave = 0;

function loadProgress(){
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch (error) {
        return {};
    }
}

function saveProgress(url, position, duration){
    const progress = loadProgress();
    const previous = progress[url];
    progress[url] = {
        t: Math.floor(position),
        d: Math.round(duration),
        done: position >= duration - FINISHED_MARGIN_SECONDS || Boolean(previous && previous.done),
        updated: Date.now()
    };
    Object.keys(progress)
        .sort((a, b) => progress[b].updated - progress[a].updated)
        .slice(PROGRESS_MAX_ENTRIES)
        .forEach(oldUrl => delete progress[oldUrl]);
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (error) {} // Storage full or disabled (private browsing).
    renderListenProgress(url);
}

function saveCurrentProgress(){
    lastProgressSave = Date.now();
    const duration = episodeDuration();
    if (currentEpisodeUrl && duration > 0) {
        saveProgress(currentEpisodeUrl, stream.currentTime, duration);
    }
}

function isUnfinished(entry){
    return entry.t >= RESUME_MIN_SECONDS && entry.t < entry.d - FINISHED_MARGIN_SECONDS;
}

stream.addEventListener('loadedmetadata', () => {
    if (!pendingEpisodeUrl) return;
    const entry = loadProgress()[pendingEpisodeUrl];
    if (entry && isUnfinished(entry)) {
        stream.currentTime = Math.max(entry.t - RESUME_REWIND_SECONDS, 0);
    }
    currentEpisodeUrl = pendingEpisodeUrl;
    pendingEpisodeUrl = null;
    updateScrubber();
    updatePositionState();
});
stream.addEventListener('pause', saveCurrentProgress);
stream.addEventListener('ended', () => {
    saveCurrentProgress();
    removeClass("bar-play-button", "playing");
    clearInterval(scrubUpdater);
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveCurrentProgress();
    }
});

function renderListenProgress(onlyUrl){
    const progress = loadProgress();
    document.querySelectorAll('[data-audio-url]').forEach(item => {
        const url = item.dataset.audioUrl;
        const info = item.querySelector('.info');
        if ((onlyUrl && url !== onlyUrl) || !info) return;

        const entry = progress[url];
        const unfinished = entry && isUnfinished(entry);
        let el = info.querySelector('.listen-progress');
        if (!entry || !(unfinished || entry.done)) {
            if (el) el.remove();
            return;
        }
        if (!el) {
            el = document.createElement('div');
            el.className = 'listen-progress';
            el.innerHTML = '<span class="track"><span class="fill"></span></span><span class="label"></span>';
            const anchor = info.querySelector('.date-time') || info.querySelector('h3');
            anchor ? anchor.after(el) : info.prepend(el);
        }
        el.classList.toggle('finished', !unfinished);
        el.querySelector('.fill').style.width = (unfinished ? entry.t / entry.d * 100 : 100) + '%';
        el.querySelector('.label').textContent = unfinished ? 'Continuar de ' + formatTime(entry.t) : 'Ouvido ✓';
    });
}
async function playLiveStream(){
    let streamId = await determineClosestStream();
    switchStream(streamId);
    showStreamToggle();
    removeClass("bar-player-wrapper", "closed");
    updateSliderVariables()
    playStream();
}

async function switchStream(streamId){ //Caled ny the toggle buttons and the play live stream button.
    const wasPlaying = !stream.paused;
    // Save preference to localStorage
    localStorage.setItem('preferredStreamId', streamId);

    const sourceEl = stream.getElementsByTagName('source')[0];
    if (!sourceEl) return;

    const targetStreamUrl = STREAM_CONFIG[streamId].url;
  
    saveCurrentProgress();
    currentEpisodeUrl = null;
    pendingEpisodeUrl = null;
    setEpisodeSeekHandlers(false);

    sourceEl.setAttribute('src', targetStreamUrl);
    streamFullTime = 0;
    streamTitle = 'Rádio Seara Ao Vivo';
    
    stream.load();
    applyPlaybackRate(1); // The live stream always plays at normal speed.

    if (wasPlaying) {
        playStream();
    }
    updateLiveStreamUI(streamId);
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
        showLoadingIndicator();
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
    stream.play().then(() => {
        hideLoadingIndicator();
    }).catch(() => {});
    scrubUpdater = window.setInterval(updateScrubber, 1000);
}

function pauseStream(){
    removeClass("bar-play-button", "playing");
    stream.pause();
    clearInterval(scrubUpdater);
    // Hide loading indicator when paused
    hideLoadingIndicator();
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

function showStreamToggle() {
    const scrubber = document.getElementById("scrubber");
    const toggleWrapper = document.getElementById("stream-toggle-wrapper");
    if (scrubber) {
        addClass("scrubber", "hidden");
    }
    addClass("episode-controls", "hidden");
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
    removeClass("episode-controls", "hidden");
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

    saveCurrentProgress();
    currentEpisodeUrl = null;
    pendingEpisodeUrl = audioUrl;

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
    setEpisodeSeekHandlers(true);
    
    stream.load();
    applyPlaybackRate(savedPlaybackRate());
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
    }
    if (Date.now() - lastProgressSave > PROGRESS_SAVE_INTERVAL) {
        saveCurrentProgress();
    }
}

function formatTime(seconds){
    var formattedTime = new Date(seconds * 1000).toISOString().substr(11, 8)
    if (formattedTime.substr(0,2) == "00") {
        formattedTime = formattedTime.substr(3, formattedTime.length - 3)
    }
    return formattedTime
}

function displayFormattedCurrentTime(seconds){
    document.getElementById("current-time").innerHTML = formatTime(seconds)
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
    volumeSlide(event)
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
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.dataset.scrollY = scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    if (scrollbarWidth > 0) {
        document.body.style.left = `-${scrollbarWidth/2}px`;
        const barPlayer = document.getElementById('bar-player-wrapper');
        if (barPlayer) {
            barPlayer.style.paddingRight = `${scrollbarWidth}px`;
        }
    }
}

function enableScrolling(){
    const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    delete document.body.dataset.scrollY;

    const barPlayer = document.getElementById('bar-player-wrapper');
    if (barPlayer) {
        barPlayer.style.paddingRight = '';
    }

    window.scrollTo(0, scrollY);
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
