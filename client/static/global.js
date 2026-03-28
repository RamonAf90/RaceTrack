// fullscreen

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Error entering fullscreen mode: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.createElement("button");
  btn.textContent = "⛶ Fullscreen";
  btn.id = "fullscreenBtn";
  btn.style.position = "fixed";
  btn.style.top = "10px";
  btn.style.right = "10px";
  btn.style.zIndex = "9999";
  btn.style.padding = "8px 12px";
  btn.style.background = "#111";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.opacity = "0.8";
  btn.style.transition = "opacity 0.3s";

  btn.onmouseenter = () => (btn.style.opacity = "1");
  btn.onmouseleave = () => (btn.style.opacity = "0.8");

  btn.onclick = toggleFullscreen;

  document.body.appendChild(btn);
});
