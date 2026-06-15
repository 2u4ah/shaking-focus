// 흔들리는 집중 - Game Engine Logic

class SoundSynth {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.sequencerInterval = null;
    this.currentStep = 0;
    this.bpm = 120;
    this.stepDuration = 60 / this.bpm / 4; // 16th notes
    this.bassPattern = [36, 36, 43, 43, 39, 39, 41, 41]; // Midi numbers for bass (C2, G2, D#2, F2)
    this.melodyPattern = [
      60, 0, 63, 65, 0, 67, 0, 70,
      67, 0, 65, 0, 63, 60, 0, 0
    ]; // Pentatonic minor melody sequence
    this.isMuted = false;
    this.masterGain = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.7;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  setBPM(newBpm) {
    this.bpm = newBpm;
    this.stepDuration = 60 / this.bpm / 4;
  }

  startBGM() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.setBPM(120); // Reset BPM to start
    
    let nextNoteTime = this.ctx.currentTime;
    
    const scheduleNextStep = () => {
      while (nextNoteTime < this.ctx.currentTime + 0.1) {
        this.playStep(this.currentStep, nextNoteTime);
        nextNoteTime += this.stepDuration;
        this.currentStep = (this.currentStep + 1) % 16;
      }
    };
    
    this.sequencerInterval = setInterval(scheduleNextStep, 25);
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.sequencerInterval) {
      clearInterval(this.sequencerInterval);
      this.sequencerInterval = null;
    }
  }

  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  playStep(step, time) {
    // 1. Kick Drum on beats 1, 5, 9, 13 (step 0, 4, 8, 12)
    if (step % 4 === 0) {
      this.playKick(time);
    }
    
    // 2. Snare Drum on beats 5, 13 (step 4, 12)
    if (step % 8 === 4) {
      this.playSnare(time);
    }
    
    // 3. Hihat on odd steps
    if (step % 2 === 1) {
      this.playHihat(time);
    }

    // 4. Bass Line on even steps
    if (step % 2 === 0) {
      const bassIndex = Math.floor(step / 2) % this.bassPattern.length;
      const bassNote = this.bassPattern[bassIndex];
      this.playBass(this.midiToFreq(bassNote), time);
    }

    // 5. Synth Melody
    const melodyNote = this.melodyPattern[step];
    if (melodyNote > 0 && Math.random() > 0.35) {
      this.playMelody(this.midiToFreq(melodyNote), time);
    }

    // Callback to spawn note in game sync with rhythm
    if (typeof gameInstance !== 'undefined' && gameInstance.isGamePlaying) {
      // Spawn note occasionally on beat steps
      if (step % 2 === 0 && Math.random() < gameInstance.spawnProbability) {
        gameInstance.spawnNote();
      }
    }
  }

  playKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.25);
    
    gain.gain.setValueAtTime(0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
    
    osc.start(time);
    osc.stop(time + 0.25);
  }

  playSnare(time) {
    if (!this.ctx) return;
    // Noise buffer snare
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, time);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start(time);
    noise.stop(time + 0.12);
  }

  playHihat(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(9000, time);
    
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.04);
  }

  playBass(freq, time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.22);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.22);
  }

  playMelody(freq, time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    
    // Lowpass filter to make it sound warm
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, time);
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.3);
  }

  // Effect Sounds
  playPerfect() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.frequency.setValueAtTime(880, now); // A5
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.18);
    osc2.stop(now + 0.18);
  }

  playGood() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(659.25, now); // E5
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playMiss() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.22);
    
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playAlert() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.setValueAtTime(1200, now + 0.07);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playRankFanfare() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      
      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.4);
    });
  }

  playRankSiren() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.25);
    osc.frequency.linearRampToValueAtTime(150, now + 0.5);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.55);
  }
}

// Distraction templates
const DISTRACTIONS = [
  {
    type: 'kakao',
    appName: '카카오톡',
    title: '엄마 👩‍👦',
    body: '공부하고 있니? 스마트폰 그만 보고 집중해라.',
    bgColor: '#f7e600',
    color: '#3a1d1d'
  },
  {
    type: 'kakao',
    appName: '카카오톡',
    title: '쿠팡 로켓배송 📦',
    body: '[로켓와우] 배송 완료! 기계식 키보드가 문 앞에 안전히 배송되었습니다.',
    bgColor: '#f7e600',
    color: '#3a1d1d'
  },
  {
    type: 'discord',
    appName: 'Discord',
    title: '롤(LoL) 빌런 🎮',
    body: '야 랭크 한 판 모자람 드루와 드루와!!! (4/5 대기 중)',
    actionText: '수락 및 롤 실행'
  },
  {
    type: 'discord',
    appName: 'Discord',
    title: '스팀 게임 할인 정보 💸',
    body: '@everyone 역대급 스팀 85% 특별 할인 시작! 위쳐3, 사이버펑크 겟잇!',
    actionText: '상점 바로가기'
  },
  {
    type: 'youtube',
    appName: 'YouTube 🎬',
    title: '넷플릭스 코리아',
    body: '[공식 예고편] 오징어 게임 시즌 2 드디어 출시!! 충격 결말 공개?'
  },
  {
    type: 'instagram',
    appName: 'Instagram',
    title: '민우 님이 게시물을 좋아합니다',
    body: '❤️ user_xyz님이 2시간 전 업로드한 게시글을 좋아합니다.'
  },
  {
    type: 'instagram',
    appName: 'Instagram',
    title: '혜원 님이 스토리에서 언급함',
    body: '🏷️ "@student_focus 대박 공부 중? 파이팅ㅋㅋ"'
  },
  {
    type: 'ad',
    appName: 'SPONSOR AD ⚡',
    title: '🔥 대박 코인 1000% 폭등!! 🔥',
    body: '이 기회를 놓치면 평생 가난하게 삽니다. 지금 즉시 무료 가입!!'
  },
  {
    type: 'ad',
    appName: 'POPUP AD 🛍️',
    title: '마감 임박 98% 세일!',
    body: '노이즈캔슬링 헤드폰 13,900원 선착순 10명 한정 판매! 즉시 구매하기'
  },
  {
    type: 'battery',
    appName: 'SYSTEM WARNING ⚠️',
    title: '배터리 충전 필요',
    body: '배터리가 10% 남았습니다. 곧 전원이 꺼질 수 있습니다.'
  },
  {
    type: 'update',
    appName: 'SYSTEM UPDATE 🔄',
    title: 'Windows 업데이트 알림',
    body: '중요 보안 업데이트 완료를 위해 5분 후 강제로 자동 재부팅됩니다.'
  }
];

const NOTE_TASKS = [
  '공부하기 📚',
  '과제 제출 ✍️',
  '단어 암기 🧠',
  '독후감 작성 📖',
  '코딩 실습 💻',
  '자료 검색 🔍',
  '수업 복습 📝',
  '논문 읽기 📑'
];

class Game {
  constructor() {
    this.sound = new SoundSynth();
    
    // Game state variables
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    
    this.isGamePlaying = false;
    this.gameTimeRemaining = 60; // 60 seconds
    this.gameDuration = 60;
    
    // Dynamic difficulty parameters (Percentage height per second)
    this.noteSpeed = 30.0; // cross 30% of screen height per second
    this.spawnProbability = 0.20; // beat-sync note spawn rate (lowered to balance score)
    this.distractionInterval = 5000; // milliseconds between distractions
    
    // Notes track
    this.notes = [];
    this.noteIdCounter = 0;
    this.activeKeys = { d: false, f: false, j: false, k: false };
    this.laneMapping = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
    
    this.distractionTimer = null;
    this.countdownTimer = null;
    this.gameTimer = null;
    
    // SVG book icon representation
    this.bookIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v18H6.5a1.5 1.5 0 0 0-1.5 1.5z"/></svg>`;
    
    // Animation frame management
    this.lastTime = 0;
    this.openingDistractionTimer = null;
    
    this.bindEvents();
    this.startOpeningLoop();
  }

  bindEvents() {
    // Opening screen start button
    document.getElementById('start-btn').addEventListener('click', () => {
      this.sound.init(); // Initialize audio context on click
      this.stopOpeningLoop();
      this.startCountdown();
    });

    // Ending screen restart button
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.resetGame();
      this.startCountdown();
    });

    // Share result button
    document.getElementById('share-btn').addEventListener('click', () => {
      this.shareResult();
    });

    // Mute button
    document.getElementById('mute-btn').addEventListener('click', () => {
      this.toggleMute();
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.laneMapping && !this.activeKeys[key]) {
        this.activeKeys[key] = true;
        this.handleKeyPress(this.laneMapping[key]);
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.laneMapping) {
        this.activeKeys[key] = false;
        this.deactivateLane(this.laneMapping[key]);
      }
    });
  }

  toggleMute() {
    const isMuted = this.sound.toggleMute();
    const btn = document.getElementById('mute-btn');
    const icon = document.getElementById('sound-icon');
    
    if (isMuted) {
      btn.classList.add('muted');
      icon.innerHTML = `
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      `;
    } else {
      btn.classList.remove('muted');
      icon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      `;
    }
  }

  startOpeningLoop() {
    // Spawn opening mock distractions on the start screen
    const spawnMock = () => {
      const container = document.getElementById('opening-notifications');
      if (!container || this.isGamePlaying) return;
      
      const data = DISTRACTIONS[Math.floor(Math.random() * DISTRACTIONS.length)];
      const popup = document.createElement('div');
      popup.className = `distraction-popup dist-${data.type}`;
      
      // Spawn in bounded areas around the screen edges
      const availableWidth = container.clientWidth - 330;
      const availableHeight = container.clientHeight - 200;
      
      const randomLeft = Math.random() * availableWidth;
      const randomTop = 50 + Math.random() * availableHeight;
      
      popup.style.left = `${randomLeft}px`;
      popup.style.top = `${randomTop}px`;
      popup.style.zIndex = Math.floor(Math.random() * 5) + 1;
      
      let headerStyle = data.bgColor ? `style="background-color: ${data.bgColor}; color: ${data.color || '#fff'}"` : '';
      let timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      popup.innerHTML = `
        <div class="popup-header">
          <div class="popup-icon" ${headerStyle}>${data.appName.substring(0, 1)}</div>
          <div class="popup-app-name">${data.appName}</div>
          <div class="popup-time">${timeStr}</div>
        </div>
        <div class="popup-title">${data.title}</div>
        <div class="popup-body">${data.body}</div>
      `;
      
      container.appendChild(popup);
      
      // Auto-remove after 4.5 seconds
      setTimeout(() => {
        popup.style.transform = 'scale(0.85)';
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 250);
      }, 4500);
    };

    // Spawn first after delay
    setTimeout(spawnMock, 500);
    this.openingDistractionTimer = setInterval(spawnMock, 2000);
  }

  stopOpeningLoop() {
    if (this.openingDistractionTimer) {
      clearInterval(this.openingDistractionTimer);
      this.openingDistractionTimer = null;
    }
    const container = document.getElementById('opening-notifications');
    if (container) container.innerHTML = '';
  }

  startCountdown() {
    this.switchScreen('countdown-screen');
    const countdownEl = document.getElementById('countdown-text');
    let count = 3;
    countdownEl.innerText = count;
    
    // Play chime sound
    this.sound.playGood();
    
    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.innerText = count;
        this.sound.playGood();
      } else if (count === 0) {
        countdownEl.innerText = "START";
        this.sound.playPerfect();
      } else {
        clearInterval(this.countdownTimer);
        this.startGame();
      }
    }, 1000);
  }

  startGame() {
    this.switchScreen('game-screen');
    this.isGamePlaying = true;
    this.notes = [];
    this.lastTime = 0;
    
    // Clean up playground
    document.querySelectorAll('.playboard .note').forEach(n => n.remove());
    document.getElementById('distraction-container').innerHTML = '';
    
    // Initialize stats
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.gameTimeRemaining = this.gameDuration;
    
    this.updateStatsDisplay();
    this.sound.startBGM();
    
    // Reset difficulty params (percentage of lane crossed per second)
    this.noteSpeed = 30.0; // takes 3.3s to reach bottom
    this.spawnProbability = 0.20; // Starts lower
    this.distractionInterval = 5000;
    
    // Start countdown timer
    this.gameTimer = setInterval(() => {
      this.gameTimeRemaining--;
      this.updateProgress();
      
      const elapsed = this.gameDuration - this.gameTimeRemaining;
      
      // Dynamic difficulty scaling + BGM Tempo increase
      if (elapsed === 15) {
        this.noteSpeed = 39.0; // takes 2.56s to reach bottom
        this.spawnProbability = 0.26;
        this.distractionInterval = 3500;
        this.sound.setBPM(130);
        this.resetDistractionTimer();
      } else if (elapsed === 30) {
        this.noteSpeed = 48.0; // takes 2.08s to reach bottom
        this.spawnProbability = 0.32;
        this.distractionInterval = 2200;
        this.sound.setBPM(142);
        this.resetDistractionTimer();
      } else if (elapsed === 45) {
        this.noteSpeed = 60.0; // takes 1.67s to reach bottom
        this.spawnProbability = 0.40;
        this.distractionInterval = 1200;
        this.sound.setBPM(155);
        this.resetDistractionTimer();
      }

      if (this.gameTimeRemaining <= 0) {
        this.endGame();
      }
    }, 1000);

    // Start distraction spawn engine
    this.spawnDistractionLoop();

    // Start requestAnimationFrame game loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resetDistractionTimer() {
    if (this.distractionTimer) {
      clearTimeout(this.distractionTimer);
    }
    this.spawnDistractionLoop();
  }

  spawnDistractionLoop() {
    if (!this.isGamePlaying) return;
    
    this.distractionTimer = setTimeout(() => {
      this.spawnDistraction();
      this.spawnDistractionLoop();
    }, this.distractionInterval);
  }

  spawnDistraction() {
    if (!this.isGamePlaying) return;
    
    const container = document.getElementById('distraction-container');
    const data = DISTRACTIONS[Math.floor(Math.random() * DISTRACTIONS.length)];
    
    const popup = document.createElement('div');
    popup.className = `distraction-popup dist-${data.type}`;
    
    // Position within container overlays
    const leftMargin = 270; // Width of sidebar panel
    const availableWidth = container.clientWidth - 330; 
    const availableHeight = container.clientHeight - 200; 
    
    const randomLeft = leftMargin + Math.random() * (availableWidth - leftMargin);
    const randomTop = 50 + Math.random() * availableHeight;
    
    popup.style.left = `${randomLeft}px`;
    popup.style.top = `${randomTop}px`;
    
    let headerStyle = data.bgColor ? `style="background-color: ${data.bgColor}; color: ${data.color || '#fff'}"` : '';
    let timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    let extraHTML = '';
    if (data.type === 'battery') {
      extraHTML = `<div class="battery-bar"><div class="battery-level"></div></div>`;
    } else if (data.type === 'discord' && data.actionText) {
      extraHTML = `<button class="popup-action-btn">${data.actionText}</button>`;
    }
    
    popup.innerHTML = `
      <div class="popup-close">✕</div>
      <div class="popup-header">
        <div class="popup-icon" ${headerStyle}>${data.appName.substring(0, 1)}</div>
        <div class="popup-app-name">${data.appName}</div>
        <div class="popup-time">${timeStr}</div>
      </div>
      <div class="popup-title">${data.title}</div>
      <div class="popup-body">${data.body}</div>
      ${extraHTML}
    `;
    
    // Play alert audio chime
    this.sound.playAlert();
    
    // Attach close button event
    const closeBtn = popup.querySelector('.popup-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.style.transform = 'scale(0.8)';
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
    });

    // Auto-close: Ads disappear in 3 seconds, others in 5 seconds
    const autoCloseTime = (data.type === 'ad') ? 3000 : 5000;
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.transform = 'scale(0.9)';
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 200);
      }
    }, autoCloseTime);

    container.appendChild(popup);
  }

  spawnNote() {
    const lane = Math.floor(Math.random() * 4);
    const noteId = this.noteIdCounter++;
    const lanes = document.querySelectorAll('.playboard .lane');
    const laneElement = lanes[lane];
    
    const noteEl = document.createElement('div');
    noteEl.className = `note note-${['d','f','j','k'][lane]}`;
    noteEl.id = `note-${noteId}`;
    noteEl.style.transform = `translateY(0px)`;
    
    const taskText = NOTE_TASKS[Math.floor(Math.random() * NOTE_TASKS.length)];
    
    noteEl.innerHTML = `
      <span class="note-label">
        ${this.bookIconSVG}
        ${taskText}
      </span>
    `;
    
    laneElement.appendChild(noteEl);
    
    this.notes.push({
      id: noteId,
      lane: lane,
      y: 0, // starts at top (0% of height)
      element: noteEl,
      active: true
    });
  }

  handleKeyPress(laneIndex) {
    const lanes = document.querySelectorAll('.playboard .lane');
    const laneKeys = ['d','f','j','k'];
    lanes[laneIndex].classList.add(`active-${laneKeys[laneIndex]}`);
    
    if (!this.isGamePlaying) return;
    
    // Filter active notes in target lane
    const laneNotes = this.notes.filter(n => n.lane === laneIndex && n.active);
    
    // Ghost press mashing penalty
    if (laneNotes.length === 0) {
      this.score = Math.max(0, this.score - 3);
      this.combo = 0;
      this.sound.playMiss();
      this.showJudgement('miss');
      this.updateStatsDisplay();
      return;
    }
    
    // Find closest note (judgement line sits at 80% height)
    let closestNote = laneNotes[0];
    let minDistance = Math.abs(closestNote.y - 80);
    
    for (let i = 1; i < laneNotes.length; i++) {
      let dist = Math.abs(laneNotes[i].y - 80);
      if (dist < minDistance) {
        minDistance = dist;
        closestNote = laneNotes[i];
      }
    }
    
    // Hitting registration (register within range of 12%)
    if (minDistance < 12) {
      closestNote.active = false;
      closestNote.element.remove();
      
      let rating = '';
      if (minDistance < 3.5) {
        rating = 'perfect';
        this.score += 10;
        this.combo++;
        this.perfectCount++;
        this.sound.playPerfect();
        this.createParticles(laneIndex, closestNote.y, 'var(--neon-green)');
      } else if (minDistance < 8.0) {
        rating = 'good';
        this.score += 5;
        this.combo++;
        this.goodCount++;
        this.sound.playGood();
        this.createParticles(laneIndex, closestNote.y, 'var(--neon-cyan)');
      } else {
        rating = 'miss';
        this.score = Math.max(0, this.score - 5);
        this.combo = 0;
        this.missCount++;
        this.sound.playMiss();
        this.triggerShake();
      }
      
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      
      this.showJudgement(rating);
      this.updateStatsDisplay();
    } else {
      // Too far away penalty (anti-mashing)
      this.score = Math.max(0, this.score - 3);
      this.combo = 0;
      this.sound.playMiss();
      this.showJudgement('miss');
      this.updateStatsDisplay();
    }
  }

  deactivateLane(laneIndex) {
    const lanes = document.querySelectorAll('.playboard .lane');
    const laneKeys = ['d','f','j','k'];
    lanes[laneIndex].classList.remove(`active-${laneKeys[laneIndex]}`);
  }

  triggerShake() {
    const playboard = document.querySelector('.playboard');
    playboard.classList.remove('shake');
    void playboard.offsetWidth; // trigger reflow
    playboard.classList.add('shake');
    setTimeout(() => {
      playboard.classList.remove('shake');
    }, 150);
  }

  showJudgement(rating) {
    const ratingEl = document.getElementById('judgement-text');
    const comboEl = document.getElementById('combo-text');
    
    ratingEl.className = `judgement-text ${rating}`;
    ratingEl.innerText = rating.toUpperCase();
    
    if (this.combo > 1) {
      comboEl.innerHTML = `${this.combo} <span>Combo</span>`;
      comboEl.className = 'combo-text active';
      void comboEl.offsetWidth; // trigger reflow
    } else {
      comboEl.className = 'combo-text';
    }
  }

  createParticles(laneIndex, noteYPercent, color) {
    const playboard = document.querySelector('.playboard');
    const lanes = document.querySelectorAll('.playboard .lane');
    const laneEl = lanes[laneIndex];
    
    const laneRect = laneEl.getBoundingClientRect();
    const boardRect = playboard.getBoundingClientRect();
    
    // center of lane, and note y percentage converted to pixels
    const x = laneRect.left - boardRect.left + laneRect.width / 2;
    const y = (noteYPercent / 100) * boardRect.height;
    
    const numParticles = 14;
    for (let i = 0; i < numParticles; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.backgroundColor = color;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      
      const angle = Math.random() * Math.PI * 2;
      const velocity = 35 + Math.random() * 65;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;
      
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      
      playboard.appendChild(p);
      
      setTimeout(() => p.remove(), 400);
    }
  }

  gameLoop(timestamp) {
    if (!this.isGamePlaying) return;
    
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    
    // Cap dt to prevent massive jumps when switching tabs
    if (dt > 0.1) dt = 0.1;
    this.lastTime = timestamp;
    
    const boardHeight = document.querySelector('.playboard').clientHeight;
    
    // Update notes positions
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (!note.active) continue;
      
      // Speed is percentage of height crossed per second
      note.y += this.noteSpeed * dt;
      
      // Update DOM position
      note.element.style.transform = `translateY(${(note.y / 100) * boardHeight}px)`;
      
      // Check for MISS (leaves bottom boundary - 91% height limit)
      if (note.y > 91) {
        note.active = false;
        note.element.remove();
        
        this.score = Math.max(0, this.score - 5);
        this.combo = 0;
        this.missCount++;
        
        this.sound.playMiss();
        this.triggerShake();
        this.showJudgement('miss');
        this.updateStatsDisplay();
      }
    }
    
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateProgress() {
    const bar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');
    const percentage = (this.gameTimeRemaining / this.gameDuration) * 100;
    
    bar.style.width = `${percentage}%`;
    timerText.innerText = `${this.gameTimeRemaining}s`;
  }

  updateStatsDisplay() {
    document.getElementById('score-value').innerText = this.score;
    document.getElementById('combo-value').innerText = this.combo;
  }

  endGame() {
    this.isGamePlaying = false;
    this.sound.stopBGM();
    
    clearInterval(this.gameTimer);
    clearTimeout(this.distractionTimer);
    
    this.switchScreen('ending-screen');
    this.renderResults();
  }

  renderResults() {
    // Current date and time formatting
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateStr = new Date().toLocaleDateString('ko-KR', options);
    document.getElementById('end-date').innerText = dateStr;

    // Roll up animation for final score
    const scoreEl = document.getElementById('end-score');
    const targetScore = this.score;
    const duration = 1200; // 1.2 seconds
    const startTime = performance.now();
    
    const countUp = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const val = Math.floor(progress * targetScore);
      scoreEl.innerText = `${val}점`;
      if (progress < 1) {
        requestAnimationFrame(countUp);
      }
    };
    requestAnimationFrame(countUp);

    // Static counts
    document.getElementById('end-perfect').innerText = this.perfectCount;
    document.getElementById('end-good').innerText = this.goodCount;
    document.getElementById('end-miss').innerText = this.missCount;
    document.getElementById('end-maxcombo').innerText = this.maxCombo;
    
    // Badge status evaluation
    const badgeCard = document.getElementById('badge-card');
    const badgeIcon = document.getElementById('badge-icon');
    const badgeTitle = document.getElementById('badge-title');
    const badgeDesc = document.getElementById('badge-desc');
    
    badgeCard.className = 'badge-card'; // reset
    
    if (this.score >= 300) {
      badgeCard.classList.add('master');
      badgeIcon.innerText = '🏆';
      badgeTitle.innerText = '집중력 마스터';
      badgeDesc.innerText = '경이로운 집중력의 소유자이십니다! 폭풍처럼 쏟아지는 디지털 유혹과 자극들을 완벽히 차단하고 학업 목표를 완수했습니다. 당신은 진정한 현대의 집중력 종결자!';
      this.sound.playRankFanfare();
    } else if (this.score >= 150) {
      badgeCard.classList.add('good');
      badgeIcon.innerText = '🥈';
      badgeTitle.innerText = '집중력 우수';
      badgeDesc.innerText = '훌륭한 조율 능력입니다! 방해 알림들에 몇 차례 주의가 산만해졌지만, 높은 자기 통제력으로 훌륭히 공부를 완료했습니다. 조금만 더 메신저를 멀리해 볼까요?';
      this.sound.playGood();
    } else {
      badgeCard.classList.add('distracted');
      badgeIcon.innerText = '⚠️';
      badgeTitle.innerText = '주의 분산 상태';
      badgeDesc.innerText = '스마트폰과 각종 SNS, 광고의 무차별 정보 공격에 정신을 완전히 잠식당하고 말았습니다... 공부할 때는 폰을 서랍이나 멀리 격리시키는 것을 처방합니다.';
      this.sound.playRankSiren();
    }
  }

  shareResult() {
    let rank = '';
    if (this.score >= 300) rank = '🏆 집중력 마스터';
    else if (this.score >= 150) rank = '🥈 집중력 우수';
    else rank = '⚠️ 주의 분산 상태';

    const shareText = `🎮 리듬게임 [흔들리는 집중 (Shaking Focus)] 결과
-----------------------------------------
수많은 디지털 자극 속에서 내 공부 집중력 평가는?

★ 최종 집중도: ${this.score}점
★ 최대 콤보: ${this.maxCombo} Combo
★ 집중력 판정: [ ${rank} ]
-----------------------------------------
디지털 방해 요소들을 클릭해 끄고 60초간 살아남으세요!
지금 플레이해보기 👉 ${window.location.href}`;

    navigator.clipboard.writeText(shareText).then(() => {
      // Toast notice creation
      const toast = document.createElement('div');
      toast.className = 'toast-message';
      toast.innerText = '결과가 클립보드에 복사되었습니다! 📋';
      
      toast.style.position = 'fixed';
      toast.style.top = '30px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      toast.style.background = 'rgba(0, 242, 254, 0.95)';
      toast.style.color = '#05070e';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '50px';
      toast.style.fontWeight = '800';
      toast.style.fontSize = '0.9rem';
      toast.style.zIndex = '9999';
      toast.style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.4)';
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      
      document.body.appendChild(toast);
      
      // trigger slide and fade in
      setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      }, 50);
      
      // fade and remove
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-15px)';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
    });
  }

  resetGame() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.gameTimer) clearInterval(this.gameTimer);
    if (this.distractionTimer) clearTimeout(this.distractionTimer);
    this.stopOpeningLoop();
    
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.notes = [];
    this.lastTime = 0;
    
    document.getElementById('distraction-container').innerHTML = '';
  }

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
  }
}

// Instantiate game
let gameInstance;
window.addEventListener('DOMContentLoaded', () => {
  gameInstance = new Game();
});
