const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

const infoModal = document.getElementById('info-modal');
const subcategoryButtons = document.getElementById('subcategory-buttons');
const jewelryOptions = document.getElementById('jewelry-options');

// Snapshot modal elements
const snapshotBtn = document.getElementById('snapshot-btn');
const snapshotModal = document.getElementById('snapshot-modal');
const snapshotPreview = document.getElementById('snapshot-preview');
const downloadBtn = document.getElementById('download-btn');
const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
const shareInstagramBtn = document.getElementById('share-instagram-btn');

let earringImg = null;
let necklaceImg = null;
let braceletImg = null;
let ringImg = null;

let currentType = '';
let smoothedFaceLandmarks = null;
let smoothedHandLandmarks = null;
let camera;

// Store smoothed jewelry positions
let smoothedHandPoints = {};
let smoothedFacePoints = {};

// ================== GOOGLE DRIVE CONFIG ==================
const API_KEY = "AIzaSyCpriDfO1ySut-jgNz5_bdyd8oF4KDPIVM"; 

const driveFolders = {
  gold_earrings: "1NGkNyjse9l1dydjXquWbhDP79qyB03kg",
  gold_necklaces: "1yiCBSMk4HpxxZcPf2AQeQeAKMcNNQNxt",
  diamond_earrings: "16q2qkfEmeyMa45edfuRGwhJskQEbiwFS",
  diamond_necklaces: "1ffu4kbZMpWhw4bOLnB07z-HM8E5Lz7qz",
  bracelet: "1meaVCj5Et4Nq31H7l9nFVHCj6G8dfTmx",
  ring: "1fV6xqa4W0t693TyS2P71_JRxUoU5i3__",
};

// Fetch image links from Google Drive
async function fetchDriveImages(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${API_KEY}&fields=files(id,name,mimeType)`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.files) return [];
  return data.files.filter(f => f.mimeType.includes("image/")).map(f => {
    const link = `https://drive.google.com/thumbnail?id=${f.id}&sz=w1000`;
    return { id: f.id, name: f.name, src: link };
  });
}

// Load images
async function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.crossOrigin = "anonymous"; // important for snapshot export
    img.src = src;
  });
}

// Change jewelry image
async function changeJewelry(type, src) {
  const img = await loadImage(src);
  if (!img) return;
  earringImg = necklaceImg = braceletImg = ringImg = null;
  if (type.includes('earrings')) earringImg = img;
  else if (type.includes('necklaces')) necklaceImg = img;
  else if (type.includes('bracelet')) braceletImg = img;
  else if (type.includes('ring')) ringImg = img;
}

// ========== CATEGORY & OPTIONS ==========
function toggleCategory(category) {
  jewelryOptions.style.display = 'none';
  subcategoryButtons.style.display = 'none';
  currentType = category;
  const isAccessory = ['bracelet', 'ring'].includes(category);
  if (isAccessory) {
    insertJewelryOptions(category, 'jewelry-options');
    jewelryOptions.style.display = 'flex';
    startCamera('environment');
  } else {
    subcategoryButtons.style.display = 'flex';
    startCamera('user');
  }
}

function selectJewelryType(mainType, subType) {
  currentType = `${subType}_${mainType}`;
  subcategoryButtons.style.display = 'none';
  jewelryOptions.style.display = 'flex';
  insertJewelryOptions(currentType, 'jewelry-options');
}

async function insertJewelryOptions(type, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!driveFolders[type]) return;
  const images = await fetchDriveImages(driveFolders[type]);
  images.forEach((file, i) => {
    const btn = document.createElement('button');
    const img = document.createElement('img');
    img.src = file.src;
    img.alt = `${type} ${i + 1}`;
    btn.appendChild(img);
    btn.onclick = () => changeJewelry(type, file.src);
    container.appendChild(btn);
  });
}

// ========== MEDIAPIPE ==========
const faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

hands.onResults((results) => {
  smoothedHandLandmarks = results.multiHandLandmarks?.length > 0 ? results.multiHandLandmarks : null;
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.multiFaceLandmarks?.length > 0) {
    const newLandmarks = results.multiFaceLandmarks[0];
    if (!smoothedFaceLandmarks) smoothedFaceLandmarks = newLandmarks;
    else {
      const s = 0.2;
      smoothedFaceLandmarks = smoothedFaceLandmarks.map((prev, i) => ({
        x: prev.x * (1 - s) + newLandmarks[i].x * s,
        y: prev.y * (1 - s) + newLandmarks[i].y * s,
        z: prev.z * (1 - s) + newLandmarks[i].z * s,
      }));
    }
  } else smoothedFaceLandmarks = null;
  drawJewelry(smoothedFaceLandmarks, smoothedHandLandmarks, canvasCtx);
});

// Start camera
async function startCamera(facingMode) {
  if (camera) camera.stop();
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
    facingMode: facingMode
  });
  camera.start();
}

document.addEventListener('DOMContentLoaded', () => startCamera('user'));
videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

// ========== Snapshot Feature ==========
snapshotBtn.addEventListener('click', () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasElement.width;
  tempCanvas.height = canvasElement.height;
  const ctx = tempCanvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
  ctx.drawImage(canvasElement, 0, 0, tempCanvas.width, tempCanvas.height);
  const dataURL = tempCanvas.toDataURL("image/png");
  snapshotPreview.src = dataURL;
  snapshotModal.style.display = "block";
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = "snapshot.png";
  link.href = snapshotPreview.src;
  link.click();
});

shareWhatsappBtn.addEventListener('click', () => {
  const text = "Check out my virtual jewelry try-on! 💍✨";
  const url = snapshotPreview.src;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}`, "_blank");
});

shareInstagramBtn.addEventListener('click', () => {
  alert("Instagram direct image upload via web is limited. You can download the image and upload it on Instagram.");
});

function closeSnapshotModal() {
  snapshotModal.style.display = "none";
}

// ========== Helpers ==========
function smoothPoint(prev, current, factor = 0.4) {
  if (!prev) return current;
  return { x: prev.x * (1 - factor) + current.x * factor, y: prev.y * (1 - factor) + current.y * factor };
}

function drawJewelry(faceLandmarks, handLandmarks, ctx) {
  const earringScale = 0.078, necklaceScale = 0.252, braceletScale = 0.28, ringScale = 0.1;
  const angleOffset = Math.PI / 2;
  if (faceLandmarks) {
    const leftEar = { x: faceLandmarks[132].x * canvasElement.width - 6, y: faceLandmarks[132].y * canvasElement.height - 16 };
    const rightEar = { x: faceLandmarks[361].x * canvasElement.width + 6, y: faceLandmarks[361].y * canvasElement.height - 16 };
    const neck = { x: faceLandmarks[152].x * canvasElement.width - 8, y: faceLandmarks[152].y * canvasElement.height + 10 };
    smoothedFacePoints.leftEar = smoothPoint(smoothedFacePoints.leftEar, leftEar);
    smoothedFacePoints.rightEar = smoothPoint(smoothedFacePoints.rightEar, rightEar);
    smoothedFacePoints.neck = smoothPoint(smoothedFacePoints.neck, neck);
    if (earringImg) {
      const w = earringImg.width * earringScale, h = earringImg.height * earringScale;
      ctx.drawImage(earringImg, smoothedFacePoints.leftEar.x - w / 2, smoothedFacePoints.leftEar.y, w, h);
      ctx.drawImage(earringImg, smoothedFacePoints.rightEar.x - w / 2, smoothedFacePoints.rightEar.y, w, h);
    }
    if (necklaceImg) {
      const w = necklaceImg.width * necklaceScale, h = necklaceImg.height * necklaceScale;
      ctx.drawImage(necklaceImg, smoothedFacePoints.neck.x - w / 2, smoothedFacePoints.neck.y, w, h);
    }
  }
  if (handLandmarks) {
    handLandmarks.forEach((hand, idx) => {
      const wrist = { x: hand[0].x * canvasElement.width, y: hand[0].y * canvasElement.height };
      const middle = { x: hand[9].x * canvasElement.width, y: hand[9].y * canvasElement.height };
      const angle = Math.atan2(middle.y - wrist.y, middle.x - wrist.x);
      if (braceletImg) {
        const w = braceletImg.width * braceletScale, h = braceletImg.height * braceletScale;
        const key = `bracelet_${idx}`;
        smoothedHandPoints[key] = smoothPoint(smoothedHandPoints[key], wrist);
        ctx.save();
        ctx.translate(smoothedHandPoints[key].x, smoothedHandPoints[key].y);
        ctx.rotate(angle + angleOffset);
        ctx.drawImage(braceletImg, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      if (ringImg) {
        const w = ringImg.width * ringScale, h = ringImg.height * ringScale;
        const ringBase = { x: hand[13].x * canvasElement.width, y: hand[13].y * canvasElement.height };
        const ringKnuckle = { x: hand[14].x * canvasElement.width, y: hand[14].y * canvasElement.height };
        let pos = { x: (ringBase.x + ringKnuckle.x) / 2, y: (ringBase.y + ringKnuckle.y) / 2 };
        const key = `ring_${idx}`;
        smoothedHandPoints[key] = smoothPoint(smoothedHandPoints[key], pos);
        ctx.drawImage(ringImg, smoothedHandPoints[key].x - w / 2, smoothedHandPoints[key].y - h / 2, w, h);
      }
    });
  }
}

// Info modal
function toggleInfoModal() {
  if (infoModal.open) infoModal.close();
  else infoModal.showModal();
}
