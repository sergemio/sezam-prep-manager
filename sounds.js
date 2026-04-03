// Web Audio API sound system — no files needed
const SoundFX = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, ac.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + delay);
        osc.stop(ac.currentTime + delay + duration);
    }

    return {
        // Satisfying ascending chime — prep/task completed
        complete() {
            playTone(523, 0.15, 'sine', 0.12, 0);      // C5
            playTone(659, 0.15, 'sine', 0.12, 0.1);     // E5
            playTone(784, 0.25, 'sine', 0.14, 0.2);     // G5
            playTone(1047, 0.35, 'sine', 0.10, 0.3);    // C6 (resolve)
        },

        // Soft click — navigation, button taps
        tap() {
            playTone(800, 0.06, 'sine', 0.06, 0);
        },

        // Victory fanfare — all preps done
        celebration() {
            // Fanfare: C5 E5 G5 → C6 chord with shimmer
            playTone(523, 0.18, 'sine', 0.10, 0);       // C5
            playTone(659, 0.18, 'sine', 0.10, 0.12);    // E5
            playTone(784, 0.18, 'sine', 0.10, 0.24);    // G5
            // Big resolve chord
            playTone(1047, 0.5, 'sine', 0.13, 0.4);     // C6
            playTone(1319, 0.5, 'sine', 0.09, 0.4);     // E6
            playTone(1568, 0.5, 'sine', 0.07, 0.4);     // G6
            // Sparkle top notes
            playTone(2093, 0.3, 'sine', 0.05, 0.55);    // C7
            playTone(2637, 0.25, 'sine', 0.03, 0.65);   // E7
        },

        // Soft pop — modal open
        pop() {
            const ac = getCtx();
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ac.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.08);
            gain.gain.setValueAtTime(0.08, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.12);
        }
    };
})();
