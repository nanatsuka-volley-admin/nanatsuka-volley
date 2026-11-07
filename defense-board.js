(() => {
  'use strict';

  const dialog = document.getElementById('defense-board');
  const court = dialog.querySelector('.defense-court');
  const baseline = [[20, 19], [50, 19], [80, 19], [20, 74], [50, 74], [80, 74]];
  const arrowMoves = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] };
  let drag = null;

  function place(token, x, y) {
    const horizontalMargin = Math.min(50, token.offsetWidth / court.clientWidth * 50);
    const verticalMargin = Math.min(50, token.offsetHeight / court.clientHeight * 50);
    token.style.left = Math.max(horizontalMargin, Math.min(100 - horizontalMargin, x)) + '%';
    token.style.top = Math.max(verticalMargin, Math.min(100 - verticalMargin, y)) + '%';
  }

  function loadLineup(currentMatch) {
    drag = null;
    court.replaceChildren();
    const lineup = currentMatch?.lineup ?? [];
    let count = 0;
    baseline.forEach(([x, y], index) => {
      const id = lineup[index];
      if (id == null || id === '') return;
      const name = player(id)?.name || '登録解除選手';
      const token = document.createElement('button');
      token.type = 'button';
      token.className = 'defense-token';
      token.dataset.row = index < 3 ? 'front' : 'back';
      token.setAttribute('aria-label', courtCodes[index] + ' ' + name);
      const position = document.createElement('small');
      position.textContent = courtCodes[index];
      const label = document.createElement('span');
      label.textContent = name;
      token.append(position, label);
      court.append(token);
      place(token, x, y);
      count++;
    });
    dialog.querySelector('.defense-status').textContent = count === 6
      ? 'コマを指で動かせます。キーボードでは選手を選んで矢印キーで移動できます。'
      : count + '人を表示中。簡易記録でポジションを設定すると表示されます。';
  }

  dialog.querySelector('[data-defense-reset]').addEventListener('click', () => loadLineup(match()));
  dialog.addEventListener('close', () => { drag = null; });

  court.addEventListener('pointerdown', event => {
    const token = event.target.closest('.defense-token');
    if (!token || drag || event.button !== 0) return;
    const bounds = token.getBoundingClientRect();
    drag = {
      token,
      pointerId: event.pointerId,
      offsetX: event.clientX - (bounds.left + bounds.width / 2),
      offsetY: event.clientY - (bounds.top + bounds.height / 2)
    };
    token.setPointerCapture(event.pointerId);
  });

  court.addEventListener('pointermove', event => {
    if (drag?.pointerId !== event.pointerId) return;
    const bounds = court.getBoundingClientRect();
    place(drag.token,
      (event.clientX - drag.offsetX - bounds.left) / bounds.width * 100,
      (event.clientY - drag.offsetY - bounds.top) / bounds.height * 100);
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    court.addEventListener(type, event => {
      if (drag?.pointerId === event.pointerId) drag = null;
    });
  }

  court.addEventListener('keydown', event => {
    const token = event.target.closest('.defense-token');
    const move = arrowMoves[event.key];
    if (!token || !Array.isArray(move)) return;
    event.preventDefault();
    place(token, parseFloat(token.style.left) + move[0], parseFloat(token.style.top) + move[1]);
  });

  window.openDefenseBoard = () => {
    const currentMatch = match();
    if (!currentMatch || dialog.open) return;
    dialog.querySelector('.defense-match').textContent = currentMatch.team + ' vs ' + currentMatch.opponent;
    dialog.showModal();
    loadLineup(currentMatch);
  };
})();
