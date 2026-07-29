const scoreEl = document.getElementById("score");
const overlayEl = document.getElementById("overlay");
const finalScoreEl = document.getElementById("finalScore");
const pilotInputEl = document.getElementById("pilotName");
const submitBtnEl = document.getElementById("submitBtn");
const playAgainBtnEl = document.getElementById("playAgainBtn");
const leaderboardTableEl = document.getElementById("leaderboardTable");

let scene,
  camera,
  renderer,
  ship,
  shipBody,
  shipCockpit,
  obstacles = [],
  stars,
  trenchGroup,
  keys = { left: false, right: false },
  gameActive = true,
  timer = 0,
  spawnTimer = 0.7,
  lastTime = 0,
  difficulty = 1,
  difficultyTimer = 0;

let database;
let firebaseEnabled = false;

function init() {
  setupScene();
  setupLighting();
  createTrench();
  createStars();
  createShip();
  setupInput();
  setupFirebase();
  fetchLeaderboard();
  animate(0);
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040b);
  scene.fog = new THREE.Fog(0x02040b, 30, 180);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 3.8, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", onWindowResize);
}

function setupLighting() {
  const ambient = new THREE.AmbientLight(0x6a7aff, 0.5);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0x6feeff, 1.2);
  directional.position.set(4, 9, 6);
  scene.add(directional);

  const point = new THREE.PointLight(0xff4d7f, 20, 50, 2);
  point.position.set(0, 5, -10);
  scene.add(point);
}

function createTrench() {
  trenchGroup = new THREE.Group();
  scene.add(trenchGroup);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x09111f,
    emissive: 0x071425,
    emissiveIntensity: 0.5,
    roughness: 0.95,
    metalness: 0.05,
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x111b33,
    emissive: 0x091527,
    emissiveIntensity: 0.4,
    roughness: 0.9,
    metalness: 0.05,
  });

  for (let i = 0; i < 42; i += 1) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.6, 20), floorMaterial);
    floor.position.set(0, -0.3, -i * 20);
    trenchGroup.add(floor);
  }

  for (let i = 0; i < 50; i += 1) {
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 20), wallMaterial);
    leftWall.position.set(-14.4, 3.5, -i * 20);
    trenchGroup.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 14.4;
    trenchGroup.add(rightWall);
  }

  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x2ef7ff, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 42; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 20), stripeMaterial);
    stripe.position.set(0, 0.3, -i * 20);
    trenchGroup.add(stripe);
  }
}

function createStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 250;
    positions[i * 3 + 1] = 10 + Math.random() * 60;
    positions[i * 3 + 2] = -Math.random() * 260;
  }

  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0x89d6ff, size: 0.12, transparent: true, opacity: 0.9 });
  stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

function createShip() {
  ship = new THREE.Group();
  ship.position.set(0, 1.25, 0);
  scene.add(ship);

  const bodyGeometry = new THREE.BoxGeometry(1.2, 0.55, 2.4);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e5dff,
    emissive: 0x0d4be0,
    emissiveIntensity: 1.1,
    metalness: 0.35,
    roughness: 0.2,
  });
  shipBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  shipBody.position.y = 0.1;
  ship.add(shipBody);

  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x72f6ff,
    emissive: 0x15a3ff,
    emissiveIntensity: 2.2,
    metalness: 0.15,
    roughness: 0.18,
  });
  shipCockpit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.95), cockpitMaterial);
  shipCockpit.position.set(0, 0.5, 0.25);
  ship.add(shipCockpit);

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a49aa,
    emissive: 0x1d1c54,
    emissiveIntensity: 0.8,
    metalness: 0.25,
    roughness: 0.35,
  });
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 1.1), wingMaterial);
  leftWing.position.set(-0.95, 0.04, -0.05);
  ship.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x = 0.95;
  ship.add(rightWing);

  const thrusterMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6f3f,
    emissive: 0xff4b21,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const thruster = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.5), thrusterMaterial);
  thruster.position.set(0, -0.15, -1.25);
  ship.add(thruster);
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      keys.left = true;
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      keys.right = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      keys.left = false;
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      keys.right = false;
    }
  });

  submitBtnEl.addEventListener("click", () => {
    const name = sanitizeName(pilotInputEl.value);
    if (!gameActive) {
      submitScoreToDB(name, Math.floor(timer));
    }
  });

  playAgainBtnEl.addEventListener("click", resetGame);
}

function setupFirebase() {
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    databaseURL: "YOUR_DATABASE_URL_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE",
  };

  const hasPlaceholderConfig = Object.values(firebaseConfig).some((value) => {
    return typeof value === "string" && value.includes("YOUR_") || value === "";
  });

  if (hasPlaceholderConfig || typeof firebase === "undefined") {
    firebaseEnabled = false;
    console.info("Firebase not configured. Using local leaderboard storage.");
    return;
  }

  firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  firebaseEnabled = true;
}

function sanitizeName(rawName) {
  const cleaned = (rawName || "Pilot").trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 10);
  return cleaned || "Pilot";
}

function animate(time) {
  const delta = (time - lastTime) / 1000 || 0.016;
  lastTime = time;

  if (gameActive) {
    updateGame(delta);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateGame(delta) {
  timer += delta;
  difficultyTimer += delta;
  if (difficultyTimer >= 5) {
    difficulty += 0.18;
    difficultyTimer = 0;
  }
  difficulty = Math.max(1, difficulty);
  scoreEl.textContent = `Survival Time: ${Math.floor(timer)}s`;

  const moveSpeed = 10.5;
  if (keys.left) {
    ship.position.x -= moveSpeed * delta;
  }
  if (keys.right) {
    ship.position.x += moveSpeed * delta;
  }
  ship.position.x = THREE.MathUtils.clamp(ship.position.x, -7.2, 7.2);

  ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, keys.left ? 0.25 : keys.right ? -0.25 : 0, 0.12);
  ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, keys.left ? 0.08 : keys.right ? -0.08 : 0, 0.12);

  camera.position.x = THREE.MathUtils.lerp(camera.position.x, ship.position.x * 0.35, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.8 + Math.sin(timer * 0.8) * 0.12, 0.05);
  camera.lookAt(0, 1.3, 0);

  stars.rotation.z += 0.0002;

  spawnTimer -= delta;
  const spawnInterval = Math.max(0.2, 0.9 - difficulty * 0.035);
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = spawnInterval;
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    obstacle.position.z += obstacle.userData.speed * delta;
    obstacle.rotation.x += obstacle.userData.rotationSpeed * delta;
    obstacle.rotation.y += obstacle.userData.rotationSpeed * 0.7 * delta;

    const shipBox = new THREE.Box3().setFromObject(ship);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);
    if (shipBox.intersectsBox(obstacleBox)) {
      endGame();
      return;
    }

    if (obstacle.position.z > 18) {
      scene.remove(obstacle);
      obstacles.splice(i, 1);
    }
  }
}

function spawnObstacle() {
  const geometry = Math.random() > 0.5 ? new THREE.BoxGeometry(1.25, 1.25, 1.25) : new THREE.IcosahedronGeometry(1.05, 0);
  const color = Math.random() > 0.5 ? 0xff4f7a : 0x6b52ff;
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    metalness: 0.2,
    roughness: 0.25,
  });

  const obstacle = new THREE.Mesh(geometry, material);
  obstacle.position.set((Math.random() - 0.5) * 12, 1.2 + Math.random() * 1.1, -45 - Math.random() * 20);
  obstacle.userData.speed = 24 + Math.random() * 10 + difficulty * 6;
  obstacle.userData.rotationSpeed = 0.7 + Math.random() * 1.2;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

function endGame() {
  if (!gameActive) return;

  gameActive = false;
  const finalTime = Math.floor(timer);
  finalScoreEl.textContent = `Final Survival Time: ${finalTime}s`;
  overlayEl.classList.remove("hidden");
  pilotInputEl.value = "";
  pilotInputEl.focus();
  fetchLeaderboard();
}

function resetGame() {
  gameActive = true;
  timer = 0;
  spawnTimer = 0.7;
  difficulty = 1;
  difficultyTimer = 0;
  lastTime = performance.now();
  scoreEl.textContent = "Survival Time: 0s";
  overlayEl.classList.add("hidden");
  ship.position.set(0, 1.25, 0);
  ship.rotation.set(0, 0, 0);

  obstacles.forEach((obstacle) => scene.remove(obstacle));
  obstacles = [];
}

function saveLocalScore(name, score) {
  const key = "neon-trench-local-leaderboard";
  const entries = JSON.parse(localStorage.getItem(key) || "[]");
  entries.push({ name, score, timestamp: Date.now() });
  entries.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
  localStorage.setItem(key, JSON.stringify(entries.slice(0, 10)));
}

function loadLocalLeaderboard() {
  const key = "neon-trench-local-leaderboard";
  const entries = JSON.parse(localStorage.getItem(key) || "[]");
  return entries;
}

function submitScoreToDB(name, score) {
  submitBtnEl.disabled = true;
  submitBtnEl.textContent = "Uploading...";

  if (!firebaseEnabled || !database) {
    saveLocalScore(name, score);
    submitBtnEl.textContent = "Saved Locally";
    fetchLeaderboard();
    setTimeout(() => {
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = "Submit Score";
    }, 1200);
    return;
  }

  const payload = {
    name,
    score,
    timestamp: Date.now(),
  };

  database
    .ref("leaderboard")
    .push(payload)
    .then(() => {
      submitBtnEl.textContent = "Submitted";
      fetchLeaderboard();
    })
    .catch((error) => {
      console.error("Failed to submit score:", error);
      submitBtnEl.textContent = "Submit Failed";
    })
    .finally(() => {
      setTimeout(() => {
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = "Submit Score";
      }, 1500);
    });
}

function fetchLeaderboard() {
  if (firebaseEnabled && database) {
    database
      .ref("leaderboard")
      .once("value")
      .then((snapshot) => {
        const entries = [];
        snapshot.forEach((child) => {
          const value = child.val() || {};
          entries.push({
            name: value.name || "Pilot",
            score: Number(value.score) || 0,
            timestamp: Number(value.timestamp) || 0,
          });
        });

        entries.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
        renderLeaderboard(entries.slice(0, 10));
      })
      .catch((error) => {
        console.error("Failed to fetch leaderboard:", error);
        renderLeaderboard(loadLocalLeaderboard());
      });
    return;
  }

  renderLeaderboard(loadLocalLeaderboard());
}

function renderLeaderboard(entries) {
  if (!entries.length) {
    leaderboardTableEl.innerHTML = '<p class="empty">No pilots yet. Be the first to survive.</p>';
    return;
  }

  const rows = entries
    .map((entry, index) => {
      const safeName = escapeHtml(entry.name);
      return `
        <div class="leaderboard-row">
          <span class="rank">#${index + 1}</span>
          <span class="name">${safeName}</span>
          <span class="score">${entry.score}s</span>
        </div>
      `;
    })
    .join("");

  leaderboardTableEl.innerHTML = rows;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("DOMContentLoaded", init);
