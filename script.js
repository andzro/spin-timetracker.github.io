const SHIFT_HOURS = 9;

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

document.querySelectorAll(".row:not(.row-head)").forEach((row) => {
  updateTimeout(row);

  row.querySelector("[data-time-in]")?.addEventListener("input", () => {
    updateTimeout(row);
  });
});
