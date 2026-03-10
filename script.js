const SHIFT_HOURS = 9;
const BREAK_TOTAL_MS = (1 * 60 + 30) * 60 * 1000;
const STORAGE_KEY = "spin-time-tracker-state-v2";

function formatTime12(hour24, minute) {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDuration(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getRows() {
  return Array.from(document.querySelectorAll(".row:not(.row-head)"));
}

function parseTimeToDate(timeValue, baseDate = new Date()) {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getShiftTimes(timeInValue) {
  const timeIn = parseTimeToDate(timeInValue);
  if (!timeIn) return null;

  const timeout = new Date(timeIn.getTime() + SHIFT_HOURS * 60 * 60 * 1000);
  return { timeIn, timeout };
}

function getRowState(row) {
  const raw = row.dataset.state;
  if (!raw) return { breakUsedMs: 0, lunchStartedAt: null };

  try {
    const parsed = JSON.parse(raw);
    return {
      breakUsedMs: Number(parsed.breakUsedMs) || 0,
      lunchStartedAt: parsed.lunchStartedAt ? Number(parsed.lunchStartedAt) : null,
    };
  } catch {
    return { breakUsedMs: 0, lunchStartedAt: null };
  }
}

function setRowState(row, state) {
  row.dataset.state = JSON.stringify(state);
}

function getBreakUsedMs(row, nowMs = Date.now()) {
  const { breakUsedMs, lunchStartedAt } = getRowState(row);
  const runningMs = lunchStartedAt ? Math.max(0, nowMs - lunchStartedAt) : 0;
  return Math.min(BREAK_TOTAL_MS, breakUsedMs + runningMs);
}

function syncLunchUi(row) {
  const lunchButton = row.querySelector("[data-lunch-btn]");
  const active = Boolean(getRowState(row).lunchStartedAt);
  row.classList.toggle("lunch-active", active);
  if (lunchButton) {
    lunchButton.textContent = active ? "Back from Lunch" : "Out for Lunch";
    lunchButton.setAttribute("aria-pressed", String(active));
  }
}

function setLunchState(row, isActive) {
  const nowMs = Date.now();
  const state = getRowState(row);

  if (isActive) {
    if (getBreakUsedMs(row, nowMs) >= BREAK_TOTAL_MS) return;
    state.lunchStartedAt = nowMs;
  } else if (state.lunchStartedAt) {
    state.breakUsedMs = Math.min(
      BREAK_TOTAL_MS,
      state.breakUsedMs + Math.max(0, nowMs - state.lunchStartedAt)
    );
    state.lunchStartedAt = null;
  }

  setRowState(row, state);
  syncLunchUi(row);
}

function updateShiftDisplays(row, now = new Date()) {
  const timeInInput = row.querySelector("[data-time-in]");
  const timeoutOutput = row.querySelector("[data-time-out]");
  const timeLeftOutput = row.querySelector("[data-time-left]");

  if (!timeInInput || !timeoutOutput || !timeLeftOutput) return;

  const shiftTimes = getShiftTimes(timeInInput.value);
  if (!shiftTimes) {
    timeoutOutput.textContent = "--";
    timeLeftOutput.textContent = "--:--:--";
    return;
  }

  timeoutOutput.textContent = formatTime12(
    shiftTimes.timeout.getHours(),
    shiftTimes.timeout.getMinutes()
  );

  const nowMs = now.getTime();
  const timeInMs = shiftTimes.timeIn.getTime();
  const timeoutMs = shiftTimes.timeout.getTime();

  if (nowMs < timeInMs) {
    timeLeftOutput.textContent = `Starts in ${formatDuration(timeInMs - nowMs)}`;
    return;
  }

  if (nowMs >= timeoutMs) {
    timeLeftOutput.textContent = "Completed";
    return;
  }

  timeLeftOutput.textContent = formatDuration(timeoutMs - nowMs);
}

function updateBreakDisplay(row, nowMs = Date.now()) {
  const breakLeftOutput = row.querySelector("[data-break-left]");
  if (!breakLeftOutput) return;

  const usedMs = getBreakUsedMs(row, nowMs);
  const leftMs = Math.max(0, BREAK_TOTAL_MS - usedMs);
  breakLeftOutput.textContent = formatDuration(leftMs);

  if (leftMs === 0 && row.classList.contains("lunch-active")) {
    setLunchState(row, false);
    saveState();
  }
}

function updateAllDisplays() {
  const now = new Date();
  const nowMs = now.getTime();
  getRows().forEach((row) => {
    updateShiftDisplays(row, now);
    updateBreakDisplay(row, nowMs);
  });
}

function saveState() {
  try {
    const state = getRows().map((row) => {
      const rowState = getRowState(row);
      return {
        name: row.querySelector("[data-name]")?.value ?? "",
        timeIn: row.querySelector("[data-time-in]")?.value ?? "",
        breakUsedMs: Number(rowState.breakUsedMs) || 0,
        lunchStartedAt: rowState.lunchStartedAt,
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Skip cache writes if localStorage is unavailable.
  }
}

function loadState() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    const state = JSON.parse(cached);
    if (!Array.isArray(state)) return;

    getRows().forEach((row, index) => {
      const item = state[index];
      if (!item || typeof item !== "object") return;

      const nameInput = row.querySelector("[data-name]");
      const timeInInput = row.querySelector("[data-time-in]");

      if (nameInput && typeof item.name === "string") nameInput.value = item.name;
      if (timeInInput && typeof item.timeIn === "string") {
        timeInInput.value = item.timeIn;
      }

      setRowState(row, {
        breakUsedMs: Number(item.breakUsedMs) || 0,
        lunchStartedAt: item.lunchStartedAt ? Number(item.lunchStartedAt) : null,
      });

      syncLunchUi(row);
    });
  } catch {
    // Skip cache restore if parsing/storage access fails.
  }
}

async function toggleFullscreen(button) {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    button.textContent = "Exit Full Screen";
    return;
  }

  await document.exitFullscreen();
  button.textContent = "Full Screen";
}

getRows().forEach((row) => {
  setRowState(row, { breakUsedMs: 0, lunchStartedAt: null });
});

loadState();

getRows().forEach((row) => {
  updateShiftDisplays(row);
  updateBreakDisplay(row);

  row.querySelector("[data-time-in]")?.addEventListener("input", () => {
    updateShiftDisplays(row);
    saveState();
  });

  row.querySelector("[data-name]")?.addEventListener("input", () => {
    saveState();
  });

  row.querySelector("[data-lunch-btn]")?.addEventListener("click", () => {
    const nextState = !row.classList.contains("lunch-active");
    setLunchState(row, nextState);
    updateBreakDisplay(row);
    saveState();
  });
});

updateAllDisplays();
setInterval(() => {
  updateAllDisplays();
}, 1000);

const fullscreenButton = document.querySelector("[data-fullscreen-btn]");

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", async () => {
    try {
      await toggleFullscreen(fullscreenButton);
    } catch {
      fullscreenButton.textContent = "Fullscreen not supported";
      fullscreenButton.disabled = true;
    }
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement
      ? "Exit Full Screen"
      : "Full Screen";
  });
}
