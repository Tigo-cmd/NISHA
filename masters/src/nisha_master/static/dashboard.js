/**
 * NISHA Master Dashboard — Gapless Queue-based Player
 */

// Configuration
const REFRESH_RATE = 1000;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}/api/ws/dashboard`;
const API_URL = `${window.location.origin}/api`;

// State
let agents = [];
let selectedAgentId = null;
let lastVideoUpdate = 0;
let lastAudioUpdate = 0;

function isHardware(id) {
    if (!id) return false;
    const cleanId = String(id).trim().toUpperCase();
    const isMac = /^[0-9A-Fa-f]{12}$/.test(cleanId);
    const isNode = cleanId.includes("NODE") || cleanId.includes("ESP") || cleanId.includes("CAM");
    const result = isMac || isNode;
    console.log(`[Identification] Agent ${cleanId}: isHardware=${result} (isMac=${isMac}, isNode=${isNode})`);
    return result;
}

// Queue Managers
const videoQueue = [];
const audioQueue = [];
let videoPlaying = false;
let audioPlaying = false;

// --- Agora Video/Audio Manager ---
class AgoraManager {
    constructor() {
        this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        this.localTracks = { video: null, audio: null };
        this.remoteUsers = {};
        this.isActive = false;
        
        this.client.on("user-published", (user, mediaType) => this.handleUserPublished(user, mediaType));
        this.client.on("user-unpublished", (user) => this.handleUserUnpublished(user));
        this.client.on("exception", (event) => {
            console.warn("[Agora] Exception detected:", event);
            if (event.code === 1005) { // RECV_VIDEO_DECODE_FAILED
                console.log("[Agora] Decoding failed. Attempting to re-subscribe...");
            }
        });
    }

    async join(channelName) {
        try {
            if (this.isActive) await this.leave();
            
            // 1. Fetch token from our Master API
            const response = await fetch(`${API_URL}/agora/token?channelName=${channelName}`);
            const data = await response.json();
            
            if (data.error) throw new Error(data.error);

            // 2. Join the channel
            await this.client.join(data.appId, channelName, data.token, null);
            this.isActive = true;
            console.log(`[Agora] Joined channel: ${channelName}`);
        } catch (e) {
            console.error("[Agora] Join failed:", e);
        }
    }

    async leave() {
        if (!this.isActive) return;
        await this.client.leave();
        this.isActive = false;
        document.getElementById('remote-video').innerHTML = '';
        console.log("[Agora] Left channel");
    }

    async handleUserPublished(user, mediaType) {
        console.log(`[Agora] User ${user.uid} is publishing ${mediaType}`);
        try {
            await this.client.subscribe(user, mediaType);
            console.log(`[Agora] Subscribed to ${mediaType} from ${user.uid}`);
            
            if (mediaType === "video") {
                const remotePlayerContainer = document.getElementById('remote-video');
                console.log(`[Agora] Playing video track into:`, remotePlayerContainer);
                user.videoTrack.play(remotePlayerContainer);
                
                videoEl.classList.add('hidden');
                videoCanvas.classList.add('hidden');
                remotePlayerContainer.classList.remove('hidden');
            }

            if (mediaType === "audio") {
                console.log(`[Agora] Playing audio track...`);
                user.audioTrack.play();
                document.getElementById('audioSection').classList.remove('hidden');
                badgeAudioQueue.innerText = `AGORA LIVE`;
            }
        } catch (e) {
            console.error(`[Agora] Subscription failed for ${mediaType}:`, e);
        }
    }

    handleUserUnpublished(user, mediaType) {
        console.log(`[Agora] User ${user.uid} unpublished ${mediaType}`);
        if (mediaType === 'video') {
            document.getElementById('remote-video').classList.add('hidden');
        }
    }
}
const agoraManager = new AgoraManager();

// --- Real-time Audio Stream Player (Web Audio API) ---
class RealtimeAudioPlayer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        this.startTime = 0;
        this.lookahead = 0.05; // 50ms buffer to prevent crackle
    }

    playChunk(base64Data) {
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const binary = atob(base64Data);
            const len = binary.length;
            // S16LE requires 2 bytes per sample. Ensure even length.
            const validLen = len % 2 === 0 ? len : len - 1;
            if (validLen <= 0) return;

            const bytes = new Uint8Array(validLen);
            for (let i = 0; i < validLen; i++) bytes[i] = binary.charCodeAt(i);
            
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
            }

            const audioBuffer = this.ctx.createBuffer(1, float32.length, 16000);
            audioBuffer.getChannelData(0).set(float32);

            const source = this.ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.ctx.destination);

            const now = this.ctx.currentTime;
            // If we are behind or too far ahead (drift), jump to now + lookahead
            if (this.startTime < now || (this.startTime - now) > 1.0) {
                this.startTime = now + this.lookahead;
            }
            
            source.start(this.startTime);
            this.startTime += audioBuffer.duration;
        } catch (e) {
            console.warn("[RealtimeAudio] Playback error:", e);
        }
    }
}
const realtimePlayer = new RealtimeAudioPlayer();
let currentVideoUrl = null;
let currentAudioUrl = null;

// DOM Elements
const agentListEl = document.getElementById('agentList');
const activeCountEl = document.getElementById('activeCount');
const selectedNameEl = document.getElementById('selectedAgentName');
const selectedStatusEl = document.getElementById('selectedAgentStatus');
const streamDisplayEl = document.getElementById('streamDisplay');
const emptyStateEl = document.getElementById('emptyState');
const videoEl = document.getElementById('mainVideo');
const videoCanvas = document.getElementById('videoCanvas');
const audioEl = document.getElementById('mainAudio');
const flipBtn = document.getElementById('flipCamBtn');
const locationBadge = document.getElementById('locationBadge');
const coordsText = document.getElementById('coordsText');

function renderRawRGB(base64, width, height) {
    try {
        if (!base64 || !videoCanvas) return;
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

        const w = width || 160;
        const h = height || 120;
        videoCanvas.width = w;
        videoCanvas.height = h;
        
        const ctx = videoCanvas.getContext('2d');
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;

        // RGB -> RGBA + Vertical Flip
        // Iterate rows in reverse for vertical flip
        for (let y = 0; y < h; y++) {
            const sourceRow = (h - 1 - y) * w * 3; // Flip: take from bottom of source
            const destRow = y * w * 4;
            
            for (let x = 0; x < w; x++) {
                const s = sourceRow + (x * 3);
                const d = destRow + (x * 4);
                
                // Input is RGB, Canvas is RGBA
                data[d]     = bytes[s];     // Red
                data[d + 1] = bytes[s + 1]; // Green
                data[d + 2] = bytes[s + 2]; // Blue
                data[d + 3] = 255;          // Alpha
            }
        }

        ctx.putImageData(imageData, 0, 0);
        videoEl.classList.add('hidden');
        videoCanvas.classList.remove('hidden');
    } catch (e) {
        console.error("[Dashboard] renderRawRGB failed:", e);
    }
}

// Badges
const badgeClips = document.getElementById('badgeClips');
const badgeBandwidth = document.getElementById('badgeBandwidth');
const badgeAudioClips = document.getElementById('badgeAudioClips');
const badgeAudioQueue = document.getElementById('badgeAudioQueue');

// Initialize Visualizer
const visualizer = document.getElementById('visualizer');
for (let i = 0; i < 30; i++) {
    const bar = document.createElement('div');
    bar.className = 'vis-bar';
    bar.style.height = '10%';
    visualizer.appendChild(bar);
}

// ---------- Logic ----------

async function fetchAgents() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();
        
        agents = data.agents || [];
        updateSidebar();
        updateMainStats(data);

        if (selectedAgentId) {
            const agent = agents.find(a => a.agent_id === selectedAgentId);
            if (agent) {
                updateAgentView(agent);
            }
        }
    } catch (err) {
        console.error("Fetch failed", err);
    }
}

function updateSidebar() {
    const activeCount = agents.length;
    activeCountEl.innerText = activeCount;

    if (activeCount === 0) {
        agentListEl.innerHTML = '<div style="color: #444; font-size: 0.85rem; padding: 10px;">Waiting for signal...</div>';
        return;
    }

    // Keep scroll position?
    agentListEl.innerHTML = '';
    agents.forEach(agent => {
        const item = document.createElement('div');
        item.className = `agent-item ${selectedAgentId === agent.agent_id ? 'active' : ''}`;
        item.onclick = () => selectAgent(agent.agent_id);
        
        item.innerHTML = `
            <div class="icon"></div>
            <div class="name">${agent.agent_id}</div>
        `;
        agentListEl.appendChild(item);
    });
}

function updateMainStats(data) {
    const statusDot = document.getElementById('globalStatusDot');
    const statusText = document.getElementById('globalStatusText');
    
    if (data.system.agents_connected > 0) {
        statusDot.className = 'dot online';
        statusText.innerText = 'RECEIVING';
    } else {
        statusDot.className = 'dot offline';
        statusText.innerText = 'NO SIGNAL';
    }
}

function selectAgent(id) {
    if (selectedAgentId === id) return;
    
    selectedAgentId = id;
    lastVideoUpdate = 0;
    lastAudioUpdate = 0;
    
    // Clear queues
    clearQueues();
    
    // Join Agora channel ONLY for Mobile agents
    if (!isHardware(id)) {
        agoraManager.join(`nisha_stream_${id}`);
    } else {
        agoraManager.leave();
    }
    
    updateSidebar();
    
    const agent = agents.find(a => a.agent_id === id);
    if (agent) {
        streamDisplayEl.classList.remove('hidden');
        emptyStateEl.classList.add('hidden');
        selectedNameEl.innerText = agent.agent_id;
        selectedStatusEl.innerText = "LINK ESTABLISHED";
        updateAgentView(agent);
    }
}

function updateAgentView(agent) {
    // 1. Check for new Video
    if (agent.video_updated_at > lastVideoUpdate) {
        lastVideoUpdate = agent.video_updated_at;
        fetchMedia(agent.agent_id, 'video');
    }
    
    // 2. Check for new Audio
    if (agent.audio_updated_at > lastAudioUpdate) {
        lastAudioUpdate = agent.audio_updated_at;
        fetchMedia(agent.agent_id, 'audio');
    }

    // 3. Location
    if (agent.location) {
        locationBadge.classList.remove('hidden');
        coordsText.innerText = `${agent.location.lat.toFixed(5)}, ${agent.location.lng.toFixed(5)}`;
    } else {
        locationBadge.classList.add('hidden');
    }
}

async function fetchMedia(agentId, type) {
    // If Agora is active, don't poll legacy media
    if (agoraManager && agoraManager.isActive) {
        return;
    }
    try {
        const res = await fetch(`${API_URL}/agent/${agentId}/media/${type}`);
        const data = await res.json();

        if (data.base64) {
            if (type === 'video') {
                if (data.mime === 'video/raw_rgb') {
                    renderRawRGB(data.base64, data.width, data.height);
                } else {
                    const mime = data.mime || 'image/jpeg';
                    videoEl.src = `data:${mime};base64,${data.base64}`;
                    videoEl.classList.remove('hidden');
                    const canvas = document.getElementById('videoCanvas');
                    if (canvas) canvas.classList.add('hidden');
                }
                badgeClips.innerText = `LIVE`;
                videoPlaying = true;
            } else {
                if (data.is_live) {
                    realtimePlayer.playChunk(data.base64);
                    document.getElementById('audioSection').classList.remove('hidden');
                    badgeAudioQueue.innerText = `STREAMING`;
                } else if (data.base64) {
                    const mime = data.mime || 'audio/wav';
                    const url = `data:${mime};base64,${data.base64}`;
                    audioQueue.push(url);
                    badgeAudioQueue.innerText = `${audioQueue.length} QUEUED`;
                    if (!audioPlaying) playNextAudio();
                    document.getElementById('audioSection').classList.remove('hidden');
                }
            }
        }
    } catch (err) {
        console.warn(`Failed to fetch ${type} for ${agentId}`, err);
    }
}



// ---------- Playback Control ----------

// Video frames are rendered directly on fetch, so no queue needed for video

function playNextAudio() {
    if (audioQueue.length === 0) {
        audioPlaying = false;
        updateVisualizer(false);
        return;
    }
    
    audioPlaying = true;
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    
    currentAudioUrl = audioQueue.shift();
    audioEl.src = currentAudioUrl;
    audioEl.play().catch(e => console.warn("Audio play blocked", e));
    
    badgeAudioQueue.innerText = `${audioQueue.length} QUEUED`;
    updateVisualizer(true);
}

function clearQueues() {
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    audioQueue.forEach(url => URL.revokeObjectURL(url));
    videoQueue.length = 0;
    audioQueue.length = 0;
    videoPlaying = false;
    audioPlaying = false;
    currentVideoUrl = null;
    currentAudioUrl = null;
    videoEl.src = '';
    audioEl.src = '';
    document.getElementById('audioSection').classList.add('hidden');
    agoraManager.leave();
}

// ---------- UI Effects ----------

function updateVisualizer(active) {
    const bars = visualizer.querySelectorAll('.vis-bar');
    bars.forEach(bar => {
        if (active) {
            const h = Math.floor(Math.random() * 80) + 10;
            bar.style.height = `${h}%`;
            bar.style.opacity = '1';
        } else {
            bar.style.height = '10%';
            bar.style.opacity = '0.3';
        }
    });
    if (active) setTimeout(() => updateVisualizer(true), 150);
}

// ---------- Event Listeners ----------

audioEl.onended = playNextAudio;
audioEl.onerror = playNextAudio;

flipBtn.onclick = async () => {
    if (!selectedAgentId) return;
    try {
        await fetch(`${API_URL}/agent/${selectedAgentId}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'flip_camera' })
        });
    } catch (err) {}
};

// ---------- Lifecycle ----------

// Poll for stats every second (or use WebSocket)
setInterval(fetchAgents, REFRESH_RATE);

// Connect WebSocket for real-time traffic graph if needed
const ws = new WebSocket(WS_URL);
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // console.log(`[WS] Received: ${msg.type || 'unknown'}`); // Keep commented unless needed to avoid flood

    if (msg.type === 'SNAPSHOT') {
        updateDashboard(msg.payload);
    } else if (msg.type === 'MEDIA_UPDATE') {
        if (selectedAgentId === msg.agent_id) {
            fetchMedia(msg.agent_id, msg.media_type);
        }
    } else if (msg.type === 'LIVE_FRAME') {
        if (selectedAgentId === msg.agent_id) {
            console.log(`[Stream] Received LIVE_FRAME for ${msg.agent_id} (${msg.base64?.length || 0} bytes)`);
            const mime = msg.mime || 'image/jpeg';
            videoEl.src = `data:${mime};base64,${msg.base64}`;
            videoEl.classList.remove('hidden');
            if (videoCanvas) videoCanvas.classList.add('hidden');
            if (document.getElementById('remote-video')) document.getElementById('remote-video').classList.add('hidden');
            badgeClips.innerText = `HYPER-LIVE`;
        }
    } else if (msg.type === 'VIDEO_FRAME') {
        if (selectedAgentId === msg.agent_id) {
            renderRawRGB(msg.base64, msg.width, msg.height);
        }
    } else if (msg.agents) {
        agents = msg.agents;
        updateSidebar();
        updateMainStats(msg);
        if (selectedAgentId) {
            const agent = agents.find(a => a.agent_id === selectedAgentId);
            if (agent) updateAgentView(agent);
        }
    }
};

// Initial fetch
fetchAgents();
