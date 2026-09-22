const form = document.querySelector("#meme-form");
const formerFriendInput = document.querySelector("#former-friend");
const newFriendInput = document.querySelector("#new-friend");
const canvas = document.querySelector("#meme");
const context = canvas.getContext("2d");
const copyLinkButton = document.querySelector("#copy-link");
const downloadLink = document.querySelector("#download");
const status = document.querySelector("#status");
const template = new Image();

const params = new URLSearchParams(window.location.search);
formerFriendInput.value =
  params.get("x")?.trim() || params.get("X")?.trim() || "Mudasir";
newFriendInput.value =
  params.get("y")?.trim() || params.get("Y")?.trim() || "Salman";

function fitFontSize(text, maxWidth, initialSize) {
  let size = initialSize;

  while (size > 18) {
    context.font = `900 ${size}px Arial Black, Impact, sans-serif`;
    if (context.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 1;
  }

  return size;
}

function drawRainbowText(text, x, y, maxWidth, initialSize) {
  const fontSize = fitFontSize(text, maxWidth, initialSize);
  const gradient = context.createLinearGradient(x, y - fontSize, x, y + 4);

  gradient.addColorStop(0, "#ff3434");
  gradient.addColorStop(0.34, "#ffeb00");
  gradient.addColorStop(0.68, "#12e72b");
  gradient.addColorStop(1, "#0879ff");

  context.font = `900 ${fontSize}px Arial Black, Impact, sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, fontSize * 0.08);
  context.strokeStyle = "#202020";
  context.fillStyle = gradient;
  context.strokeText(text, x, y, maxWidth);
  context.fillText(text, x, y, maxWidth);
}

function renderMeme() {
  const formerFriend = formerFriendInput.value.trim() || "Mudasir";
  const newFriend = newFriendInput.value.trim() || "Salman";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(template, 0, 0, canvas.width, canvas.height);

  drawRainbowText(formerFriend, 330, 58, 165, 34);
  drawRainbowText(newFriend, 5, 185, 185, 38);

  downloadLink.href = canvas.toDataURL("image/png");
  const filename = `friendship-ended-with-${formerFriend}-now-${newFriend}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  downloadLink.download = `${filename || "friendship-ended"}.png`;
}

function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("x", formerFriendInput.value.trim() || "Mudasir");
  url.searchParams.set("y", newFriendInput.value.trim() || "Salman");
  window.history.replaceState({}, "", url);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateUrl();
  renderMeme();
  status.textContent = "Meme generated and URL updated.";
});

formerFriendInput.addEventListener("input", renderMeme);
newFriendInput.addEventListener("input", renderMeme);

copyLinkButton.addEventListener("click", async () => {
  updateUrl();

  try {
    await navigator.clipboard.writeText(window.location.href);
    status.textContent = "Shareable link copied.";
  } catch {
    status.textContent = "Copy failed. Copy the URL from your address bar.";
  }
});

template.addEventListener("load", renderMeme);
template.src = "template.png";
