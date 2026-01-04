 //Mark: Debug Logging with Sentry
// Configure your Sentry DSN here (get it from https://sentry.io)
const SENTRY_DSN = 'https://57591e4d3698015d44d524db1aa52f2d@o4510596844879872.ingest.us.sentry.io/4510596854579200'; // Set your Sentry DSN here, e.g., 'https://xxxxx@xxxxx.ingest.sentry.io/xxxxx'
const MAX_LOG_ENTRIES = 1000; // Limit localStorage size
const SENTRY_BATCH_SIZE = 10; // Send logs to Sentry in batches
const SENTRY_BATCH_INTERVAL = 10000; // Send batch every 10 seconds

let sentryLogQueue = [];
let lastSentrySend = 0;

let sessionId = localStorage.getItem('debugSessionId') || 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
if (!localStorage.getItem('debugSessionId')) {
    localStorage.setItem('debugSessionId', sessionId);
}

// Initialize Sentry if DSN is configured
let sentryInitialized = false;
function initializeSentry() {
    if (sentryInitialized || !SENTRY_DSN) return;
    
    // Wait for Sentry to be available
    if (window.Sentry) {
        try {
            window.Sentry.init({
                dsn: SENTRY_DSN,
                environment: window.location.hostname.includes('netlify.app') ? 'preview' : 'production',
                tracesSampleRate: 1.0, // Capture 100% of transactions for debugging
                beforeSend(event, hint) {
                    // Add session ID to all events
                    event.tags = event.tags || {};
                    event.tags.sessionId = sessionId;
                    return event;
                }
            });
            
            // Set user context
            window.Sentry.setUser({
                id: sessionId,
                username: `session-${sessionId}`
            });
            
            // Set device context
            window.Sentry.setContext('device', {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                connectionType: navigator.connection?.effectiveType || 'unknown',
                url: window.location.href
            });
            
            sentryInitialized = true;
            console.log('[DEBUG] Sentry initialized');
        } catch (e) {
            console.error('[DEBUG] Sentry initialization failed:', e);
        }
    } else {
        // Retry after a short delay if Sentry isn't loaded yet
        setTimeout(initializeSentry, 100);
    }
}

// Try to initialize Sentry when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSentry);
} else {
    initializeSentry();
}

// Also try immediately and after a delay
initializeSentry();
setTimeout(initializeSentry, 500);

function debugLog(location, message, data, hypothesisId) {
    const logData = {
        location, 
        message, 
        data, 
        timestamp: Date.now(), 
        sessionId: sessionId, 
        runId: 'run1', 
        hypothesisId
    };
    console.log('[DEBUG]', logData); // Console fallback
    
    // Store in localStorage (backup)
    try {
        let logs = JSON.parse(localStorage.getItem('debugLogs') || '[]');
        logs.push(logData);
        // Keep only last MAX_LOG_ENTRIES
        if (logs.length > MAX_LOG_ENTRIES) {
            logs = logs.slice(-MAX_LOG_ENTRIES);
        }
        localStorage.setItem('debugLogs', JSON.stringify(logs));
    } catch (e) {
        console.warn('[DEBUG] localStorage write failed:', e);
    }
    
    // Queue for Sentry if available
    if (SENTRY_DSN) {
        sentryLogQueue.push(logData);
        
        // Send immediately for important events
        const isImportant = message.includes('error') || 
                           message.includes('stalled') || 
                           message.includes('rejected') ||
                           message.includes('recovery');
        
        const now = Date.now();
        const shouldSend = isImportant || 
                          sentryLogQueue.length >= SENTRY_BATCH_SIZE || 
                          (now - lastSentrySend) >= SENTRY_BATCH_INTERVAL;
        
        if (shouldSend && sentryLogQueue.length > 0) {
            sendSentryBatch();
        }
    }
}

// Send batched logs to Sentry
function sendSentryBatch() {
    if (!window.Sentry || !SENTRY_DSN || !sentryInitialized || sentryLogQueue.length === 0) {
        // Retry initialization if needed
        if (SENTRY_DSN && !sentryInitialized) {
            initializeSentry();
        }
        return;
    }
    
    const logsToSend = [...sentryLogQueue];
    sentryLogQueue = [];
    lastSentrySend = Date.now();
    
    try {
        
        // Send each log as a breadcrumb
        logsToSend.forEach(log => {
            window.Sentry.addBreadcrumb({
                category: 'debug',
                message: log.message,
                level: 'info',
                data: {
                    location: log.location,
                    hypothesisId: log.hypothesisId,
                    ...log.data
                },
                timestamp: log.timestamp / 1000
            });
        });
        
        // Send as a single event with all logs
        const importantLogs = logsToSend.filter(log => 
            log.message.includes('error') || 
            log.message.includes('stalled') || 
            log.message.includes('rejected')
        );
        
        if (importantLogs.length > 0) {
            // Send important logs as individual events
            importantLogs.forEach(log => {
                // Serialize data properly
                const serializedData = {};
                if (log.data && typeof log.data === 'object') {
                    try {
                        Object.keys(log.data).forEach(key => {
                            const value = log.data[key];
                            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                                serializedData[key] = JSON.parse(JSON.stringify(value));
                            } else {
                                serializedData[key] = value;
                            }
                        });
                    } catch (e) {
                        serializedData._serializationError = e.message;
                        serializedData._rawData = String(log.data);
                    }
                } else {
                    serializedData = log.data;
                }
                
                window.Sentry.captureMessage(`[${log.hypothesisId}] ${log.message}`, {
                    level: 'warning',
                    tags: {
                        location: log.location,
                        hypothesisId: log.hypothesisId,
                        sessionId: sessionId,
                        logType: 'debug'
                    },
                    extra: {
                        ...serializedData,
                        timestamp: log.timestamp,
                        fullLog: {
                            message: log.message,
                            location: log.location,
                            hypothesisId: log.hypothesisId
                        }
                    }
                });
            });
        } else {
            // Send batch summary for non-critical logs
            window.Sentry.captureMessage(`Debug Log Batch (${logsToSend.length} entries)`, {
                level: 'info',
                tags: {
                    sessionId: sessionId,
                    logType: 'debug-batch',
                    batchSize: logsToSend.length
                },
                extra: {
                    logs: logsToSend.map(log => {
                        // Properly serialize the data object
                        const serializedData = {};
                        if (log.data && typeof log.data === 'object') {
                            try {
                                // Deep clone and serialize the data object
                                Object.keys(log.data).forEach(key => {
                                    const value = log.data[key];
                                    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                                        serializedData[key] = JSON.parse(JSON.stringify(value));
                                    } else {
                                        serializedData[key] = value;
                                    }
                                });
                            } catch (e) {
                                serializedData._serializationError = e.message;
                                serializedData._rawData = String(log.data);
                            }
                        } else {
                            serializedData = log.data;
                        }
                        
                        return {
                            message: log.message,
                            location: log.location,
                            hypothesisId: log.hypothesisId,
                            timestamp: log.timestamp,
                            data: serializedData
                        };
                    })
                }
            });
        }
    } catch (e) {
        console.warn('[DEBUG] Sentry batch send failed:', e);
        // Put logs back in queue if send failed
        if (sentryLogQueue.length < MAX_LOG_ENTRIES) {
            sentryLogQueue = [...logsToSend, ...sentryLogQueue].slice(0, MAX_LOG_ENTRIES);
        }
    }
}

// Send logs periodically
setInterval(() => {
    if (sentryLogQueue.length > 0) {
        sendSentryBatch();
    }
}, SENTRY_BATCH_INTERVAL);

// Send logs on page unload
window.addEventListener('beforeunload', () => {
    if (sentryLogQueue.length > 0) {
        sendSentryBatch();
    }
});

// Export function to retrieve logs (call from console: getDebugLogs())
window.getDebugLogs = function() {
    try {
        const logs = JSON.parse(localStorage.getItem('debugLogs') || '[]');
        console.log(`Retrieved ${logs.length} log entries`);
        return logs;
    } catch (e) {
        console.error('Failed to retrieve logs:', e);
        return [];
    }
};

// Export function to clear logs (call from console: clearDebugLogs())
window.clearDebugLogs = function() {
    localStorage.removeItem('debugLogs');
    console.log('Debug logs cleared');
};

// Export function to analyze logs for stream stop issues
window.analyzeDebugLogs = function() {
    try {
        const logs = JSON.parse(localStorage.getItem('debugLogs') || '[]');
        console.log(`Analyzing ${logs.length} log entries...`);
        
        // Find all periodic checks and look for state changes
        const periodicChecks = logs.filter(log => log.message === 'Periodic audio state check');
        const stalledEvents = logs.filter(log => log.message === 'Audio stalled event');
        const errorEvents = logs.filter(log => log.message === 'Audio error event');
        const waitingEvents = logs.filter(log => log.message === 'Audio waiting event');
        
        console.log('\n=== Analysis Results ===');
        console.log(`Periodic checks: ${periodicChecks.length}`);
        console.log(`Stalled events: ${stalledEvents.length}`);
        console.log(`Error events: ${errorEvents.length}`);
        console.log(`Waiting events: ${waitingEvents.length}`);
        
        // Find transitions from playing to not playing
        let lastPlayingState = null;
        const stateTransitions = [];
        periodicChecks.forEach((log, index) => {
            const wasPlaying = !log.data.paused;
            if (lastPlayingState !== null && lastPlayingState !== wasPlaying) {
                stateTransitions.push({
                    index: index,
                    timestamp: log.timestamp,
                    from: lastPlayingState ? 'playing' : 'paused',
                    to: wasPlaying ? 'playing' : 'paused',
                    readyState: log.data.readyState,
                    networkState: log.data.networkState,
                    error: log.data.error
                });
            }
            lastPlayingState = wasPlaying;
        });
        
        if (stateTransitions.length > 0) {
            console.log('\n=== State Transitions ===');
            stateTransitions.forEach(t => {
                console.log(`Transition ${t.from} -> ${t.to} at ${new Date(t.timestamp).toLocaleTimeString()}, readyState: ${t.readyState}, networkState: ${t.networkState}`);
            });
        }
        
        // Check for stalled events with details
        if (stalledEvents.length > 0) {
            console.log('\n=== Stalled Events ===');
            stalledEvents.forEach((log, i) => {
                console.log(`Stalled event ${i+1} at ${new Date(log.timestamp).toLocaleTimeString()}:`, log.data);
            });
        }
        
        // Check for error events
        if (errorEvents.length > 0) {
            console.log('\n=== Error Events ===');
            errorEvents.forEach((log, i) => {
                console.log(`Error event ${i+1} at ${new Date(log.timestamp).toLocaleTimeString()}:`, log.data);
            });
        }
        
        // Find cases where paused=false but readyState/networkState suggest issues
        const suspiciousStates = periodicChecks.filter(log => {
            return !log.data.paused && 
                   (log.data.readyState < 3 || log.data.networkState !== 2);
        });
        
        if (suspiciousStates.length > 0) {
            console.log('\n=== Suspicious States (playing but not ready) ===');
            suspiciousStates.slice(0, 5).forEach(log => {
                console.log(`At ${new Date(log.timestamp).toLocaleTimeString()}:`, {
                    paused: log.data.paused,
                    readyState: log.data.readyState,
                    networkState: log.data.networkState,
                    error: log.data.error
                });
            });
        }
        
        return {
            totalLogs: logs.length,
            periodicChecks: periodicChecks.length,
            stalledEvents: stalledEvents.length,
            errorEvents: errorEvents.length,
            stateTransitions: stateTransitions,
            suspiciousStates: suspiciousStates.length
        };
    } catch (e) {
        console.error('Failed to analyze logs:', e);
        return null;
    }
};

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
function shouldAutoplayYouTube() {
    // Check Network Information API
    if (navigator.connection) {
        const connection = navigator.connection;
        const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
        const downlink = connection.downlink; // Bandwidth in Mbps
        
        // Autoplay if 4g connection or downlink > 1.5 Mbps
        if (effectiveType === '4g' || (downlink && downlink > 1.5)) {
            return true;
        }
    }
    
    // Fallback: check if on WiFi (connection type might not be available)
    // Default to no autoplay for slower connections
    return false;
}

function setupYouTubeAutoplay() {
    const shouldAutoplay = shouldAutoplayYouTube();
    
    // Update home page YouTube embed
    const homeEmbed = document.getElementById('home-youtube-embed');
    if (homeEmbed) {
        const currentSrc = homeEmbed.src;
        // Remove autoplay first to get clean URL
        let cleanSrc = currentSrc.replace(/[&?]autoplay=1/, '').replace(/autoplay=1[&?]/, '');
        
        if (shouldAutoplay) {
            // Add autoplay parameter
            const separator = cleanSrc.includes('?') ? '&' : '?';
            homeEmbed.src = cleanSrc + separator + 'autoplay=1';
        } else {
            // Ensure autoplay is removed
            homeEmbed.src = cleanSrc;
        }
    }
    
    // Update parceiros page YouTube embed
    const parceirosEmbed = document.getElementById('parceiros-youtube-embed');
    if (parceirosEmbed) {
        const currentSrc = parceirosEmbed.src;
        // Remove autoplay first to get clean URL
        let cleanSrc = currentSrc.replace(/[&?]autoplay=1/, '').replace(/autoplay=1[&?]/, '');
        
        if (shouldAutoplay) {
            // Add autoplay parameter
            const separator = cleanSrc.includes('?') ? '&' : '?';
            parceirosEmbed.src = cleanSrc + separator + 'autoplay=1';
        } else {
            // Ensure autoplay is removed
            parceirosEmbed.src = cleanSrc;
        }
    }
}

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
let isLoading = false; // Prevent multiple simultaneous load() calls
let lastReloadTime = 0; // Track last reload time to prevent reload loops
const RELOAD_COOLDOWN_MS = 20000; // 20 seconds minimum between reloads
let waitingStartTime = null; // Track when waiting event started
const WAITING_TIMEOUT_MS = 10000; // 10 seconds - if stuck in waiting, reload

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
    updateLiveBanner();
    ensureLiveStreamSource();
    updateBackButtonVisibility();
    setupYouTubeAutoplay();
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
    if (!currentSrc && !currentStreamId && !isLoading) {
        isLoading = true;
        const defaultStreamId = await determineClosestStream();
        currentStreamId = defaultStreamId;
        sourceEl.setAttribute('src', STREAM_CONFIG[defaultStreamId].url);
        
        // #region agent log
        debugLog('app.js:285', 'ensureLiveStreamSource() - calling load()', {src:STREAM_CONFIG[defaultStreamId].url,sourceCount:stream.getElementsByTagName('source').length}, 'C');
        // #endregion
        
        stream.load();
        
        // Reset loading flag after a short delay
        setTimeout(() => { isLoading = false; }, 1000);
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

// #region agent log
// Track audio element state and events for debugging stream stops
stream.addEventListener("play", function() {
    debugLog('app.js:309', 'Audio play event', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,src:stream.getElementsByTagName('source')[0]?.getAttribute('src')}, 'A');
});
stream.addEventListener("pause", function() {
    debugLog('app.js:334', 'Audio pause event', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,src:stream.getElementsByTagName('source')[0]?.getAttribute('src')}, 'A');
});
stream.addEventListener("error", function(e) {
    debugLog('app.js:337', 'Audio error event', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,error:stream.error?.code,errorMessage:stream.error?.message,src:stream.getElementsByTagName('source')[0]?.getAttribute('src')}, 'D');
});
stream.addEventListener("stalled", function() {
    // Get buffer information at stall time
    let bufferInfo = null;
    if (stream.buffered && stream.buffered.length > 0) {
        const bufferedEnd = stream.buffered.end(stream.buffered.length - 1);
        const bufferedStart = stream.buffered.start(0);
        bufferInfo = {
            bufferedRanges: stream.buffered.length,
            bufferedStart: bufferedStart,
            bufferedEnd: bufferedEnd,
            bufferedDuration: bufferedEnd - bufferedStart,
            bufferAhead: bufferedEnd - (stream.currentTime || 0)
        };
    }
    else{return;}
    
    debugLog('app.js:340', 'Audio stalled event', {
        paused:stream.paused,
        readyState:stream.readyState,
        networkState:stream.networkState,
        src:stream.getElementsByTagName('source')[0]?.getAttribute('src'),
        currentTime:stream.currentTime,
        ...bufferInfo
    }, 'A');
    
    // Show loading indicator when stalled
    if (!stream.paused) {
        showLoadingIndicator();
    }
    
    // #region agent log - Recovery attempt
    // If stream is stalled but not paused, try to recover
    if (!stream.paused && currentStreamId) {
        const bufferAhead = bufferInfo ? bufferInfo.bufferAhead : 0;
        const hasBuffer = bufferAhead > 0.5; // At least 0.5 seconds of buffer
        
        debugLog('app.js:343', 'Attempting stalled stream recovery', {
            currentStreamId,
            paused:stream.paused,
            readyState:stream.readyState,
            bufferAhead:bufferAhead,
            hasBuffer:hasBuffer
        }, 'A');
        
        // If we have buffer, try a simple play() first
        // If buffer is low or readyState is low, reload the stream
        if (hasBuffer && stream.readyState >= 3) {
            // Try to resume playback - browser might have paused it internally
            stream.play().catch((err) => {
                debugLog('app.js:360', 'play() failed after stall, will reload', {error:err.message, readyState:stream.readyState}, 'A');
                // If play() fails, fall through to reload logic
                setTimeout(() => {
                    if (!stream.paused && currentStreamId && !isLoading) {
                        performStreamReload();
                    }
                }, 1000);
            });
        } else {
            // Low buffer or low readyState - reload the stream
            setTimeout(() => {
                if (!stream.paused && currentStreamId && !isLoading) {
                    performStreamReload();
                }
            }, 2000);
        }
    }
    // #endregion
});

// Reload stream function (accessible from multiple event handlers)
function performStreamReload() {
    const now = Date.now();
    if (isLoading) {
        debugLog('app.js:839', 'Reload skipped - already loading', {}, 'A');
        return;
    }
    if ((now - lastReloadTime) < RELOAD_COOLDOWN_MS) {
        debugLog('app.js:839', 'Reload skipped - cooldown active', {
            timeSinceLastReload: now - lastReloadTime,
            cooldownRemaining: RELOAD_COOLDOWN_MS - (now - lastReloadTime)
        }, 'A');
        return;
    }
    
    isLoading = true;
    lastReloadTime = now;
    
    // Get buffer info for logging
    let bufferInfo = null;
    if (stream.buffered && stream.buffered.length > 0) {
        const bufferedEnd = stream.buffered.end(stream.buffered.length - 1);
        const bufferedStart = stream.buffered.start(0);
        bufferInfo = {
            bufferedRanges: stream.buffered.length,
            bufferedStart: bufferedStart,
            bufferedEnd: bufferedEnd,
            bufferedDuration: bufferedEnd - bufferedStart,
            bufferAhead: bufferedEnd - (stream.currentTime || 0)
        };
    }
    
    debugLog('app.js:375', 'Stalled stream not recovered, reloading', {
        currentStreamId,
        readyState:stream.readyState,
        bufferAhead:bufferInfo ? bufferInfo.bufferAhead : 0
    }, 'A');
    const sourceEl = stream.getElementsByTagName('source')[0];
    if (sourceEl && currentStreamId) {
        const wasPlaying = !stream.paused;
        stream.pause();
        sourceEl.setAttribute('src', STREAM_CONFIG[currentStreamId].url);
        stream.load();
        setTimeout(() => { isLoading = false; }, 1000);
        if (wasPlaying) {
            stream.play().catch(() => {});
        }
    } else {
        isLoading = false;
    }
}
stream.addEventListener("waiting", function() {
    // Get buffer information at waiting time
    let bufferInfo = null;
    if (stream.buffered && stream.buffered.length > 0) {
        const bufferedEnd = stream.buffered.end(stream.buffered.length - 1);
        const bufferedStart = stream.buffered.start(0);
        bufferInfo = {
            bufferedRanges: stream.buffered.length,
            bufferedStart: bufferedStart,
            bufferedEnd: bufferedEnd,
            bufferedDuration: bufferedEnd - bufferedStart,
            bufferAhead: bufferedEnd - (stream.currentTime || 0)
        };
    }
    
    debugLog('app.js:343', 'Audio waiting event', {
        paused:stream.paused,
        readyState:stream.readyState,
        networkState:stream.networkState,
        src:stream.getElementsByTagName('source')[0]?.getAttribute('src'),
        currentTime:stream.currentTime,
        ...bufferInfo
    }, 'A');
    
    // Show loading indicator when buffering
    if (!stream.paused) {
        showLoadingIndicator();
    }
    
    // Track when waiting started
    if (!waitingStartTime) {
        waitingStartTime = Date.now();
        
        // If stuck in waiting too long, reload the stream
        setTimeout(() => {
            if (waitingStartTime && (Date.now() - waitingStartTime) >= WAITING_TIMEOUT_MS) {
                if (currentStreamId && !stream.paused && !isLoading) {
                    debugLog('app.js:343', 'Stream stuck in waiting state too long - reloading', {
                        waitingDuration: Date.now() - waitingStartTime,
                        readyState: stream.readyState,
                        networkState: stream.networkState
                    }, 'A');
                    performStreamReload();
                }
                waitingStartTime = null;
            }
        }, WAITING_TIMEOUT_MS);
    }
    
    // #region agent log - Removed proactive reload from waiting event
    // Let stalled/ended events handle recovery to avoid reload loops on slow connections
    // The waiting event is just a warning that buffer is low, not necessarily exhausted
    // #endregion
});
stream.addEventListener("loadstart", function() {
    debugLog('app.js:346', 'Audio loadstart event', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,src:stream.getElementsByTagName('source')[0]?.getAttribute('src')}, 'C');
    // Show loading indicator when starting to load
    if (!stream.paused) {
        showLoadingIndicator();
    }
});
stream.addEventListener("canplay", function() {
    isLoading = false; // Reset loading flag when stream can play
    waitingStartTime = null; // Reset waiting timer when stream can play
    debugLog('app.js:349', 'Audio canplay event - reset isLoading', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState}, 'C');
    // Hide loading indicator when ready to play
    hideLoadingIndicator();
    
    // If we have a live stream that should be playing but is paused, try to resume
    if (currentStreamId) {
        const playButton = document.getElementById('bar-play-button');
        const shouldBePlaying = playButton && playButton.classList.contains('playing');
        
        if (shouldBePlaying && stream.paused && navigator.onLine) {
            debugLog('app.js:349', 'Stream can play and should be playing - attempting to resume', {
                paused: stream.paused,
                readyState: stream.readyState,
                networkState: stream.networkState,
                online: navigator.onLine
            }, 'A');
            setTimeout(() => {
                if (currentStreamId && stream.paused && !isLoading) {
                    stream.play().catch((err) => {
                        debugLog('app.js:349', 'play() failed in canplay handler - reloading', {
                            error: err.message,
                            readyState: stream.readyState,
                            networkState: stream.networkState
                        }, 'A');
                        if (!isLoading) {
                            performStreamReload();
                        }
                    });
                }
            }, 100);
        }
    }
});
stream.addEventListener("ended", function() {
    // Get buffer information at end time
    let bufferInfo = null;
    if (stream.buffered && stream.buffered.length > 0) {
        const bufferedEnd = stream.buffered.end(stream.buffered.length - 1);
        const bufferedStart = stream.buffered.start(0);
        bufferInfo = {
            bufferedRanges: stream.buffered.length,
            bufferedStart: bufferedStart,
            bufferedEnd: bufferedEnd,
            bufferedDuration: bufferedEnd - bufferedStart,
            bufferAhead: bufferedEnd - (stream.currentTime || 0)
        };
    }
    
    debugLog('app.js:365', 'Audio ended event', {
        paused:stream.paused,
        readyState:stream.readyState,
        networkState:stream.networkState,
        src:stream.getElementsByTagName('source')[0]?.getAttribute('src'),
        currentTime:stream.currentTime,
        currentStreamId:currentStreamId,
        ...bufferInfo
    }, 'A');
    
    // #region agent log - Live stream ended recovery
    // For live streams, "ended" means the buffer ran out - we need to reload (with cooldown)
    if (currentStreamId && !isLoading) {
        const now = Date.now();
        const bufferAhead = bufferInfo ? bufferInfo.bufferAhead : 0;
        
        if ((now - lastReloadTime) >= RELOAD_COOLDOWN_MS) {
            debugLog('app.js:380', 'Live stream ended - reloading', {
                currentStreamId,
                readyState:stream.readyState,
                bufferAhead:bufferAhead,
                timeSinceLastReload: now - lastReloadTime
            }, 'A');
            
            isLoading = true;
            lastReloadTime = now;
            const sourceEl = stream.getElementsByTagName('source')[0];
            if (sourceEl && currentStreamId) {
                const wasPlaying = !stream.paused;
                stream.pause();
                sourceEl.setAttribute('src', STREAM_CONFIG[currentStreamId].url);
                stream.load();
                setTimeout(() => { isLoading = false; }, 1000);
                if (wasPlaying) {
                    stream.play().catch(() => {});
                }
            } else {
                isLoading = false;
            }
        } else {
            debugLog('app.js:380', 'Live stream ended but cooldown active', {
                currentStreamId,
                bufferAhead:bufferAhead,
                timeSinceLastReload: now - lastReloadTime,
                cooldownRemaining: RELOAD_COOLDOWN_MS - (now - lastReloadTime)
            }, 'A');
        }
    }
    // #endregion
});
// #endregion

// Network connectivity event listeners
window.addEventListener('online', function() {
    const playButton = document.getElementById('bar-play-button');
    const shouldBePlaying = playButton && playButton.classList.contains('playing');
    
    debugLog('app.js:online', 'Network connectivity restored', {
        currentStreamId,
        paused: stream.paused,
        readyState: stream.readyState,
        networkState: stream.networkState,
        shouldBePlaying: shouldBePlaying,
        playButtonHasPlayingClass: shouldBePlaying,
        isLoading: isLoading,
        waitingStartTime: waitingStartTime
    }, 'A');
    
    // Reset loading flags when connectivity is restored to allow recovery
    if (currentStreamId) {
        // Reset waiting timer since we're back online
        waitingStartTime = null;
        // If we've been stuck loading for a while, reset the flag
        if (isLoading) {
            debugLog('app.js:online', 'Resetting isLoading flag after connectivity restored', {}, 'A');
            isLoading = false;
        }
    }
    
    // If we have a live stream, check if we need to recover
    if (currentStreamId) {
        const isInBadState = stream.networkState === 3 || // NETWORK_NO_SOURCE
                            stream.readyState < 2 ||      // HAVE_NOTHING or HAVE_METADATA
                            (stream.error && stream.error.code !== 0); // Has error
        
        // If the UI shows it should be playing, always check and recover if needed
        if (shouldBePlaying) {
            // If stream is paused or in bad state, reload it
            if (stream.paused || isInBadState) {
                debugLog('app.js:online', 'Stream should be playing but is paused or in bad state - reloading', {
                    paused: stream.paused,
                    readyState: stream.readyState,
                    networkState: stream.networkState,
                    error: stream.error?.code,
                    shouldBePlaying: shouldBePlaying
                }, 'A');
                setTimeout(() => {
                    if (currentStreamId && !isLoading) {
                        performStreamReload();
                    }
                }, 1000);
            }
            // If stream claims to be playing but might be stuck, verify and reload if needed
            // else if (!stream.paused) {
            //     // Double-check: if readyState is low or networkState is questionable, reload anyway
            //     if (stream.readyState < 3 || stream.networkState !== 2) {
            //         debugLog('app.js:online', 'Stream playing but state questionable after connectivity restored - reloading', {
            //             readyState: stream.readyState,
            //             networkState: stream.networkState,
            //             error: stream.error?.code
            //         }, 'A');
            //         setTimeout(() => {
            //             if (currentStreamId && !isLoading) {
            //                 performStreamReload();
            //             }
            //         }, 1000);
            //     }
            // }
        }
        // If stream is not paused but in bad state (even if UI doesn't show playing), reload it
        else if (!stream.paused && isInBadState) {
            debugLog('app.js:online', 'Stream playing but in bad state after connectivity restored - reloading', {
                readyState: stream.readyState,
                networkState: stream.networkState,
                error: stream.error?.code
            }, 'A');
            setTimeout(() => {
                if (currentStreamId && !isLoading) {
                    performStreamReload();
                }
            }, 1000);
        }
    }
});

window.addEventListener('offline', function() {
    debugLog('app.js:offline', 'Network connectivity lost', {
        currentStreamId,
        paused: stream.paused,
        readyState: stream.readyState,
        networkState: stream.networkState
    }, 'A');
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

    if (needsReload && !isLoading) {
        isLoading = true;
        // #region agent log
        debugLog('app.js:424', 'Before reload - checking for multiple sources', {sourceCount:stream.getElementsByTagName('source').length,currentSrc:sourceEl.getAttribute('src'),targetUrl:targetStreamUrl,paused:stream.paused,readyState:stream.readyState}, 'B');
        // #endregion
        
        // Pause if currently playing
        const wasPlaying = !stream.paused;
        if (wasPlaying) {
        stream.pause();
    }
        
        sourceEl.setAttribute('src', targetStreamUrl);
        currentStreamId = targetStreamId;
        streamFullTime = 0;
        streamTitle = 'Rádio Seara Ao Vivo';
        
        // #region agent log
        debugLog('app.js:439', 'Calling stream.load()', {src:sourceEl.getAttribute('src'),paused:stream.paused,readyState:stream.readyState}, 'C');
        // #endregion
        stream.load();
        
        // Reset loading flag after a short delay
        setTimeout(() => { isLoading = false; }, 1000);
        
        // Resume if was playing
        if (wasPlaying) {
            // #region agent log
            const playPromise = stream.play();
            playPromise.then(() => {
                debugLog('app.js:448', 'stream.play() resolved', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState}, 'E');
            }).catch((err) => {
                debugLog('app.js:450', 'stream.play() rejected', {error:err.message,paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState}, 'E');
            });
            // #endregion
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
    
    // #region agent log
    debugLog('app.js:479', 'switchStream() called', {fromStreamId:currentStreamId,toStreamId:streamId,wasPlaying:!stream.paused,sourceCount:stream.getElementsByTagName('source').length}, 'B');
    // #endregion
    
    // Save preference to localStorage
    localStorage.setItem('preferredStreamId', streamId);
    
    const wasPlaying = !stream.paused;
    toggleLiveStream(null, streamId);
    
    // If was playing, ensure it continues playing
    if (wasPlaying && stream.paused) {
        // #region agent log
        const playPromise = stream.play();
        playPromise.then(() => {
            debugLog('app.js:493', 'switchStream() - play() resolved', {paused:stream.paused,readyState:stream.readyState}, 'E');
        }).catch((err) => {
            debugLog('app.js:495', 'switchStream() - play() rejected', {error:err.message,paused:stream.paused,readyState:stream.readyState}, 'E');
        });
        // #endregion
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
    // #region agent log
    debugLog('app.js:556', 'playStream() called', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,src:stream.getElementsByTagName('source')[0]?.getAttribute('src'),sourceCount:stream.getElementsByTagName('source').length}, 'E');
    // #endregion
    
    // Check if stream is in a bad state before attempting to play
    if (currentStreamId && stream.networkState === 3) { // NETWORK_NO_SOURCE or error state
        debugLog('app.js:556', 'Stream in error state, reloading before play', {
            networkState: stream.networkState,
            readyState: stream.readyState,
            error: stream.error?.code
        }, 'A');
        performStreamReload();
        return;
    }
    
    if (scrubUpdater) {
        clearInterval(scrubUpdater);
    }
    addClass("bar-play-button", "playing");
    
    // #region agent log
    const playPromise = stream.play();
    playPromise.then(() => {
        debugLog('app.js:567', 'playStream() - play() resolved', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState}, 'E');
        // Hide loading indicator if readyState is good
        if (stream.readyState >= 3) {
            hideLoadingIndicator();
        }
    }).catch((err) => {
        debugLog('app.js:569', 'playStream() - play() rejected', {error:err.message,paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState}, 'E');
        
        // If play() is rejected and we're trying to play a live stream, reload it
        if (currentStreamId && !stream.paused && (stream.networkState === 3 || stream.readyState < 2)) {
            debugLog('app.js:569', 'play() rejected with bad network/ready state - reloading stream', {
                networkState: stream.networkState,
                readyState: stream.readyState,
                error: err.message
            }, 'A');
            setTimeout(() => {
                if (currentStreamId && !isLoading) {
                    performStreamReload();
                }
            }, 1000);
        }
    });
    // #endregion
    
    scrubUpdater = window.setInterval(updateScrubber, 1000);
}

function pauseStream(){
    // #region agent log
    debugLog('app.js:578', 'pauseStream() called', {paused:stream.paused,readyState:stream.readyState,networkState:stream.networkState,src:stream.getElementsByTagName('source')[0]?.getAttribute('src'),sourceCount:stream.getElementsByTagName('source').length}, 'A');
    // #endregion
    
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
    
    // #region agent log
    debugLog('app.js:705', 'playEpisode() - calling load()', {audioUrl,sourceCount:player.getElementsByTagName('source').length}, 'C');
    // #endregion
    
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
