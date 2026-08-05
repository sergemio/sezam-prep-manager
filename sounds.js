// Web Audio API sound system — no files needed
//
// POURQUOI TOUT CE QUI SUIT. Un AudioContext cree sans geste utilisateur demarre en etat
// "suspended", et sur iOS il y RETOURNE apres chaque mise en veille. Dans cet etat,
// osc.start() ne produit ni son NI erreur : le silence est total et invisible.
// C'est ce qui faisait qu'un message d'equipe ne sonnait jamais sur la tablette de la
// cuisine — les deux seules sonneries "mains libres" (messageAlert, taskAppear) sont
// justement celles qui partent sans que personne ne touche l'ecran, donc les seules a
// tomber systematiquement dans le vide.
//
// Trois filets : deblocage au premier geste, reprise au retour de veille, et reprise
// opportuniste juste avant de jouer.
const SoundFX = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            // iPad : le bouton silencieux physique coupe le Web Audio, meme contexte
            // actif — une tablette posee en cuisine peut donc rester muette sans que
            // rien ne le montre. Depuis Safari 16.4 on peut declarer la session comme
            // "playback" (au sens musique/alerte) pour passer outre. Absent ailleurs,
            // d'ou le test : c'est un bonus, pas une dependance.
            try {
                if (navigator.audioSession) navigator.audioSession.type = 'playback';
            } catch (e) { /* non supporte : on garde le comportement par defaut */ }
        }
        return ctx;
    }

    // Etat reel du moteur audio. Expose pour le diagnostic : "ca ne sonne pas" doit
    // pouvoir se verifier au lieu de se deviner.
    function audioState() {
        if (!ctx) return 'not-created';
        return ctx.state;   // 'running' | 'suspended' | 'closed'
    }

    function unlock() {
        const ac = getCtx();
        if (ac.state === 'suspended') {
            // refreshIndicator est hoistee ; au moment ou unlock() s'execute (sur
            // evenement) le module est entierement evalue.
            ac.resume().then(refreshIndicator).catch(() => {});
        }
        return ac.state;
    }

    function emit(ac, freq, duration, type, volume, delay) {
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

    function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
        const ac = getCtx();
        if (ac.state === 'suspended') {
            // resume() n'aboutit que si l'audio a deja ete debloque par un geste ;
            // sinon la promesse traine ou echoue, d'ou le .catch muet. Le son part
            // APRES la reprise : quelques dizaines de ms, imperceptible.
            ac.resume().then(() => emit(ac, freq, duration, type, volume, delay))
                       .catch(() => {});
            return;
        }
        emit(ac, freq, duration, type, volume, delay);
    }

    // Le tout premier geste de la session debloque l'audio pour de bon. On ecoute large
    // (tap, clic, touche) et en capture, pour ne dependre d'aucun handler applicatif.
    ['pointerdown', 'touchend', 'mousedown', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, unlock, { capture: true, passive: true });
    });

    // Retour de veille : cas typique de la tablette de cuisine reprise le matin. iOS
    // suspend le contexte pendant la veille et ne le relance pas tout seul.
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') unlock();
        setTimeout(refreshIndicator, 300);
    });

    // --- Indicateur "son coupe" -------------------------------------------------
    // Tant qu'aucun geste n'a eu lieu, AUCUN son ne peut sortir : c'est une regle du
    // navigateur, pas un reglage. Le seul tort serait de laisser ce silence invisible —
    // une tablette qui ne sonnera pas doit le DIRE, sinon on croit les messages passes.
    // Le bouton s'efface de lui-meme des que l'audio repart.
    let indicator = null;

    function refreshIndicator() {
        const blocked = ctx && ctx.state === 'suspended';
        if (!blocked) {
            if (indicator) { indicator.remove(); indicator = null; }
            return;
        }
        if (indicator) return;
        indicator = document.createElement('button');
        indicator.type = 'button';
        indicator.textContent = '🔇 Tap to enable sound';
        indicator.setAttribute('aria-label', 'Enable notification sounds');
        indicator.style.cssText = [
            'position:fixed', 'right:12px', 'bottom:12px', 'z-index:9999',
            'padding:10px 14px', 'border-radius:999px', 'border:none',
            'background:#8a6100', 'color:#fff', 'font-size:14px', 'font-weight:600',
            'box-shadow:0 2px 8px rgba(0,0,0,0.3)', 'cursor:pointer'
        ].join(';');
        indicator.addEventListener('click', function () {
            unlock();
            setTimeout(refreshIndicator, 200);
        });
        document.body.appendChild(indicator);
    }

    // Le contexte doit exister pour que son etat soit lisible. Le creer au chargement
    // est sans effet audible et permet de savoir tout de suite si l'on est muet.
    window.addEventListener('load', function () {
        getCtx();
        unlock();                       // parfois suffisant (Android, desktop)
        setTimeout(refreshIndicator, 400);
    });
    setInterval(refreshIndicator, 5000);

    return {
        // Diagnostic : SoundFX.audioState() en console dit si le moteur audio tourne
        // vraiment. 'suspended' = la tablette attend un geste, aucun son ne sortira.
        audioState,
        unlock,

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
        },

        // Two-tone attention alert — a team message just arrived. Plus affirmé
        // que taskAppear (montée B5 -> E6) mais toujours calme (sine). Joué en
        // rafale de 2-3 par l'ordonnanceur côté cuisine.
        messageAlert() {
            playTone(988, 0.16, 'sine', 0.19, 0);       // B5
            playTone(1319, 0.30, 'sine', 0.17, 0.14);   // E6 (ring-out)
        },

        // Gentle two-note bell — a new task just appeared in the due list.
        // Rising perfect fourth (G5 -> C6) with a soft sustain: audible over
        // kitchen noise but calm, not anxiogenic. Distinct from complete/filterOn.
        taskAppear() {
            playTone(784, 0.14, 'sine', 0.11, 0);       // G5
            playTone(1047, 0.34, 'sine', 0.10, 0.12);   // C6 (soft ring-out)
        },

        // Short rising blip — a filter/selection was engaged (confirms the action)
        filterOn() {
            playTone(660, 0.06, 'sine', 0.09, 0);
            playTone(880, 0.10, 'sine', 0.08, 0.055);
        },

        // Short falling blip — inverse of filterOn: a filter was released,
        // including the automatic 5s reset (so it's noticed even hands-off).
        filterOff() {
            playTone(660, 0.06, 'sine', 0.08, 0);
            playTone(440, 0.11, 'sine', 0.07, 0.055);
        }
    };
})();
