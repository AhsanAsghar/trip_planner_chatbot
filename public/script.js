(() => {
  'use strict';

  const chatScroll = document.getElementById('chat-scroll');
  const emptyState = document.getElementById('empty-state');
  const composer = document.getElementById('composer');
  const input = document.getElementById('composer-input');
  const sendBtn = document.getElementById('send-btn');
  const resetBtn = document.getElementById('reset-btn');

  // Conversation turns sent to the backend. Assistant turns store `content`
  // as the JSON string the model produced, so the model's own prior
  // structured output round-trips back to it as history on the next call.
  let conversation = [];

  function scrollToBottom() {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function hideEmptyState() {
    if (emptyState) emptyState.style.display = 'none';
  }

  // ---------------------------------------------------------------------
  // Bubble rendering
  // ---------------------------------------------------------------------

  function addUserBubble(text) {
    const tpl = document.getElementById('user-bubble-template');
    const node = tpl.content.cloneNode(true);
    node.querySelector('.bubble-user').textContent = text;
    chatScroll.appendChild(node);
    scrollToBottom();
  }

  function addAssistantReplyBubble(text) {
    const tpl = document.getElementById('assistant-bubble-template');
    const node = tpl.content.cloneNode(true);
    node.querySelector('.bubble-assistant').textContent = text;
    chatScroll.appendChild(node);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const tpl = document.getElementById('typing-template');
    const node = tpl.content.cloneNode(true);
    chatScroll.appendChild(node);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function addErrorBubble(message, onRetry) {
    const tpl = document.getElementById('error-template');
    const node = tpl.content.cloneNode(true);
    node.querySelector('.error-text').textContent = message;
    const retryBtn = node.querySelector('.btn-retry');
    chatScroll.appendChild(node);
    scrollToBottom();

    const appendedTurn = chatScroll.lastElementChild;
    retryBtn.addEventListener('click', () => {
      appendedTurn.remove();
      onRetry();
    });
  }

  // ---------------------------------------------------------------------
  // Itinerary "boarding pass" card
  // ---------------------------------------------------------------------

  function buildItineraryText(itinerary) {
    const lines = [];
    const duration = itinerary.durationDays || (itinerary.days || []).length;
    lines.push(`${itinerary.destination || 'Trip'} — ${duration} days`);
    if (itinerary.travelStyle) lines.push(itinerary.travelStyle);
    lines.push('');

    (itinerary.days || []).forEach((day) => {
      lines.push(`Day ${day.day}: ${day.title || ''}`);
      (day.activities || []).forEach((activity) => {
        const notes = activity.notes ? ` — ${activity.notes}` : '';
        lines.push(`  ${activity.time || ''}: ${activity.activity || ''}${notes}`);
      });
      lines.push('');
    });

    if (itinerary.budgetNote) lines.push(itinerary.budgetNote);
    return lines.join('\n');
  }

  function buildItineraryCard(itinerary) {
    const turn = document.createElement('div');
    turn.className = 'turn turn-assistant';

    const card = document.createElement('div');
    card.className = 'itinerary-card';

    const duration = itinerary.durationDays || (itinerary.days || []).length;

    const header = document.createElement('div');
    header.className = 'itinerary-header';

    const headerText = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'itinerary-eyebrow';
    eyebrow.textContent = 'Trip Plan';
    const heading = document.createElement('h3');
    heading.textContent = itinerary.destination || 'Your trip';
    const meta = document.createElement('p');
    meta.className = 'itinerary-meta';
    meta.textContent = `${duration} days${itinerary.travelStyle ? ' · ' + itinerary.travelStyle : ''}`;
    headerText.appendChild(eyebrow);
    headerText.appendChild(heading);
    headerText.appendChild(meta);

    const badge = document.createElement('div');
    badge.className = 'itinerary-days-badge';
    badge.textContent = `${duration}D`;

    header.appendChild(headerText);
    header.appendChild(badge);
    card.appendChild(header);

    const daysWrap = document.createElement('div');
    daysWrap.className = 'itinerary-days';

    (itinerary.days || []).forEach((day) => {
      const ticket = document.createElement('div');
      ticket.className = 'day-ticket';

      const stub = document.createElement('div');
      stub.className = 'day-stub';
      const dayLabel = document.createElement('span');
      dayLabel.className = 'day-label';
      dayLabel.textContent = 'Day';
      const dayValue = document.createElement('span');
      dayValue.className = 'day-value';
      dayValue.textContent = day.day ?? '';
      stub.appendChild(dayLabel);
      stub.appendChild(dayValue);

      const body = document.createElement('div');
      body.className = 'day-body';
      const title = document.createElement('h4');
      title.textContent = day.title || '';
      body.appendChild(title);

      const list = document.createElement('ul');
      list.className = 'activity-list';

      (day.activities || []).forEach((activity) => {
        const li = document.createElement('li');

        const time = document.createElement('span');
        time.className = 'activity-time';
        time.textContent = activity.time || '';

        const activityBody = document.createElement('div');
        activityBody.className = 'activity-body';

        const name = document.createElement('span');
        name.className = 'activity-name';
        name.textContent = activity.activity || '';
        activityBody.appendChild(name);

        if (activity.notes) {
          const notes = document.createElement('p');
          notes.className = 'activity-notes';
          notes.textContent = activity.notes;
          activityBody.appendChild(notes);
        }

        li.appendChild(time);
        li.appendChild(activityBody);
        list.appendChild(li);
      });

      body.appendChild(list);
      ticket.appendChild(stub);
      ticket.appendChild(body);
      daysWrap.appendChild(ticket);
    });

    card.appendChild(daysWrap);

    if (itinerary.budgetNote) {
      const budget = document.createElement('p');
      budget.className = 'itinerary-budget';
      budget.textContent = itinerary.budgetNote;
      card.appendChild(budget);
    }

    const actions = document.createElement('div');
    actions.className = 'itinerary-actions';

    const itineraryText = buildItineraryText(itinerary);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-secondary';
    copyBtn.textContent = 'Copy itinerary';
    copyBtn.addEventListener('click', async () => {
      const original = copyBtn.textContent;
      try {
        await navigator.clipboard.writeText(itineraryText);
        copyBtn.textContent = 'Copied!';
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-secondary';
    downloadBtn.textContent = 'Download .txt';
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([itineraryText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = (itinerary.destination || 'trip')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      a.download = `${filename || 'trip'}-itinerary.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);
    card.appendChild(actions);

    turn.appendChild(card);
    return turn;
  }

  function addItineraryCard(itinerary) {
    chatScroll.appendChild(buildItineraryCard(itinerary));
    scrollToBottom();
  }

  // ---------------------------------------------------------------------
  // Sending messages
  // ---------------------------------------------------------------------

  async function sendMessages(payloadMessages) {
    sendBtn.disabled = true;
    addTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      const data = await response.json();
      removeTypingIndicator();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      conversation.push({ role: 'assistant', content: JSON.stringify(data) });

      if (data.reply) {
        addAssistantReplyBubble(data.reply);
      }
      if (data.type === 'itinerary' && data.itinerary) {
        addItineraryCard(data.itinerary);
      }
    } catch (error) {
      removeTypingIndicator();
      addErrorBubble(error.message, () => sendMessages(payloadMessages));
    } finally {
      sendBtn.disabled = false;
    }
  }

  function submitUserMessage(text) {
    hideEmptyState();
    addUserBubble(text);
    conversation.push({ role: 'user', content: text });

    const payload = conversation.map(({ role, content }) => ({ role, content }));
    sendMessages(payload);
  }

  // ---------------------------------------------------------------------
  // Composer wiring
  // ---------------------------------------------------------------------

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    submitUserMessage(text);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => submitUserMessage(chip.dataset.prompt));
  });

  resetBtn.addEventListener('click', () => {
    window.location.reload();
  });
})();
