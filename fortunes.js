// Fortune-cookie phrases shown after a task is marked Done (Serge, 31/10/2026).
// Tones kept by Serge: mystic, kitchen winks, and compliments told like an oracle.
// Rules: always positive; no predictions (love, money, health, "soon"); a compliment
// affirms directly, never against a hidden lack ("more than you think", "finally").
// {name} is replaced by the first name of the person who did the task.
(function (global) {
  'use strict';

  var COMMON = [
    // Mystic
    'The stars noticed what you just did.',
    'The universe keeps a list. You just moved up.',
    'Clean hands, clear mind, bright path.',
    'Your aura is 12 % shinier than an hour ago.',
    'The moon approves of this task.',
    'Somewhere, a candle lit itself in your honour.',
    'The tea leaves spell your name today, {name}.',
    'An old spirit of the kitchen just nodded at you.',
    'The cards were shuffled. You drew the sun.',
    'The wind changed direction when you pressed Done.',
    'A quiet magic follows careful hands.',
    'The crystal ball shows a clean kitchen. That was you.',
    'The ancient scroll says: well done, {name}.',
    'Seven owls agree: excellent work.',
    'Your star is shining tonight, right above the fryer.',
    'The oracle has spoken: you are on a roll.',
    'Fortune favours the ones who finish.',
    'The spirits of order thank you.',
    'A good deed done in silence echoes twice.',
    'The runes say: steady hands, strong heart.',
    'The planets aligned for exactly three seconds. You used them well.',
    'In the book of small victories, a new page is written.',
    'The kitchen gods smile upon you.',
    'Somewhere, a cat purrs in approval.',
    'Tarot card of the day: The Champion.',
    'Your path is clear, like a freshly wiped counter.',
    'The mist lifts. What remains is good work.',
    'A lucky star just landed on your apron.',
    'The old wisdom says: what is done well is done twice.',
    'Mysterious forces have recorded this moment.',
    // Kitchen winks
    'Like a good hummus, your work is smooth and well balanced.',
    'A great harvest comes to those who wash the fridge.',
    'Golden, like a perfect falafel. That is your vibe today.',
    'Even the oven is grateful today.',
    'The garlic sauce bows to you, {name}.',
    'Somewhere, a chickpea is cheering for you.',
    'The tahini flows in your favour.',
    'Your energy is pure zaatar: earthy, bright, unforgettable.',
    'A clean station is a happy station. Yours is glowing.',
    'The pickles whisper your name with respect.',
    'You are the sumac on today\'s salad.',
    'The man\'ouche of destiny is baked to perfection.',
    'The fridge feels lighter, and so does the soul.',
    'Good things are like dough: they rise for those who care.',
    'You and olive oil: both make everything better.',
    'The parsley in the tabbouleh salutes you.',
    'A shining counter is a promise kept.',
    'The spice jars have voted. You win, {name}.',
    'Your work has the crunch of a fresh falafel.',
    'Today\'s special: you.',
    'The kitchen hums a little happier now.',
    'Sesame opens doors. So do you.',
    'A task well done is like warm bread: everyone feels it.',
    'The lemon of fate squeezes only good luck on you.',
    'The grill sends its warmest regards.',
    'Fresh as mint, solid as a cast-iron pan.',
    'Every great meal starts with a moment like this one.',
    'The fryer would like to thank you personally.',
    'The dishwasher wrote you a poem. It goes: whoosh.',
    'Your shift is seasoned to perfection.',
    'The pita puffs up in your honour.',
    'The cedar of Lebanon stands a little taller for you.',
    'Like rose water: subtle, and everyone notices.',
    // Compliments told like an oracle
    'The kitchen runs smoother when you are in it. The cards say so.',
    'Your calm makes the whole room calmer. The stars confirm it.',
    'Things go right where you pass. The oracle has noted it.',
    'You leave every place a little better. The cards agree.',
    'Your care shows in the details. The spirits see it.',
    'The team is lucky to have you. The leaves are clear about it.',
    'Good work looks like this. The ancient scroll says so.',
    'Your hands bring order. The runes approve.',
    'You make hard things look easy. The crystal ball confirms.',
    'Your good mood is contagious. The moon says so.',
    'You are the kind of person every shift needs. The cards say so.',
    'Steady, kind, reliable: the oracle chose these words for you, {name}.',
    'Where you work, things shine. The spirits have seen it.',
    'You bring good luck to this kitchen. The tea leaves agree.',
    'Your eye for detail is a quiet superpower.',
    'The oracle has one word for you today: solid.',
    'Your energy lifts the whole team. The planets confirm.',
    'Precision and heart: the cards drew both for you.',
    'The room got brighter. The oracle suspects you.',
    'You turn small tasks into good days. The scroll says so.',
    'Your work speaks for you. The stars are listening.',
    'The kitchen chose well when it chose you.',
    'Clean work, kind heart. The runes have spoken.',
    'You are part of what makes this place good. The cards insist.'
  ];

  // One time in twenty, on a golden bubble.
  var RARE = [
    'The golden falafel has chosen you. This happens once in many tasks.',
    'A shooting star crossed the kitchen. Make a wish, {name}.',
    'The oracle rarely speaks twice. Today it says: you shine.',
    'Legendary task completed. The cedar remembers.',
    'The kitchen gods grant you a golden aura for the rest of the day.'
  ];
  var RARE_CHANCE = 1 / 20;

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'friend';
  }

  function any(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Plain random draw: a repeat now and then is fine (Serge: it's a gimmick).
  function draw(name) {
    var rare = Math.random() < RARE_CHANCE;
    var text = any(rare ? RARE : COMMON);
    return { text: text.replace(/\{name\}/g, firstName(name)), rare: rare };
  }

  // Bubble dropping from the top (same motion as the user-switch toast), long
  // enough to read; a tap closes it early.
  function show(name, taskTitle) {
    var f = draw(name);
    var old = document.querySelector('.fortune-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'fortune-toast' + (f.rare ? ' fortune-toast--rare' : '');
    var head = document.createElement('div');
    head.className = 'fortune-toast__head';
    head.textContent = (f.rare ? '✨ ' : '🥠 ') + firstName(name) + ' · ' + taskTitle;
    var body = document.createElement('div');
    body.className = 'fortune-toast__text';
    body.textContent = f.text;
    el.appendChild(head);
    el.appendChild(body);
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    var close = function () {
      el.classList.add('hide');
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
    };
    el.addEventListener('click', close);
    setTimeout(close, 8000);
    return f;
  }

  global.Fortunes = { show: show, draw: draw, COMMON: COMMON, RARE: RARE };
})(window);
