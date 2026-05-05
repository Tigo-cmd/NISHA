/**
 * NISHA Master Dashboard — Gapless Queue-based Player
 */

// Configuration
const REFRESH_RATE = 1000; // 1s polling for new clips
const WS_URL = `ws://${window.location.host}/api/ws/dashboard`;
const API_URL = `${window.location.origin}/api`;

// State
let agents = [];
let selectedAgentId = null;
let lastVideoUpdate = 0;
let lastAudioUpdate = 0;

// Queue Managers
const videoQueue = [];
const audioQueue = [];
let videoPlaying = false;
let audioPlaying = false;
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
const audioEl = document.getElementById('mainAudio');
const flipBtn = document.getElementById('flipCamBtn');
const locationBadge = document.getElementById('locationBadge');
const coordsText = document.getElementById('coordsText');

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
    try {
        const res = await fetch(`${API_URL}/agent/${agentId}/media/${type}`);
        const data = await res.json();

        if (data.base64) {
            if (type === 'video') {
                videoEl.src = `data:image/jpeg;base64,${data.base64}`;
                badgeClips.innerText = `LIVE`;
                videoPlaying = true;
            } else {
                const blob = base64ToBlob(data.base64, 'audio/wav');
                const url = URL.createObjectURL(blob);
                audioQueue.push(url);
                badgeAudioQueue.innerText = `${audioQueue.length} QUEUED`;
                if (!audioPlaying) playNextAudio();
                document.getElementById('audioSection').classList.remove('hidden');
            }
        }
    } catch (err) {
        console.warn(`Failed to fetch ${type} for ${agentId}`, err);
    }
}

function base64ToBlob(b64, type) {
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
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
    const data = JSON.parse(event.data);
    // Real-time updates could also trigger fetchMedia faster
    if (data.agents) {
        agents = data.agents;
        updateSidebar();
        updateMainStats(data);
        if (selectedAgentId) {
            const agent = agents.find(a => a.agent_id === selectedAgentId);
            if (agent) updateAgentView(agent);
        }
    }
};

// Initial fetch
fetchAgents();
