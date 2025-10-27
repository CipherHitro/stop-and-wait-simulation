// cript.js

let frames = [];
let currentFrameIndex = 0;
let expectedSeqNum = 0;
let isTransmitting = false;
let timeoutHandle = null;
let stats = {
    sent: 0,
    received: 0,
    lost: 0,
    corrupted: 0,
    acksLost: 0,
    duplicatesDiscarded: 0,
    retransmissions: 0
};
let startTime = 0;

function initializeFrames() {
    const data = document.getElementById('dataInput').value || 'HELLO';
    frames = data.split('').map((char, index) => ({
        seqNum: index % 2,
        data: char,
        originalIndex: index
    }));
    currentFrameIndex = 0;
    expectedSeqNum = 0;
}

function startTransmission() {
    if (isTransmitting) return;
    
    initializeFrames();
    isTransmitting = true;
    startTime = Date.now();
    
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('senderStatus').className = 'status-indicator status-active';
    
    addLog('Transmission started', 'log-success');
    sendFrame();
}

function stopTransmission() {
    isTransmitting = false;
    clearTimeout(timeoutHandle);
    
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('senderStatus').className = 'status-indicator';
    document.getElementById('receiverStatus').className = 'status-indicator';
    
    addLog('Transmission stopped', 'log-error');
}

function resetSimulation() {
    stopTransmission();
    
    stats = { sent: 0, received: 0, lost: 0, corrupted: 0, acksLost: 0, duplicatesDiscarded: 0, retransmissions: 0 };
    updateStats();
    
    document.getElementById('log').innerHTML = '';
    document.getElementById('frameContainer').innerHTML = '';
    currentFrameIndex = 0;
    expectedSeqNum = 0;
}

function sendFrame() {
    if (!isTransmitting || currentFrameIndex >= frames.length) {
        if (currentFrameIndex >= frames.length) {
            completeTransmission();
        }
        return;
    }

    const frame = frames[currentFrameIndex];
    stats.sent++;
    updateStats();
    
    document.getElementById('senderStatus').className = 'status-indicator status-active';
    
    addLog(`Sending Frame ${frame.seqNum} [Data: '${frame.data}']`, 'log-sent');
    
    // Validate and cap probabilities at 70%
    const lossProb = Math.min(parseInt(document.getElementById('lossProb').value) || 0, 70);
    const corruptProb = Math.min(parseInt(document.getElementById('corruptProb').value) || 0, 70);
    
    const isLost = Math.random() * 100 < lossProb;
    const isCorrupted = !isLost && Math.random() * 100 < corruptProb;
    
    animateFrame(frame, isLost, isCorrupted);
    
    if (isLost) {
        stats.lost++;
        updateStats();
        addLog(`Frame ${frame.seqNum} lost in transmission!`, 'log-error');
        startTimeout();
    } else if (isCorrupted) {
        stats.corrupted++;
        updateStats();
        setTimeout(() => {
            addLog(`Frame ${frame.seqNum} corrupted! Data received: '${corruptData(frame.data)}'`, 'log-error');
            receiveFrame(frame, true);
        }, 2000);
    } else {
        setTimeout(() => {
            receiveFrame(frame, false);
        }, 2000);
    }
}

function animateFrame(frame, isLost, isCorrupted) {
    const container = document.getElementById('frameContainer');
    const frameEl = document.createElement('div');
    frameEl.className = `frame frame-forward ${isLost ? 'frame-lost' : ''} ${isCorrupted ? 'frame-corrupted' : ''}`;
    frameEl.textContent = `Frame ${frame.seqNum}: '${frame.data}'`;
    container.appendChild(frameEl);
    
    setTimeout(() => frameEl.remove(), isLost ? 1000 : 2000);
}

function receiveFrame(frame, corrupted) {
    document.getElementById('receiverStatus').className = 'status-indicator status-active';
    
    if (corrupted) {
        addLog(`NAK sent for Frame ${frame.seqNum}`, 'log-error');
        sendAck(frame.seqNum, true);
    } else {
        if (frame.seqNum === expectedSeqNum) {
            stats.received++;
            updateStats();
            addLog(`✓ Frame ${frame.seqNum} received successfully [Data: '${frame.data}']`, 'log-received');
            expectedSeqNum = 1 - expectedSeqNum;
            sendAck(frame.seqNum, false);
        } else {
            stats.duplicatesDiscarded++;
            updateStats();
            addLog(`⚠ Duplicate Frame ${frame.seqNum} detected, discarding`, 'log-error');
            addLog(`Sending ACK ${1 - frame.seqNum} for previously received frame`, 'log-ack');
            sendAck(1 - frame.seqNum, false);
        }
    }
}

function sendAck(seqNum, isNak) {
    const container = document.getElementById('frameContainer');
    const ackEl = document.createElement('div');
    ackEl.className = `frame frame-backward ${isNak ? 'frame-corrupted' : ''}`;
    ackEl.textContent = isNak ? `NAK ${seqNum}` : `ACK ${seqNum}`;
    ackEl.style.left = '100%';
    ackEl.style.animation = 'moveFrame 2s linear reverse';
    container.appendChild(ackEl);
    
    // Validate and cap ACK loss probability at 70%
    const ackLossProb = Math.min(parseInt(document.getElementById('ackLossProb').value) || 0, 70);
    const ackIsLost = Math.random() * 100 < ackLossProb;
    
    if (ackIsLost) {
        // ACK is lost - animate and show loss
        setTimeout(() => {
            ackEl.remove();
            const lostAckEl = document.createElement('div');
            lostAckEl.className = 'frame frame-backward frame-lost';
            lostAckEl.textContent = isNak ? `NAK ${seqNum}` : `ACK ${seqNum}`;
            lostAckEl.style.left = '50%';
            container.appendChild(lostAckEl);
            
            stats.acksLost++;
            updateStats();
            addLog(`${isNak ? 'NAK' : 'ACK'} ${seqNum} lost in transmission!`, 'log-error');
            
            setTimeout(() => {
                lostAckEl.remove();
            }, 1000);
        }, 1000);
        
        // Start timeout for sender to retransmit
        setTimeout(() => {
            startTimeout();
        }, 1000);
    } else {
        // ACK received successfully
        setTimeout(() => {
            ackEl.remove();
            receiveAck(seqNum, isNak);
        }, 2000);
    }
}

function receiveAck(seqNum, isNak) {
    clearTimeout(timeoutHandle);
    document.getElementById('senderStatus').className = 'status-indicator status-waiting';
    document.getElementById('receiverStatus').className = 'status-indicator';
    
    if (isNak) {
        addLog(`NAK ${seqNum} received, retransmitting...`, 'log-timeout');
        stats.retransmissions++;
        updateStats();
        setTimeout(sendFrame, 1000);
    } else {
        addLog(`ACK ${seqNum} received`, 'log-ack');
        currentFrameIndex++;
        setTimeout(sendFrame, 1000);
    }
}

function startTimeout() {
    const timeout = parseInt(document.getElementById('timeout').value) || 3000;
    timeoutHandle = setTimeout(() => {
        addLog(`Timeout! Retransmitting Frame ${frames[currentFrameIndex].seqNum}`, 'log-timeout');
        stats.retransmissions++;
        updateStats();
        sendFrame();
    }, timeout);
}

function completeTransmission() {
    isTransmitting = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('senderStatus').className = 'status-indicator';
    document.getElementById('receiverStatus').className = 'status-indicator';
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    document.getElementById('totalTime').textContent = totalTime + 's';
    
    addLog(`✓ Transmission completed successfully! All ${frames.length} frames delivered.`, 'log-success');
    addLog(`📊 Summary: ${stats.retransmissions} retransmissions, ${stats.duplicatesDiscarded} duplicates discarded`, 'log-success');
    addLog(`📊 Losses: ${stats.lost} frames, ${stats.acksLost} ACKs, ${stats.corrupted} corrupted`, 'log-success');
}

function corruptData(data) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    return chars[Math.floor(Math.random() * chars.length)];
}

function updateStats() {
    document.getElementById('framesSent').textContent = stats.sent;
    document.getElementById('framesReceived').textContent = stats.received;
    document.getElementById('framesLost').textContent = stats.lost;
    document.getElementById('framesCorrupted').textContent = stats.corrupted;
    document.getElementById('acksLost').textContent = stats.acksLost;
    document.getElementById('duplicatesDiscarded').textContent = stats.duplicatesDiscarded;
    document.getElementById('retransmissions').textContent = stats.retransmissions;
}

function addLog(message, className) {
    const log = document.getElementById('log');
    const entry = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    entry.className = `log-entry ${className}`;
    entry.textContent = `[${timestamp}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// Validate probability inputs
function validateProbability(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('input', function() {
            let value = parseInt(this.value);
            if (value > 70) {
                this.value = 70;
                addLog(`⚠ Probability capped at 70% to ensure meaningful transmission`, 'log-error');
            } else if (value < 0) {
                this.value = 0;
            }
        });
    }
}

// Initialize validation on page load
window.addEventListener('DOMContentLoaded', function() {
    validateProbability('lossProb');
    validateProbability('corruptProb');
    validateProbability('ackLossProb');
    addLog('Simulator ready. Configure parameters and click Start.', 'log-success');
});
