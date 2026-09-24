/* A local, temporary elapsed-time counter. The chosen moment is never persisted. */
window.createTogetherCounter = function createTogetherCounter({ note, input, output }) {
  const doc = note.ownerDocument || document;
  const days = doc.createElement('span');
  const clock = doc.createElement('span');
  const status = doc.createElement('span');
  days.className = 'time-days';
  clock.className = 'time-clock';
  status.className = 'time-status';
  output.replaceChildren(days, clock, status);
  output.setAttribute('role', 'timer');
  // A screen reader should not announce a new number every second.
  output.setAttribute('aria-live', 'off');

  let opened = false;
  let destroyed = false;
  let timer = null;

  const pad = value => String(value).padStart(2, '0');
  const localValue = date => String(date.getFullYear()).padStart(4, '0') + '-' +
    pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' +
    pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());

  function parseMoment(value) {
    // datetime-local values contain no offset: interpret the user's own local time.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
    if (!match) return null;
    const date = new Date(value);
    const [, year, month, day, hour, minute, second = '0'] = match;
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(year) ||
        date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day) ||
        date.getHours() !== Number(hour) || date.getMinutes() !== Number(minute) ||
        date.getSeconds() !== Number(second)) return null;
    return date.getTime();
  }

  function stopTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function message(text) {
    days.hidden = true;
    clock.hidden = true;
    status.hidden = false;
    status.textContent = text;
  }

  function refresh() {
    stopTimer();
    if (destroyed || !opened || doc.hidden || note.hidden) return;
    const now = Date.now();
    const raw = input.value.trim();
    if (!raw) {
      message('Выберите вашу дату и время');
      return;
    }
    const start = parseMoment(raw);
    if (start === null) {
      message('Проверьте дату и время');
      return;
    }
    const elapsed = now - start;
    if (elapsed < 0) {
      message('Выберите момент, который уже наступил');
    } else {
      const total = Math.floor(elapsed / 1000);
      const fullDays = Math.floor(total / 86400);
      const hours = Math.floor(total / 3600) % 24;
      const minutes = Math.floor(total / 60) % 60;
      const seconds = total % 60;
      const tens = fullDays % 100;
      const units = fullDays % 10;
      const word = tens >= 11 && tens <= 14 ? 'дней' : units === 1 ? 'день' : units >= 2 && units <= 4 ? 'дня' : 'дней';
      days.textContent = fullDays.toLocaleString('ru-RU') + ' ' + word;
      clock.textContent = pad(hours) + ' ч ' + pad(minutes) + ' мин ' + pad(seconds) + ' сек';
      days.hidden = false;
      clock.hidden = false;
      status.hidden = true;
    }
    // Align with elapsed seconds so late callbacks do not accumulate clock drift.
    const remainder = ((elapsed % 1000) + 1000) % 1000;
    timer = setTimeout(refresh, 1000 - remainder);
  }

  function inputChanged() {
    if (opened) input.max = localValue(new Date());
    refresh();
  }

  input.addEventListener('input', inputChanged);
  input.addEventListener('change', inputChanged);
  doc.addEventListener('visibilitychange', refresh);

  return {
    open() {
      if (destroyed) return;
      opened = true;
      input.max = localValue(new Date());
      refresh();
    },
    close() {
      opened = false;
      stopTimer();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      opened = false;
      stopTimer();
      input.removeEventListener('input', inputChanged);
      input.removeEventListener('change', inputChanged);
      doc.removeEventListener('visibilitychange', refresh);
    }
  };
};
