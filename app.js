const route = "route";

let gpsAccuracy = 999;
let insideCounter = 0;

let track = [];
let wps = [];
let segments = [];
let questions = [];

let userPos = null;
let userMarker = null;
let line = null;

let started = false;
let finished = false;

let startDialogShown = false;
let endDialogShown = false;

const map = L.map("map");

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(map);

function logMsg(msg) {

    const log = document.getElementById("gpsLog");

    if (!log) {
        console.log(msg);
        return;
    }

    log.innerHTML =
        `[${new Date().toLocaleTimeString()}] ${msg}<br>` +
        log.innerHTML;
}

function hav(lat1, lon1, lat2, lon2) {

    const R = 6371000;

    const p = Math.PI / 180;

    const dLat = (lat2 - lat1) * p;
    const dLon = (lon2 - lon1) * p;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * p) *
        Math.cos(lat2 * p) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );
}

function getConfig(name) {

    return questions.find(
        q => q.waypoint === name
    );
}

function showModal(
    title,
    text,
    buttonText,
    callback
) {

    const modal =
        document.getElementById(
            "questionModal"
        );

    if (!modal) {
        return;
    }

    document.getElementById(
        "questionTitle"
    ).innerText = title;

    const container =
        document.getElementById(
            "questionContainer"
        );

    container.innerHTML = "";

    const p =
        document.createElement("p");

    p.innerText = text;

    container.appendChild(p);

    const btn =
        document.createElement(
            "button"
        );

    btn.className =
        "answer-btn";

    btn.innerText =
        buttonText;

    btn.onclick = () => {

        modal.classList.add(
            "hidden"
        );

        callback();
    };

    container.appendChild(btn);

    modal.classList.remove(
        "hidden"
    );
}

async function init() {

    try {

        logMsg("Inicializacija...");

        questions =
            await (
                await fetch(
                    `data/${route}.json`
                )
            ).json();

        const gpxText =
            await (
                await fetch(
                    `routes/${route}.gpx`
                )
            ).text();

        const xml =
            new DOMParser().parseFromString(
                gpxText,
                "text/xml"
            );

        xml.querySelectorAll("trkpt").forEach(p => {

            track.push({

                lat: Number(
                    p.getAttribute("lat")
                ),

                lon: Number(
                    p.getAttribute("lon")
                )
            });

        });

        xml.querySelectorAll("wpt").forEach(w => {

            const nameNode =
                w.querySelector("name");

            wps.push({

                name: nameNode
                    ? nameNode.textContent.trim()
                    : "",

                lat: Number(
                    w.getAttribute("lat")
                ),

                lon: Number(
                    w.getAttribute("lon")
                )
            });

        });

        logMsg(
            `Track: ${track.length} točk`
        );

        logMsg(
            `Waypoints: ${wps.length}`
        );

        build();

        draw();

        startGPS();

    }
    catch (err) {

        console.error(err);

        logMsg(
            "NAPAKA: " +
            err.message
        );
    }
}

function build() {

    segments = [];

    if (track.length === 0) {
        return;
    }

    segments.push({
        pts: track
    });
}

function draw() {

    if (!segments.length) {
        return;
    }

    const seg = segments[0];

    if (!seg.pts.length) {
        return;
    }

    line = L.polyline(
        seg.pts.map(
            p => [p.lat, p.lon]
        ),
        {
            color: "#2F5D50",
            weight: 5
        }
    ).addTo(map);

    map.fitBounds(
        line.getBounds()
    );

    wps.forEach(w => {

        L.marker([
            w.lat,
            w.lon
        ])
        .addTo(map)
        .bindPopup(w.name);

    });
}

function startGPS() {

    if (!navigator.geolocation) {

        const s =
            document.getElementById(
                "gpsStatus"
            );

        if (s) {
            s.innerText =
                "GPS ni podprt";
        }

        return;
    }

    navigator.geolocation.watchPosition(
        gpsSuccess,
        gpsError,
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 1000
        }
    );

    logMsg(
        "GPS inicializiran"
    );
}

function gpsSuccess(pos) {

    gpsAccuracy = Math.round(
        pos.coords.accuracy
    );

    userPos = {

        lat: pos.coords.latitude,

        lon: pos.coords.longitude
    };

    const accuracy =
        document.getElementById(
            "gpsAccuracy"
        );

    if (accuracy) {

        accuracy.innerText =
            "Natančnost: " +
            gpsAccuracy +
            " m";
    }

    const coords =
        document.getElementById(
            "gpsCoords"
        );

    if (coords) {

        coords.innerText =
            userPos.lat.toFixed(6) +
            ", " +
            userPos.lon.toFixed(6);
    }

    const status =
        document.getElementById(
            "gpsStatus"
        );

    if (status) {

        if (gpsAccuracy <= 15) {

            status.className = "good";
            status.innerText =
                "✅ GPS pripravljen";

        } else if (
            gpsAccuracy <= 30
        ) {

            status.className = "warn";
            status.innerText =
                "⚠ GPS se izboljšuje";

        } else {

            status.className = "bad";
            status.innerText =
                "📡 Slab signal";
        }
    }

    if (!userMarker) {

        userMarker =
            L.circleMarker(
                [
                    userPos.lat,
                    userPos.lon
                ],
                {
                    radius: 8,
                    color: "blue",
                    fillColor: "blue",
                    fillOpacity: 0.9
                }
            ).addTo(map);

    } else {

        userMarker.setLatLng([
            userPos.lat,
            userPos.lon
        ]);
    }

    if (
        gpsAccuracy <= 30
    ) {
        checkWaypoint();
    }
}

function gpsError(err) {

    console.error(err);

    const status =
        document.getElementById(
            "gpsStatus"
        );

    if (status) {

        status.innerText =
            "GPS napaka: " +
            err.code;
    }

    logMsg(
        "GPS ERR " +
        err.code
    );
}

function checkWaypoint() {

    if (
        !questions.length ||
        !wps.length ||
        !userPos
    ) {
        return;
    }

    const startCfg =
        getConfig("START");

    const startWp =
        wps.find(
            w => w.name === "START"
        );

    if (
        startCfg &&
        startWp &&
        !started &&
        !startDialogShown
    ) {

        const d =
            hav(
                userPos.lat,
                userPos.lon,
                startWp.lat,
                startWp.lon
            );

        if (
            d <= startCfg.radius
        ) {

            startDialogShown = true;

            showModal(
                startCfg.title,
                startCfg.message,
                startCfg.button,
                () => {

                    started = true;

                    const stage =
                        document.getElementById(
                            "stageName"
                        );

                    if (stage) {
                        stage.innerText =
                            "Pohod aktiven";
                    }
                }
            );
        }

        return;
    }

    if (!started) {
        return;
    }

    const firstQuestion =
        questions.find(
            q => q.question
        );

    if (
        firstQuestion
    ) {

        const wp =
            wps.find(
                w =>
                    w.name ===
                    firstQuestion.waypoint
            );

        if (wp) {

            const d =
                hav(
                    userPos.lat,
                    userPos.lon,
                    wp.lat,
                    wp.lon
                );

            if (
                d <=
                firstQuestion.radius
            ) {

                insideCounter++;

                const confirm =
                    document.getElementById(
                        "gpsConfirm"
                    );

                if (confirm) {

                    confirm.innerText =
                        `GPS potrditev: ${insideCounter}/3`;
                }

                if (
                    insideCounter >= 3
                ) {

                    openQuestion(
                        firstQuestion
                    );

                    insideCounter = 0;
                }

            } else {

                insideCounter = 0;

                const confirm =
                    document.getElementById(
                        "gpsConfirm"
                    );

                if (confirm) {
                    confirm.innerText = "";
                }
            }
        }
    }

    const endCfg =
        getConfig("END");

    const endWp =
        wps.find(
            w => w.name === "END"
        );

    if (
        endCfg &&
        endWp &&
        !finished &&
        !endDialogShown
    ) {

        const d =
            hav(
                userPos.lat,
                userPos.lon,
                endWp.lat,
                endWp.lon
            );

        if (
            d <= endCfg.radius
        ) {

            finished = true;
            endDialogShown = true;

            showModal(
                endCfg.title,
                endCfg.message,
                endCfg.button,
                () => {}
            );
        }
    }
}

function openQuestion(q) {

    const modal =
        document.getElementById(
            "questionModal"
        );

    if (!modal) {
        return;
    }

    if (
        !modal.classList.contains(
            "hidden"
        )
    ) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    document.getElementById(
        "questionTitle"
    ).innerText =
        q.question;

    document.getElementById(
        "questionContainer"
    ).innerHTML =
        q.options
            .map(
                option =>
                    `<button class="answer-btn">${option}</button>`
            )
            .join("");
}

window.addEventListener(
    "load",
    init
);
