const SHIFT_HOURS = 9;
const STORAGE_KEY = "spin-time-tracker-state-v1";

function formatTime12(hour24, minute) {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getTimeoutValue(timeInValue) {
  if (!timeInValue) return "--";

  const [hours, minutes] = timeInValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "--";

  const totalMinutes = hours * 60 + minutes + SHIFT_HOURS * 60;
  const adjusted = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const outHour = Math.floor(adjusted / 60);
  const outMinute = adjusted % 60;

  return formatTime12(outHour, outMinute);
}

function updateTimeout(row) {
  const timeInInput = row.querySelector("[data-time-in]");
  const timeoutOutput = row.querySelector("[data-time-out]");

  if (!timeInInput || !timeoutOutput) return;
  timeoutOutput.textContent = getTimeoutValue(timeInInput.value);
}

function setLunchState(row, isActive) {
  const lunchButton = row.querySelector("[data-lunch-btn]");
  row.classList.toggle("lunch-active", isActive);
  if (lunchButton) {
    lunchButton.textContent = isActive ? "Back from Lunch" : "Out for Lunch";
    lunchButton.setAttribute("aria-pressed", String(isActive));
  }
}

function getRows() {
  return Array.from(document.querySelectorAll(".row:not(.row-head)"));
}

function saveState() {
  try {
    const rows = getRows();
    const state = rows.map((row) => ({
      name: row.querySelector("[data-name]")?.value ?? "",
      timeIn: row.querySelector("[data-time-in]")?.value ?? "",
      lunchActive: row.classList.contains("lunch-active"),
    }));
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

    const rows = getRows();
    rows.forEach((row, index) => {
      const item = state[index];
      if (!item || typeof item !== "object") return;

      const nameInput = row.querySelector("[data-name]");
      const timeInInput = row.querySelector("[data-time-in]");

      if (nameInput && typeof item.name === "string") nameInput.value = item.name;
      if (timeInInput && typeof item.timeIn === "string")
        timeInInput.value = item.timeIn;
      setLunchState(row, Boolean(item.lunchActive));
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

loadState();

getRows().forEach((row) => {
  updateTimeout(row);

  row.querySelector("[data-time-in]")?.addEventListener("input", () => {
    updateTimeout(row);
    saveState();
  });

  row.querySelector("[data-name]")?.addEventListener("input", () => {
    saveState();
  });

  row.querySelector("[data-lunch-btn]")?.addEventListener("click", () => {
    setLunchState(row, !row.classList.contains("lunch-active"));
    saveState();
  });
});

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
