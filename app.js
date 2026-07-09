const route = "route";

let gpsAccuracy = 999;
let questions = [];
let track = [];
let wps = [];

let userPos = null;
let userMarker = null;
let routeLine = null;

let started = false;
let finished = false;

const triggeredWaypoints = new Set();

const map = L.map("map");

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "© OpenStreetMap"
    }
).addTo(map);

map.setView([46.1, 13.6], 15);

function logMsg(msg) {
    const el = document.getElementById("gpsLog");
    el.innerHTML = "[" + new Date().toLocaleTimeString() + "] " + msg + "<br>" + el.innerHTML;
}

function hav(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const p = Math.PI / 180;
    const dLat = (lat2 - lat1) * p;
    const dLon = (lon2 - lon1) * p;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadQuestions() {
    questions = await (await fetch("data/pohod1.json")).json();
}

async function loadGpx() {
    const gpxText = await (await fetch("routes/route.gpx")).text();
    const xml = new DOMParser().parseFromString(gpxText, "text/xml");

    xml.querySelectorAll("trkpt").forEach(pt => {
        track.push({
            lat: parseFloat(pt.getAttribute("lat")),
            lon: parseFloat(pt.getAttribute("lon"))
        });
    });

    xml.querySelectorAll("wpt").forEach(pt => {
        const nameNode = pt.querySelector("name");
        wps.push({
            name: nameNode ? nameNode.textContent.trim() : "",
            lat: parseFloat(pt.getAttribute("lat")),
            lon: parseFloat(pt.getAttribute("lon"))
        });
    });
}

function drawRoute() {
    routeLine = L.polyline(track.map(p => [p.lat, p.lon]), {
        color: "#2F5D50",
        weight: 5
    }).addTo(map);

    wps.forEach(wp => {
        L.marker([wp.lat, wp.lon]).addTo(map).bindPopup(wp.name);
    });

    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
}

function updateProgress() {
    const questionPoints = wps.filter(x => x.name !== "START" && x.name !== "END");
    const solved = questionPoints.filter(x => triggeredWaypoints.has(x.name)).length;
    const total = questionPoints.length || 1;
    const percent = Math.round((solved / total) * 100);

    document.getElementById("progress").innerText = percent + "%";
    document.getElementById("progressBar").style.width = percent + "%";
}

function openQuestion(q) {
    const modal = document.getElementById("questionModal");
    const title = document.getElementById("questionTitle");
    const container = document.getElementById("questionContainer");

    title.innerText = q.question;
    container.innerHTML = "";

    q.options.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.innerText = option;

        btn.onclick = () => {
            if (index === q.correct) {
                modal.classList.add("hidden");
                updateProgress();
            } else {
                alert("Napačen odgovor.");
            }
        };

        container.appendChild(btn);
    });

    modal.classList.remove("hidden");
}

function handleWaypointCheck() {
    if (!userPos || finished) return;

    for (const wp of wps) {
        const distance = hav(userPos.lat, userPos.lon, wp.lat, wp.lon);

        if (wp.name === "START" && !started && distance <= 30) {
            started = true;
            document.getElementById("stageName").innerText = "Pohod aktiven";
        }

        if (!started) continue;

        if (wp.name === "END" && distance <= 30) {
            finished = true;
            document.getElementById("stageName").innerText = "Pohod zaključen";
            document.getElementById("gpsConfirm").innerText = "🎉 Čestitke! Prišli ste na cilj.";
            return;
        }

        const q = questions.find(x => x.waypoint === wp.name);
        if (!q) continue;

        const radius = q.radius || 30;

        if (distance <= radius && !triggeredWaypoints.has(wp.name)) {
            triggeredWaypoints.add(wp.name);
            document.getElementById("stageName").innerText = "Vprašanje " + wp.name;
            openQuestion(q);
            return;
        }
    }
}

function startGPS() {
    navigator.geolocation.watchPosition(
        pos => {
            gpsAccuracy = pos.coords.accuracy;
            userPos = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude
            };

            document.getElementById("gpsStatus").innerText = "✅ GPS povezan";
            document.getElementById("gpsAccuracy").innerText = "Natančnost: " + Math.round(gpsAccuracy) + " m";
            document.getElementById("gpsCoords").innerText = "Koordinate: " + userPos.lat.toFixed(6) + ", " + userPos.lon.toFixed(6);

            if (!userMarker) {
                userMarker = L.marker([userPos.lat, userPos.lon]).addTo(map);
            } else {
                userMarker.setLatLng([userPos.lat, userPos.lon]);
            }

            handleWaypointCheck();
        },
        err => logMsg(err.message),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

async function init() {
    await loadQuestions();
    await loadGpx();
    drawRoute();
    startGPS();
    updateProgress();
}

init();
