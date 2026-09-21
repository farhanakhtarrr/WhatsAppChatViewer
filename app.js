// --- Scale Logic to treat phone like an Image ---
function updateDeviceScale() {
    const container = document.querySelector('.device-container');
    const device = document.getElementById('mainDevice');
    if (!container || !device) return;

    const rect = container.getBoundingClientRect();
    const availableWidth = rect.width;
    const availableHeight = rect.height;

    // Base dimensions of the phone
    const baseWidth = 375;
    const baseHeight = 812;

    // Calculate scale factor (max scale 1.15 to prevent it from getting too massive on huge screens)
    const scale = Math.min(1.15, availableWidth / baseWidth, availableHeight / baseHeight);

    device.style.transform = `scale(${scale})`;
}

// Run scaling on load and window resize
window.addEventListener('resize', updateDeviceScale);
window.addEventListener('DOMContentLoaded', updateDeviceScale);

// Also attach a ResizeObserver to explicitly watch the container
new ResizeObserver(updateDeviceScale).observe(document.body);
// ------------------------------------------------

let rawMessages = [];
let myName = null;
let recipientName = null;
let searchResults = [];
let currentMatchIndex = -1;
let currentSearchQuery = "";
let isExactSearch = false;

// Wallpaper state
let currentWallpaperMode = 'default'; // 'default', 'color', 'image'
let currentCustomColor = '#efeae2';
let currentCustomImgData = null;
let isDoodleEnabled = true;

// DOM Elements
const chatViewport = document.getElementById('chatViewport');
const chatDoodleBg = document.getElementById('chatDoodleBg');
const chatContainer = document.getElementById('chatContainer');
const profilePic = document.getElementById('profilePic');
const pfpUpload = document.getElementById('pfpUpload');
const contextMenu = document.getElementById('contextMenu');
const deviceEl = document.getElementById('mainDevice');
const osLabel = document.getElementById('osLabel');
const osToggle = document.getElementById('osToggle');
const themeLabel = document.getElementById('themeLabel');
const themeToggle = document.getElementById('themeToggle');
const searchStats = document.getElementById('searchStats');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const fileNameDisplay = document.getElementById('fileNameDisplay');
let selectedTextToCopy = "";

// Wallpaper DOM Elements
const doodleToggle = document.getElementById('doodleToggle');
const btnResetWallpaper = document.getElementById('btnResetWallpaper');
const wpColorPicker = document.getElementById('wpColorPicker');
const wpColorHex = document.getElementById('wpColorHex');
const colorPickerPreview = document.getElementById('colorPickerPreview');
const wpImgUpload = document.getElementById('wpImgUpload');
const wpImgPreviewBox = document.getElementById('wpImgPreviewBox');
const wpThumbImg = document.getElementById('wpThumbImg');
const wpImgName = document.getElementById('wpImgName');
const btnRemoveWpImg = document.getElementById('btnRemoveWpImg');
const presetButtons = document.querySelectorAll('.wp-preset');

// Robust Emoji Regex (Unicode RGI or Extended Pictographic fallback)
let emojiRegex;
try {
    emojiRegex = new RegExp('\\p{RGI_Emoji}', 'gv');
} catch (e) {
    emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\uD83C\uDFFB-\uD83C\uDFFF])*/gu;
}

// Function to replace raw emojis with platform-authentic emoji images
function parseAndFormatEmojis(text, isIOS) {
    const style = isIOS ? 'apple' : 'whatsapp';

    // Check if the text consists exclusively of 1, 2, or 3 emojis (WhatsApp big emoji feature)
    const trimmed = text.trim();
    const matches = trimmed.match(emojiRegex);
    let sizeClass = '';
    if (matches && matches.join('') === trimmed.replace(/\s+/g, '')) {
        if (matches.length === 1) sizeClass = 'emoji-only-1';
        else if (matches.length === 2) sizeClass = 'emoji-only-2';
        else if (matches.length === 3) sizeClass = 'emoji-only-3';
    }

    const replaced = text.replace(emojiRegex, (match) => {
        const encoded = encodeURIComponent(match);
        return `<img class="emoji" src="https://emoji-cdn.mqrio.dev/${encoded}?style=${style}" alt="${match}" draggable="false" onerror="this.replaceWith(this.alt)" crossOrigin="anonymous">`;
    });

    if (sizeClass) {
        return `<span class="${sizeClass}">${replaced}</span>`;
    }
    return replaced;
}

// Live update of existing emojis when OS is toggled
function updateAllEmojisInChat(isIOS) {
    const style = isIOS ? 'apple' : 'whatsapp';
    document.querySelectorAll('.chat-container img.emoji').forEach(img => {
        const alt = img.getAttribute('alt');
        if (alt) {
            img.src = `https://emoji-cdn.mqrio.dev/${encodeURIComponent(alt)}?style=${style}`;
        }
    });
}

// Prevent cross-bubble selection
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const startMsg = range.startContainer.parentElement?.closest('.message');
    const endMsg = range.endContainer.parentElement?.closest('.message');
    if (startMsg && endMsg && startMsg !== endMsg) selection.removeAllRanges();
});

// OS Toggle (Android / iOS Mode)
osToggle.addEventListener('change', (e) => {
    const isIOS = e.target.checked;
    osLabel.textContent = isIOS ? "iOS Mode" : "Android Mode";

    requestAnimationFrame(() => {
        const overlay = document.createElement('div');
        overlay.className = 'liquid-glass-overlay';
        deviceEl.appendChild(overlay);

        setTimeout(() => {
            if (isIOS) document.body.classList.add('ios-mode');
            else document.body.classList.remove('ios-mode');

            // Switch emojis to match current OS
            updateAllEmojisInChat(isIOS);
        }, 100);

        setTimeout(() => overlay.remove(), 700);
    });
});

// Theme Toggle (Light / Dark Mode)
themeToggle.addEventListener('change', (e) => {
    const isDark = e.target.checked;
    themeLabel.textContent = isDark ? "Dark Theme" : "Light Theme";
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    updateWallpaper();
});

// Helper to determine if a color is perceptually dark
function isColorDark(hexColor) {
    if (!hexColor || hexColor === 'default') {
        return document.body.classList.contains('dark-mode');
    }
    const hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16) || 0;
        const g = parseInt(hex[1] + hex[1], 16) || 0;
        const b = parseInt(hex[2] + hex[2], 16) || 0;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

// --- Wallpaper Customization Logic ---
function updateWallpaper() {
    if (!chatViewport) return;

    // Doodle visibility
    chatViewport.classList.toggle('hide-doodle', !isDoodleEnabled);

    if (currentWallpaperMode === 'image' && currentCustomImgData) {
        chatViewport.style.backgroundImage = `url(${currentCustomImgData})`;
        chatViewport.classList.add('has-custom-img');
        chatViewport.style.backgroundColor = 'transparent';
        chatViewport.classList.remove('dark-bg');
    } else if (currentWallpaperMode === 'color') {
        chatViewport.style.backgroundImage = 'none';
        chatViewport.classList.remove('has-custom-img');
        chatViewport.style.backgroundColor = currentCustomColor;
        chatViewport.classList.toggle('dark-bg', isColorDark(currentCustomColor));
    } else {
        // default
        chatViewport.style.backgroundImage = '';
        chatViewport.classList.remove('has-custom-img');
        chatViewport.style.backgroundColor = '';
        chatViewport.classList.remove('dark-bg');
    }
}

// Initialize wallpaper state on load
updateWallpaper();

// Preset color buttons
presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const color = btn.getAttribute('data-color');
        if (color === 'default') {
            currentWallpaperMode = 'default';
        } else {
            currentWallpaperMode = 'color';
            currentCustomColor = color;
            wpColorPicker.value = color;
            wpColorHex.textContent = color;
            colorPickerPreview.style.backgroundColor = color;
        }
        updateWallpaper();
    });
});

// Reset Default Wallpaper
btnResetWallpaper.addEventListener('click', () => {
    btnResetWallpaper.classList.add('spin');
    setTimeout(() => btnResetWallpaper.classList.remove('spin'), 450);
    currentWallpaperMode = 'default';
    presetButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('.wp-preset[data-color="default"]')?.classList.add('active');
    isDoodleEnabled = true;
    doodleToggle.checked = true;
    document.documentElement.style.setProperty('--doodle-opacity', '0.65');
    document.documentElement.style.setProperty('--doodle-contrast', '1');
    currentCustomImgData = null;
    wpImgPreviewBox.style.display = 'none';
    wpImgUpload.value = '';
    updateWallpaper();
});

// Manual RGB Color Picker
wpColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    currentCustomColor = color;
    currentWallpaperMode = 'color';
    wpColorHex.textContent = color;
    colorPickerPreview.style.backgroundColor = color;
    presetButtons.forEach(b => b.classList.remove('active'));
    updateWallpaper();
});

// Custom Image Wallpaper Upload
wpImgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentCustomImgData = ev.target.result;
        currentWallpaperMode = 'image';
        wpThumbImg.src = currentCustomImgData;
        wpImgName.textContent = file.name;
        wpImgPreviewBox.style.display = 'flex';
        presetButtons.forEach(b => b.classList.remove('active'));
        updateWallpaper();
    };
    reader.readAsDataURL(file);
});

// Remove Custom Image Wallpaper
btnRemoveWpImg.addEventListener('click', () => {
    currentCustomImgData = null;
    wpImgPreviewBox.style.display = 'none';
    wpImgUpload.value = '';
    currentWallpaperMode = 'default';
    presetButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('.wp-preset[data-color="default"]')?.classList.add('active');
    updateWallpaper();
});

// Doodle Pattern Overlay Toggle
doodleToggle.addEventListener('change', (e) => {
    isDoodleEnabled = e.target.checked;
    updateWallpaper();
});

// --- Screenshot Export ---
document.getElementById('btnScreenshot').addEventListener('click', async () => {
    const isIOS = document.body.classList.contains('ios-mode');
    const isDark = document.body.classList.contains('dark-mode');

    // Determine canvas background
    let screenshotBg;
    if (currentWallpaperMode === 'color') {
        screenshotBg = currentCustomColor;
    } else if (currentWallpaperMode === 'image') {
        screenshotBg = '#000000';
    } else {
        if (isIOS) {
            screenshotBg = isDark ? '#000000' : '#E5E5EA';
        } else {
            screenshotBg = isDark ? '#0b141a' : '#efeae2';
        }
    }

    const btn = document.getElementById('btnScreenshot');
    const origBtnText = btn.innerHTML;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Exporting...`;
    btn.style.pointerEvents = 'none';

    try {
        const canvas = await html2canvas(deviceEl, {
            scale: 3, // iPhone X 3x Super Retina native resolution (1125 x 2436 px)
            useCORS: true,
            allowTaint: true,
            backgroundColor: screenshotBg,
            logging: false,
            onclone: (clonedDoc) => {
                // Carry over theme classes to cloned document body
                clonedDoc.body.className = document.body.className;

                const clonedDevice = clonedDoc.getElementById('mainDevice');
                if (clonedDevice) {
                    clonedDevice.style.transform = 'none';
                    clonedDevice.style.borderRadius = '0px';
                    clonedDevice.style.border = 'none';
                    clonedDevice.style.boxShadow = 'none';
                    clonedDevice.style.transition = 'none';
                    clonedDevice.style.backgroundColor = screenshotBg;
                }

                // Match scroll position and wallpaper in the clone
                const clonedViewport = clonedDoc.getElementById('chatViewport');
                const clonedDoodle = clonedDoc.getElementById('chatDoodleBg');
                const clonedChat = clonedDoc.getElementById('chatContainer');
                if (clonedChat) {
                    clonedChat.scrollTop = chatContainer.scrollTop;
                    clonedChat.style.backgroundColor = 'transparent';
                }
                if (clonedViewport) {
                    if (currentWallpaperMode === 'image' && currentCustomImgData) {
                        clonedViewport.style.backgroundImage = `url(${currentCustomImgData})`;
                        clonedViewport.style.backgroundSize = 'cover';
                        clonedViewport.style.backgroundColor = 'transparent';
                        clonedViewport.classList.add('has-custom-img');
                    } else if (currentWallpaperMode === 'color') {
                        clonedViewport.style.backgroundColor = currentCustomColor;
                        clonedViewport.style.backgroundImage = 'none';
                        if (isColorDark(currentCustomColor)) {
                            clonedViewport.classList.add('dark-bg');
                        }
                    } else {
                        clonedViewport.style.backgroundColor = screenshotBg;
                    }
                    if (!isDoodleEnabled && clonedDoodle) {
                        clonedDoodle.style.display = 'none';
                    }
                }

                // Disable animations and transitions on clone
                clonedDoc.querySelectorAll('*').forEach(el => {
                    el.style.animation = 'none';
                    el.style.transition = 'none';
                });

                // Operating system theme color palette
                const headerBg = isIOS ? (isDark ? '#161616' : '#f6f6f6') : (isDark ? '#1f2c34' : '#008069');
                const headerColor = (isIOS && !isDark) ? '#000000' : '#ffffff';
                const actionIconColor = isIOS ? (isDark ? '#0A84FF' : '#007AFF') : (isDark ? '#aebac1' : '#ffffff');
                const msgSentBg = isIOS ? (isDark ? '#005d4b' : '#E1FFC7') : (isDark ? '#005c4b' : '#dcf8c6');
                const msgReceivedBg = isIOS ? (isDark ? '#262628' : '#ffffff') : (isDark ? '#202c33' : '#ffffff');
                const msgTextColor = isDark ? '#e9edef' : (isIOS ? '#000000' : '#111b21');
                const msgTimeColor = isIOS ? '#8e8e93' : (isDark ? '#8696a0' : '#667781');
                const tickColor = '#53bdeb';

                // Header styles
                const header = clonedDoc.querySelector('.header');
                if (header) {
                    header.style.backgroundColor = headerBg;
                    header.style.color = headerColor;
                }
                const headerName = clonedDoc.querySelector('.header-name');
                if (headerName) headerName.style.color = headerColor;
                const headerStatus = clonedDoc.querySelector('.header-status');
                if (headerStatus) headerStatus.style.color = isIOS ? '#8e8e93' : (isDark ? '#8696a0' : 'rgba(255, 255, 255, 0.75)');

                clonedDoc.querySelectorAll('.back-btn, .action-icon').forEach(btn => {
                    btn.style.color = actionIconColor;
                });

                // Profile picture styling from live element
                const livePfp = document.getElementById('profilePic');
                const clonedPfp = clonedDoc.getElementById('profilePic');
                if (livePfp && clonedPfp) {
                    clonedPfp.style.backgroundColor = livePfp.style.backgroundColor;
                    clonedPfp.style.backgroundImage = livePfp.style.backgroundImage;
                    clonedPfp.style.color = '#ffffff';
                }

                // Message bubbles styling
                clonedDoc.querySelectorAll('.message.sent').forEach(el => {
                    el.style.backgroundColor = msgSentBg;
                    el.style.color = msgTextColor;
                });
                clonedDoc.querySelectorAll('.message.received').forEach(el => {
                    el.style.backgroundColor = msgReceivedBg;
                    el.style.color = msgTextColor;
                });

                // Message text
                clonedDoc.querySelectorAll('.msg-content').forEach(el => {
                    el.style.color = msgTextColor;
                });

                // Message timestamp & edited flag (strictly grey, never blue)
                clonedDoc.querySelectorAll('.msg-time, .msg-edited-flag').forEach(el => {
                    el.style.color = msgTimeColor;
                });

                // Double check marks (status ticks)
                clonedDoc.querySelectorAll('.msg-status').forEach(el => {
                    el.style.color = tickColor;
                    const svg = el.querySelector('svg');
                    if (svg) svg.style.fill = tickColor;
                });

                // System notifications
                clonedDoc.querySelectorAll('.system-msg').forEach(el => {
                    el.style.backgroundColor = isDark ? '#182229' : 'rgba(255, 255, 255, 0.85)';
                    el.style.color = isDark ? '#8696a0' : '#54656f';
                });
            }
        });

        const link = document.createElement('a');
        link.download = `Chat_${recipientName || 'Export'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Screenshot error:', err);
    } finally {
        btn.innerHTML = origBtnText;
        btn.style.pointerEvents = 'auto';
    }
});

// Profile picture upload
profilePic.addEventListener('click', () => pfpUpload.click());
pfpUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            profilePic.style.backgroundImage = `url(${ev.target.result})`;
            profilePic.innerText = "";
        };
        reader.readAsDataURL(file);
    }
});

// File import
document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => parseChat(e.target.result);
    reader.readAsText(file);
});

// Chat parser
function parseChat(text) {
    const lines = text.split('\n');
    rawMessages = [];
    const regex = /^\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}[, ]+\d{1,2}:\d{2})(?::\d{2})?(?: [aApP][mM])?\]?[ \-]*([^:]+):\s?(.*)$/;
    const systemRegex = /^\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}[, ]+\d{1,2}:\d{2})(?::\d{2})?(?: [aApP][mM])?\]?[ \-]*([^:]+)$/;

    let currentMsg = null;
    const senders = new Set();

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const match = line.match(regex);
        if (match) {
            if (currentMsg) rawMessages.push(currentMsg);
            const ampmMatch = line.match(/[aApP][mM]/);
            const timeStr = match[1] + (ampmMatch ? ' ' + ampmMatch[0] : '');
            const sender = match[2].trim();
            let msgText = match[3];
            let isEdited = msgText.includes('<This message was edited>');
            if (isEdited) msgText = msgText.replace('<This message was edited>', '').trim();
            senders.add(sender);
            currentMsg = {
                timeStr: timeStr.includes(', ') ? timeStr.split(', ')[1] : timeStr,
                sender: sender,
                text: msgText,
                type: 'message',
                isEdited: isEdited,
                id: 'msg-' + rawMessages.length
            };
        } else {
            const sysMatch = line.match(systemRegex);
            if (sysMatch && !currentMsg) {
                rawMessages.push({ timeStr: sysMatch[1], text: sysMatch[2], type: 'system', id: 'msg-' + rawMessages.length });
            } else if (currentMsg) {
                if (line.includes('<This message was edited>')) {
                    currentMsg.isEdited = true;
                    currentMsg.text += '\n' + line.replace('<This message was edited>', '').trim();
                } else { currentMsg.text += '\n' + line; }
            }
        }
    }
    if (currentMsg) rawMessages.push(currentMsg);
    const senderArray = Array.from(senders);
    if (senderArray.length > 0) {
        recipientName = senderArray[0];
        myName = senderArray.length > 1 ? senderArray[1] : senderArray[0];
        document.getElementById('uiRecipientName').textContent = recipientName;
        const parts = recipientName.split(' ');
        profilePic.innerText = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
        profilePic.style.backgroundColor = `hsl(${recipientName.length * 40 % 360}, 45%, 45%)`;
        profilePic.style.backgroundImage = '';
    }
    renderChatAsync(rawMessages);
}

let virtualScroller = {
    items: [],
    rowHeights: [],
    defaultHeight: 50,
    spacer: null,
    content: null,
    startIndex: -1,
    endIndex: -1,
    buffer: 20,
    totalHeight: 0,
    initialized: false,
    renderFrame: null,
    searchQuery: '',
    isExactSearch: false
};

// Virtual Scroller - Instant Chunk-based Rendering
function renderChatAsync(messages) {
    virtualScroller.items = messages;
    virtualScroller.rowHeights = new Array(messages.length).fill(virtualScroller.defaultHeight);
    virtualScroller.totalHeight = messages.length * virtualScroller.defaultHeight;
    virtualScroller.startIndex = -1;
    virtualScroller.endIndex = -1;
    virtualScroller.searchQuery = '';

    chatContainer.innerHTML = `
        <div class="virtual-spacer" style="height: ${virtualScroller.totalHeight}px;"></div>
        <div class="virtual-content" id="virtualContent"></div>
    `;

    virtualScroller.spacer = chatContainer.querySelector('.virtual-spacer');
    virtualScroller.content = chatContainer.querySelector('.virtual-content');

    if (!virtualScroller.initialized) {
        chatContainer.addEventListener('scroll', () => {
            if (virtualScroller.renderFrame) cancelAnimationFrame(virtualScroller.renderFrame);
            virtualScroller.renderFrame = requestAnimationFrame(() => renderVirtualChunk(false));
        });
        virtualScroller.initialized = true;
    }

    // Simulate instant loading for UX
    const overlay = document.getElementById('loadingOverlay');
    const pBar = document.getElementById('progressBar');
    overlay.style.display = 'flex';
    pBar.style.transition = 'width 0.3s ease-out';
    pBar.style.width = '100%';

    setTimeout(() => {
        overlay.style.display = 'none';
        pBar.style.width = '0%';
        pBar.style.transition = 'none';

        chatContainer.scrollTop = virtualScroller.totalHeight;
        renderVirtualChunk(true);
        resetSearch();
    }, 350);
}

function renderVirtualChunk(force = false) {
    if (!virtualScroller.items.length) return;

    const scrollTop = chatContainer.scrollTop;
    const clientHeight = chatContainer.clientHeight || window.innerHeight;

    let accumulated = 0;
    let visibleStart = 0;
    for (let i = 0; i < virtualScroller.rowHeights.length; i++) {
        if (accumulated + virtualScroller.rowHeights[i] > scrollTop) {
            visibleStart = i;
            break;
        }
        accumulated += virtualScroller.rowHeights[i];
    }

    let visibleEnd = visibleStart;
    let visibleHeight = 0;
    for (let i = visibleStart; i < virtualScroller.rowHeights.length; i++) {
        visibleHeight += virtualScroller.rowHeights[i];
        visibleEnd = i;
        if (visibleHeight > clientHeight) break;
    }

    const renderStart = Math.max(0, visibleStart - virtualScroller.buffer);
    const renderEnd = Math.min(virtualScroller.items.length - 1, visibleEnd + virtualScroller.buffer);

    if (!force && renderStart >= virtualScroller.startIndex && renderEnd <= virtualScroller.endIndex && virtualScroller.content.innerHTML !== '') {
        return;
    }

    virtualScroller.startIndex = renderStart;
    virtualScroller.endIndex = renderEnd;

    let transformY = 0;
    for (let i = 0; i < renderStart; i++) {
        transformY += virtualScroller.rowHeights[i];
    }

    let htmlStr = '';
    const isIOS = document.body.classList.contains('ios-mode');

    let hlRegex = null;
    if (virtualScroller.searchQuery) {
        const escapedQuery = virtualScroller.searchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const hlRegexPattern = virtualScroller.isExactSearch ? `(\\b${escapedQuery}\\b)` : `(${escapedQuery})`;
        hlRegex = new RegExp(hlRegexPattern, 'gi');
    }

    for (let i = renderStart; i <= renderEnd; i++) {
        const msg = virtualScroller.items[i];
        let displayHtml = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        if (hlRegex) {
            const markedText = displayHtml.replace(hlRegex, `~~~HL~~~$1~~~/HL~~~`);
            displayHtml = parseAndFormatEmojis(markedText, isIOS).replace(/~~~HL~~~(.*?)~~~\/HL~~~/g, `<span class="word-highlight">$1</span>`);
        } else {
            displayHtml = parseAndFormatEmojis(displayHtml, isIOS);
        }

        if (msg.type === 'system') {
            htmlStr += `<div id="${msg.id}" data-index="${i}" class="system-msg virtual-item">${displayHtml}</div>`;
        } else {
            const isSent = msg.sender === myName;
            const spacerClass = msg.isEdited ? 'msg-spacer edited' : 'msg-spacer';
            const editedTag = msg.isEdited ? `<span class="msg-edited-flag">Edited</span>` : '';

            htmlStr += `
                <div id="${msg.id}" data-index="${i}" class="message ${isSent ? 'sent' : 'received'} virtual-item">
                    <div class="msg-content" data-raw="${msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}">${displayHtml}<span class="${spacerClass}"></span></div>
                    <div class="msg-meta">
                        ${editedTag}
                        <span class="msg-time">${msg.timeStr}</span>
                        <div class="msg-status">
                            <svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.346.125.467-.025l6.253-8.113a.366.366 0 0 0-.03-.514zm-4.322-.442l-.477-.373a.365.365 0 0 0-.51.063L4.346 9.426l-2.22-2.072a.32.32 0 0 0-.47-.019l-.42.42c-.13.13-.13.342-.001.472l2.903 2.912c.144.144.37.135.503-.018l6.02-7.666a.366.366 0 0 0-.041-.51z"></path></svg>
                        </div>
                    </div>
                </div>`;
        }
    }

    virtualScroller.content.innerHTML = htmlStr;
    virtualScroller.content.style.transform = `translateY(${transformY}px)`;

    // Anchor correction
    setTimeout(() => {
        let heightChanged = false;
        let diffBeforeScroll = 0;

        const nodes = virtualScroller.content.querySelectorAll('.virtual-item');
        nodes.forEach(node => {
            const idx = parseInt(node.getAttribute('data-index'));
            const trueHeight = node.offsetHeight + (idx === virtualScroller.items.length - 1 ? 0 : 8);
            const oldHeight = virtualScroller.rowHeights[idx];

            if (Math.abs(trueHeight - oldHeight) > 1) {
                virtualScroller.rowHeights[idx] = trueHeight;
                virtualScroller.totalHeight += (trueHeight - oldHeight);
                heightChanged = true;

                if (idx < visibleStart) {
                    diffBeforeScroll += (trueHeight - oldHeight);
                }
            }
        });

        if (heightChanged) {
            virtualScroller.spacer.style.height = `${virtualScroller.totalHeight}px`;
            if (diffBeforeScroll !== 0) {
                chatContainer.scrollTop += diffBeforeScroll;
            }
        }
    }, 0);
}

// Search UI & Navigation
function resetSearch() {
    searchResults = [];
    currentMatchIndex = -1;
    virtualScroller.searchQuery = '';
    virtualScroller.isExactSearch = false;
    if (searchStats) searchStats.innerText = "0 / 0";
    renderVirtualChunk(true);
}

document.getElementById('searchClear').addEventListener('click', () => {
    searchInput.value = '';
    resetSearch();
});

searchInput.addEventListener('input', (e) => {
    let query = e.target.value.trim();
    if (!query) { resetSearch(); return; }

    const isExact = query.startsWith('"') && query.endsWith('"');
    const actualQuery = isExact ? query.slice(1, -1) : query;
    if (!actualQuery) { resetSearch(); return; }

    virtualScroller.searchQuery = actualQuery;
    virtualScroller.isExactSearch = isExact;

    const escapedQuery = actualQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regexPattern = isExact ? `\\b${escapedQuery}\\b` : escapedQuery;
    const searchRegex = new RegExp(regexPattern, 'i');

    // Search the raw array for lightning fast matching
    searchResults = [];
    for (let i = 0; i < virtualScroller.items.length; i++) {
        if (virtualScroller.items[i].type === 'message' && searchRegex.test(virtualScroller.items[i].text)) {
            searchResults.push(i);
        }
    }

    if (searchResults.length > 0) {
        currentMatchIndex = searchResults.length - 1;
        updateSearchUI();
        jumpToMatch();
    } else {
        if (searchStats) searchStats.innerText = "0 / 0";
        renderVirtualChunk(true);
    }
});

document.getElementById('searchUp').addEventListener('click', () => {
    if (searchResults.length === 0) return;
    currentMatchIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    updateSearchUI();
    jumpToMatch();
});

document.getElementById('searchDown').addEventListener('click', () => {
    if (searchResults.length === 0) return;
    currentMatchIndex = (currentMatchIndex + 1) % searchResults.length;
    updateSearchUI();
    jumpToMatch();
});

function updateSearchUI() {
    if (searchStats) searchStats.innerText = `${currentMatchIndex + 1} / ${searchResults.length}`;
}

function jumpToMatch() {
    const targetIndex = searchResults[currentMatchIndex];
    if (targetIndex === undefined) return;

    // Calculate scroll offset to put this message in view
    let targetY = 0;
    for (let i = 0; i < targetIndex; i++) {
        targetY += virtualScroller.rowHeights[i];
    }

    // Center it in the viewport roughly
    const clientHeight = chatContainer.clientHeight || window.innerHeight;
    chatContainer.scrollTop = Math.max(0, targetY - (clientHeight / 2));

    // Force re-render instantly to show highlights
    renderVirtualChunk(true);
}

// Context Menu (Right Click to Copy Bubble Text)
const hideContextMenu = () => {
    if (contextMenu.classList.contains('show')) {
        contextMenu.classList.remove('show');
    }
};

document.addEventListener('contextmenu', (e) => {
    const msgContent = e.target.closest('.message')?.querySelector('.msg-content');
    if (msgContent) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        selectedTextToCopy = msgContent.getAttribute('data-raw') || msgContent.innerText.trim();

        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 160;
        const menuHeight = 55;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

        contextMenu.style.left = `${Math.max(8, x)}px`;
        contextMenu.style.top = `${Math.max(8, y)}px`;
        contextMenu.classList.add('show');
    } else {
        hideContextMenu();
    }
});

// Prevent chat text selection via cursor
chatContainer.addEventListener('selectstart', (e) => {
    e.preventDefault();
});

// Dismiss context menu on click outside, scroll, wheel, resize, or escape key
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

chatContainer.addEventListener('scroll', hideContextMenu, { passive: true });
window.addEventListener('scroll', hideContextMenu, { passive: true });
window.addEventListener('wheel', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
}, { passive: true });
window.addEventListener('resize', hideContextMenu, { passive: true });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
});

function showToast() {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast();
    } catch (err) {
        console.error(err);
    }
    document.body.removeChild(textArea);
}

document.getElementById('menuCopy').addEventListener('click', () => {
    const textToCopy = selectedTextToCopy;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast();
        }).catch(() => {
            fallbackCopy(textToCopy);
        });
    } else {
        fallbackCopy(textToCopy);
    }
    hideContextMenu();
});

