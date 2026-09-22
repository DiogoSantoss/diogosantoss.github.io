const form = document.querySelector("#meme-form");
const formerFriendInput = document.querySelector("#former-friend");
const newFriendInput = document.querySelector("#new-friend");
const canvas = document.querySelector("#meme");
const context = canvas.getContext("2d");
const copyLinkButton = document.querySelector("#copy-link");
const downloadLink = document.querySelector("#download");
const status = document.querySelector("#status");
const template = new Image();
const generateButton = form.querySelector('button[type="submit"]');
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const aiEndpoint = isLocal
  ? "http://127.0.0.1:8787"
  : "https://friendship-ended-ai.dsantos-individual-account.workers.dev";
const portraits = { former: null, new: null };
let generation = 0;

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

function hashName(name) {
  return [...name].reduce(
    (hash, character) => (hash * 31 + character.codePointAt(0)) >>> 0,
    2166136261,
  );
}

function drawGeneratedPortrait(name, x, y, width, height, mirrored) {
  const hash = hashName(name);
  const hue = hash % 360;
  const accentHue = (hue + 135) % 360;
  const centerX = x + width / 2;
  const headTop = y + height * 0.2;
  const headWidth = width * 0.68;
  const headHeight = height * 0.52;
  const initial = name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() || "?";
  const direction = mirrored ? -1 : 1;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  const background = context.createLinearGradient(x, y, x + width, y + height);
  background.addColorStop(0, `hsl(${hue} 78% 35%)`);
  background.addColorStop(1, `hsl(${accentHue} 82% 62%)`);
  context.fillStyle = background;
  context.fillRect(x, y, width, height);

  context.globalAlpha = 0.22;
  context.fillStyle = "#fff";
  for (let index = 0; index < 5; index += 1) {
    const radius = width * (0.12 + ((hash >> index) & 3) * 0.025);
    const circleX = x + ((hash >> (index + 3)) % width);
    const circleY = y + ((hash >> (index + 8)) % height);
    context.beginPath();
    context.arc(circleX, circleY, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "#17202a";
  context.lineWidth = Math.max(3, width * 0.035);
  context.beginPath();
  context.moveTo(centerX, headTop);
  context.lineTo(centerX + direction * width * 0.12, headTop - height * 0.1);
  context.stroke();
  context.fillStyle = "#ffdf57";
  context.beginPath();
  context.arc(
    centerX + direction * width * 0.12,
    headTop - height * 0.1,
    width * 0.045,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = "#d9e7ec";
  context.strokeStyle = "#17202a";
  context.fillRect(
    centerX - headWidth / 2,
    headTop,
    headWidth,
    headHeight,
  );
  context.strokeRect(
    centerX - headWidth / 2,
    headTop,
    headWidth,
    headHeight,
  );

  context.fillStyle = "#17202a";
  const eyeY = headTop + headHeight * 0.36;
  const eyeOffset = headWidth * 0.23;
  context.beginPath();
  context.arc(centerX - eyeOffset, eyeY, width * 0.055, 0, Math.PI * 2);
  context.arc(centerX + eyeOffset, eyeY, width * 0.055, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `hsl(${hue} 75% 32%)`;
  context.lineWidth = Math.max(3, width * 0.04);
  context.beginPath();
  context.moveTo(centerX - headWidth * 0.22, headTop + headHeight * 0.7);
  context.lineTo(centerX + headWidth * 0.22, headTop + headHeight * 0.7);
  context.stroke();

  context.fillStyle = "rgba(23, 32, 42, 0.82)";
  context.fillRect(x, y + height * 0.78, width, height * 0.22);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.max(18, width * 0.25)}px Arial Black, sans-serif`;
  context.fillText(initial, centerX, y + height * 0.89);
  context.restore();
}

function drawCross(x, y, width, height) {
  context.save();
  context.lineCap = "round";
  context.strokeStyle = "rgba(32, 0, 0, 0.7)";
  context.lineWidth = 12;
  context.beginPath();
  context.moveTo(x + 10, y + 10);
  context.lineTo(x + width - 10, y + height - 10);
  context.moveTo(x + width - 10, y + 10);
  context.lineTo(x + 10, y + height - 10);
  context.stroke();
  context.strokeStyle = "#e30016";
  context.lineWidth = 7;
  context.stroke();
  context.restore();
}

function drawPortraitImage(image, x, y, width, height) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const sourceSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = (sourceWidth - sourceSize) / 2;
  const sourceY = (sourceHeight - sourceSize) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    x,
    y,
    width,
    height,
  );
}

function drawFriendCutouts(formerFriend, newFriend) {
  const cutouts = [
    {
      name: formerFriend,
      image: portraits.former,
      x: 0,
      y: 207,
      width: 106,
      height: 163,
      mirrored: false,
      crossedOut: true,
    },
    {
      name: newFriend,
      image: portraits.new,
      x: 361,
      y: 225,
      width: 139,
      height: 145,
      mirrored: true,
      crossedOut: false,
    },
  ];

  cutouts.forEach((cutout) => {
    if (cutout.image) {
      drawPortraitImage(
        cutout.image,
        cutout.x,
        cutout.y,
        cutout.width,
        cutout.height,
      );
    } else {
      drawGeneratedPortrait(
        cutout.name,
        cutout.x,
        cutout.y,
        cutout.width,
        cutout.height,
        cutout.mirrored,
      );
    }
    if (cutout.crossedOut) {
      drawCross(cutout.x, cutout.y, cutout.width, cutout.height);
    }
  });
}

function renderMeme() {
  const formerFriend = formerFriendInput.value.trim() || "Mudasir";
  const newFriend = newFriendInput.value.trim() || "Salman";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(template, 0, 0, canvas.width, canvas.height);
  drawFriendCutouts(formerFriend, newFriend);

  drawRainbowText(formerFriend, 330, 58, 165, 34);
  drawRainbowText(newFriend, 5, 185, 185, 38);

  downloadLink.href = canvas.toDataURL("image/png");
  const filename = `friendship-ended-with-${formerFriend}-now-${newFriend}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  downloadLink.download = `${filename || "friendship-ended"}.png`;
}

async function fetchPortrait(name, role) {
  const url = new URL("/portrait", aiEndpoint);
  url.searchParams.set("name", name);
  url.searchParams.set("role", role);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Portrait generation failed with ${response.status}`);
  }

  return createImageBitmap(await response.blob());
}

async function generateAiPortraits() {
  const formerFriend = formerFriendInput.value.trim() || "Mudasir";
  const newFriend = newFriendInput.value.trim() || "Salman";
  const currentGeneration = ++generation;

  generateButton.disabled = true;
  status.textContent = "Generating two terrible AI interpretations…";

  try {
    const [formerPortrait, newPortrait] = await Promise.all([
      fetchPortrait(formerFriend, "former"),
      fetchPortrait(newFriend, "new"),
    ]);

    if (currentGeneration !== generation) {
      formerPortrait.close();
      newPortrait.close();
      return;
    }

    portraits.former?.close();
    portraits.new?.close();
    portraits.former = formerPortrait;
    portraits.new = newPortrait;
    renderMeme();
    status.textContent = "AI images generated. Maximum slop achieved.";
  } catch (error) {
    console.error(error);
    status.textContent =
      "AI generation failed, so the cursed robot fallback is being used.";
  } finally {
    if (currentGeneration === generation) {
      generateButton.disabled = false;
    }
  }
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
  generateAiPortraits();
});

function handleNameInput() {
  generation += 1;
  portraits.former?.close();
  portraits.new?.close();
  portraits.former = null;
  portraits.new = null;
  generateButton.disabled = false;
  status.textContent = "Press Generate AI meme to create new portraits.";
  renderMeme();
}

formerFriendInput.addEventListener("input", handleNameInput);
newFriendInput.addEventListener("input", handleNameInput);

copyLinkButton.addEventListener("click", async () => {
  updateUrl();

  try {
    await navigator.clipboard.writeText(window.location.href);
    status.textContent = "Shareable link copied.";
  } catch {
    status.textContent = "Copy failed. Copy the URL from your address bar.";
  }
});

template.addEventListener("load", () => {
  renderMeme();
  generateAiPortraits();
});
template.src = "template.png";
