// This file controls both the main page and the screen selection window.
var app = window.snipscript;
var selectionWindow = location.search.indexOf('mode=select') !== -1;

if (selectionWindow) {
  setupScreenSelection();
} else {
  setupDashboard();
}

function setupScreenSelection() {
  document.body.classList.add('selecting-screen');

  var image = document.querySelector('#screen-image');
  var box = document.querySelector('#selection-box');
  var startX = 0;
  var startY = 0;
  var isDragging = false;

  app.onScreenPicture(function (picture) {
    image.src = picture;
    image.onload = function () {
      image.style.display = 'block';
    };
  });

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') app.cancelSelection();
  });

  window.addEventListener('mousedown', function (event) {
    if (event.button !== 0) return;

    startX = event.clientX;
    startY = event.clientY;
    isDragging = true;
    box.style.display = 'block';
  });

  window.addEventListener('mousemove', function (event) {
    if (!isDragging) return;

    var left = Math.min(startX, event.clientX);
    var top = Math.min(startY, event.clientY);
    var width = Math.abs(event.clientX - startX);
    var height = Math.abs(event.clientY - startY);

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
  });

  window.addEventListener('mouseup', function (event) {
    if (!isDragging) return;
    isDragging = false;

    var width = Math.abs(event.clientX - startX);
    var height = Math.abs(event.clientY - startY);
    if (width < 5 || height < 5) {
      app.cancelSelection();
      return;
    }

    cropAndReadText(event, width, height);
  });

  function cropAndReadText(event, width, height) {
    var scaleX = image.naturalWidth / window.innerWidth;
    var scaleY = image.naturalHeight / window.innerHeight;
    var x = Math.min(startX, event.clientX);
    var y = Math.min(startY, event.clientY);
    var canvas = document.createElement('canvas');

    canvas.width = Math.round(width * scaleX);
    canvas.height = Math.round(height * scaleY);

    var context = canvas.getContext('2d');
    context.drawImage(
      image,
      Math.round(x * scaleX),
      Math.round(y * scaleY),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    document.body.classList.add('reading-text');
    app.finishSelection(canvas.toDataURL('image/png')).catch(function () {
      app.cancelSelection();
    });
  }
}

function setupDashboard() {
  var history = [];
  var lastResult = null;

  function showMessage(text) {
    var message = document.querySelector('#message');
    message.textContent = text;
    message.classList.add('visible');
    setTimeout(function () {
      message.classList.remove('visible');
    }, 2500);
  }

  function openResult(result, copied) {
    lastResult = result;
    document.querySelector('#result-text').value = result.text;

    if (copied) {
      document.querySelector('#result-message').textContent = 'Text copied to your clipboard.';
    } else {
      document.querySelector('#result-message').textContent = new Date(result.date).toLocaleString();
    }

    document.querySelector('#result-modal').classList.add('visible');
  }

  function makeHistoryRow(item) {
    var row = document.createElement('article');
    var textButton = document.createElement('button');
    var title = document.createElement('strong');
    var date = document.createElement('small');
    var deleteButton = document.createElement('button');

    row.className = 'history-row';
    textButton.className = 'history-text';
    title.textContent = item.text.split('\n')[0] || 'No text found';
    title.textContent = title.textContent.substring(0, 70);
    date.textContent = new Date(item.date).toLocaleString();
    textButton.appendChild(title);
    textButton.appendChild(date);
    textButton.addEventListener('click', function () {
      openResult(item, false);
    });

    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async function () {
      await app.deleteHistoryItem(item.id);
      await loadHistory();
      showMessage('History item deleted.');
    });

    row.appendChild(textButton);
    row.appendChild(deleteButton);
    return row;
  }

  function showHistory(listId, items, limit) {
    var list = document.querySelector(listId);
    var itemCount = items.length;
    list.innerHTML = '';

    if (limit && itemCount > limit) itemCount = limit;
    if (itemCount === 0) {
      var emptyMessage = document.createElement('p');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No saved results yet. Start snipping to add one.';
      list.appendChild(emptyMessage);
      return;
    }

    for (var i = 0; i < itemCount; i += 1) {
      list.appendChild(makeHistoryRow(items[i]));
    }
  }

  async function loadHistory() {
    history = await app.getHistory();
    document.querySelector('#result-count').textContent = history.length;
    showHistory('#recent-history', history, 4);
    showHistory('#all-history', history, 0);
  }

  function showPage(pageName) {
    var pages = document.querySelectorAll('.page');
    var buttons = document.querySelectorAll('[data-page]');
    var i;

    for (i = 0; i < pages.length; i += 1) {
      pages[i].classList.remove('active');
    }
    document.querySelector('#' + pageName + '-page').classList.add('active');

    for (i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute('data-page') === pageName) {
        buttons[i].classList.add('active');
      } else {
        buttons[i].classList.remove('active');
      }
    }
  }

  var pageButtons = document.querySelectorAll('[data-page]');
  for (var i = 0; i < pageButtons.length; i += 1) {
    pageButtons[i].addEventListener('click', function (event) {
      showPage(event.currentTarget.getAttribute('data-page'));
    });
  }

  document.querySelector('#start-button').addEventListener('click', function () {
    app.startSelection();
  });
  document.querySelector('#clear-history').addEventListener('click', async function () {
    await app.clearHistory();
    await loadHistory();
    showMessage('History cleared.');
  });
  document.querySelector('#save-shortcut').addEventListener('click', async function () {
    var shortcut = document.querySelector('#shortcut-input').value.trim();
    try {
      await app.saveShortcut(shortcut);
      showMessage('Shortcut saved.');
      showShortcut(shortcut);
    } catch (error) {
      showMessage(error.message);
    }
  });

  document.querySelector('#close-result').addEventListener('click', function () {
    document.querySelector('#result-modal').classList.remove('visible');
  });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      document.querySelector('#result-modal').classList.remove('visible');
    }
  });
  document.querySelector('#copy-text').addEventListener('click', async function () {
    var text = document.querySelector('#result-text').value;
    await app.copyText(text);
    showMessage('Text copied.');
  });
  document.querySelector('#select-all').addEventListener('click', function () {
    document.querySelector('#result-text').select();
  });
  document.querySelector('#clear-text').addEventListener('click', function () {
    document.querySelector('#result-text').value = '';
  });
  document.querySelector('#save-text').addEventListener('click', async function () {
    var text = document.querySelector('#result-text').value;
    var saved = await app.saveTextFile(text);
    if (saved) showMessage('Text file saved.');
  });
  document.querySelector('#retry-ocr').addEventListener('click', async function () {
    if (!lastResult) return;
    try {
      await app.retryOcr();
    } catch (error) {
      showMessage(error.message);
    }
  });

  app.onTextReady(function (result) {
    loadHistory();
    if (result.text) {
      openResult(result, true);
    } else {
      openResult(result, false);
      document.querySelector('#result-message').textContent = 'No text found. Try selecting a larger area.';
    }
  });
  app.onError(showMessage);

  async function startApp() {
    var shortcut = await app.getShortcut();
    document.querySelector('#shortcut-input').value = shortcut;
    showShortcut(shortcut);
    await loadHistory();
  }

  function showShortcut(shortcut) {
    var modifier = /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
    var label = shortcut.replace('CommandOrControl', modifier);
    label = label.split('+').join(' + ');
    document.querySelector('#shortcut-label').textContent = label;
  }

  startApp().catch(function (error) {
    showMessage(error.message);
  });
}
