export function Timer() {
  const timerEl = document.createElement("div");
  timerEl.className = "timer";
  timerEl.innerText = "00:00";

  let seconds = 0;
  setInterval(() => {
    seconds++;
    timerEl.innerText = new Date(seconds * 1000)
      .toISOString()
      .substr(14, 5);
  }, 1000);

  return timerEl;
}
