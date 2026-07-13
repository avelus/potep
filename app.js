const route = "route";

let gpsAccuracy = 999;
let questions = [];
let tracks = [];
let wps = [];

let userPos = null;
let userMarker = null;

let started = false;
let finished = false;
let activeStage = 1;

let startDialogShown = false;
let endDialogShown = false;

const triggeredWaypoints = new Set();
const trackLayers = {};
const waypointLayers = {};

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

    el.innerHTML =
        "[" +
        new Date().toLocaleTimeString() +
        "] " +
        msg +
        "<br>" +
        el.innerHTML;
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

    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )
    );
}

async function loadQuestions() {
    questions =
        await (
            await fetch(
                "data/pohod1.json"
            )
        ).json();
}

function getConfig(name) {
    return questions.find(
        x =>
            x.waypoint === name
    );
}

async function loadGpx() {

    const gpxText =
        await (
            await fetch(
                "routes/route.gpx"
            )
        ).text();

    const xml =
        new DOMParser().parseFromString(
            gpxText,
            "text/xml"
        );

    const trks =
        xml.getElementsByTagNameNS(
            "*",
            "trk"
        );

    for (
        let i = 0;
        i < trks.length;
        i++
    ) {

        const trk =
            trks[i];

        const nameNode =
            trk.getElementsByTagNameNS(
                "*",
                "name"
            )[0];

        const points = [];

        const trkpts =
            trk.getElementsByTagNameNS(
                "*",
                "trkpt"
            );

        for (
            let j = 0;
            j < trkpts.length;
            j++
        ) {

            points.push([
                parseFloat(
                    trkpts[j].getAttribute(
                        "lat"
                    )
                ),
                parseFloat(
                    trkpts[j].getAttribute(
                        "lon"
                    )
                )
            ]);
        }

        tracks.push({
            name:
                nameNode.textContent.trim(),
            points: points
        });
    }

    const wptNodes =
        xml.getElementsByTagNameNS(
            "*",
            "wpt"
        );

    for (
        let i = 0;
        i < wptNodes.length;
        i++
    ) {

        const node =
            wptNodes[i];

        const name =
            node.getElementsByTagNameNS(
                "*",
                "name"
            )[0].textContent.trim();

        wps.push({
            name: name,
            lat: parseFloat(
                node.getAttribute("lat")
            ),
            lon: parseFloat(
                node.getAttribute("lon")
            )
        });
    }
}

function drawObjects() {

    tracks.forEach(track => {

        const layer =
            L.polyline(
                track.points,
                {
                    color: "#2F5D50",
                    weight: 5
                }
            );

        trackLayers[
            track.name
        ] = layer;
    });

    wps.forEach(wp => {

        const marker =
            L.marker([
                wp.lat,
                wp.lon
            ]);

        marker.bindPopup(
            wp.name
        );

        waypointLayers[
            wp.name
        ] = marker;
    });

    if (
        waypointLayers[
            "START"
        ]
    ) {

        waypointLayers[
            "START"
        ].addTo(map);

        const startWp =
            wps.find(
                x =>
                    x.name ===
                    "START"
            );

        if (startWp) {

            map.setView(
                [
                    startWp.lat,
                    startWp.lon
                ],
                17
            );
        }
    }
}

function updateProgress() {

    const total =
        questions.filter(
            x => x.question
        ).length;

    const done =
        triggeredWaypoints.size;

    const percent =
        total === 0
            ? 0
            : Math.round(
                  (done /
                      total) *
                      100
              );

    document.getElementById(
        "progress"
    ).innerText =
        percent + "%";

    document.getElementById(
        "progressBar"
    ).style.width =
        percent + "%";
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

    document.getElementById(
        "questionTitle"
    ).innerText =
        title;

    const container =
        document.getElementById(
            "questionContainer"
        );

    container.innerHTML =
        "<p>" +
        text +
        "</p>";

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

    container.appendChild(
        btn
    );

    modal.classList.remove(
        "hidden"
    );
}

function showQuestion(q) {

    const modal =
        document.getElementById(
            "questionModal"
        );

    document.getElementById(
        "questionTitle"
    ).innerText =
        q.question;

    const container =
        document.getElementById(
            "questionContainer"
        );

    container.innerHTML = "";

    q.options.forEach(
        (
            option,
            index
        ) => {

            const btn =
                document.createElement(
                    "button"
                );

            btn.className =
                "answer-btn";

            btn.innerText =
                option;

            btn.onclick = () => {

                if (
                    index ===
                    q.correct
                ) {

                    modal.classList.add(
                        "hidden"
                    );

                    openNextStage();

                } else {

                    alert(
                        "Napačen odgovor."
                    );
                }
            };

            container.appendChild(
                btn
            );
        }
    );

    modal.classList.remove(
        "hidden"
    );
}

function startHike() {

    started = true;

    if (
        trackLayers["POT1"]
    ) {

        trackLayers[
            "POT1"
        ].addTo(map);
    }

    if (
        waypointLayers["T1"]
    ) {

        waypointLayers[
            "T1"
        ].addTo(map);
    }

    document.getElementById(
        "stageName"
    ).innerText =
        "Pohod aktiven";
}

function openNextStage() {

    activeStage++;

    const nextTrack =
        "POT" +
        activeStage;

    const nextWaypoint =
        "T" +
        activeStage;

    if (
        trackLayers[
            nextTrack
        ]
    ) {

        trackLayers[
            nextTrack
        ].addTo(map);
    }

    if (
        waypointLayers[
            nextWaypoint
        ]
    ) {

        waypointLayers[
            nextWaypoint
        ].addTo(map);
    }

    if (
        !waypointLayers[
            nextWaypoint
        ] &&
        waypointLayers["END"]
    ) {

        waypointLayers[
            "END"
        ].addTo(map);
    }

    updateProgress();
}

function handleWaypointCheck() {

    if (
        !userPos ||
        finished
    ) {
        return;
    }

    for (
        const wp of wps
    ) {

        const cfg =
            getConfig(
                wp.name
            );

        if (!cfg) {
            continue;
        }

        const distance =
            hav(
                userPos.lat,
                userPos.lon,
                wp.lat,
                wp.lon
            );

        if (
            wp.name ===
            "START"
        ) {

            if (
                !started &&
                !startDialogShown &&
                distance <=
                    cfg.radius
            ) {

                startDialogShown = true;

                showModal(
                    cfg.title,
                    cfg.message,
                    cfg.button,
                    startHike
                );
            }

            continue;
        }

        if (
            wp.name === "END"
        ) {

            if (
                started &&
                !finished &&
                !endDialogShown &&
                distance <=
                    cfg.radius
            ) {

                endDialogShown =
                    true;

                finished = true;

                showModal(
                    cfg.title,
                    cfg.message,
                    cfg.button,
                    () => {}
                );
            }

            continue;
        }

        if (
            triggeredWaypoints.has(
                wp.name
            )
        ) {
            continue;
        }

        if (
            distance <=
            cfg.radius
        ) {

            triggeredWaypoints.add(
                wp.name
            );

            showQuestion(
                cfg
            );

            return;
        }
    }
}

function startGPS() {

    navigator.geolocation.watchPosition(

        pos => {

            gpsAccuracy =
                pos.coords.accuracy;

            userPos = {
                lat:
                    pos.coords
                        .latitude,
                lon:
                    pos.coords
                        .longitude
            };

            document.getElementById(
                "gpsStatus"
            ).innerText =
                "✅ GPS povezan";

            document.getElementById(
                "gpsAccuracy"
            ).innerText =
                "Natančnost: " +
                Math.round(
                    gpsAccuracy
                ) +
                " m";

            document.getElementById(
                "gpsCoords"
            ).innerText =
                "Koordinate: " +
                userPos.lat.toFixed(
                    6
                ) +
                ", " +
                userPos.lon.toFixed(
                    6
                );

            if (
                !userMarker
            ) {

                userMarker =
                    L.marker([
                        userPos.lat,
                        userPos.lon
                    ]).addTo(map);

            } else {

                userMarker.setLatLng([
                    userPos.lat,
                    userPos.lon
                ]);
            }

            handleWaypointCheck();
        },

        err => {

            logMsg(
                "GPS: " +
                err.message
            );
        },

        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}

async function init() {

    await loadQuestions();

    await loadGpx();

    drawObjects();

    startGPS();

    updateProgress();

    logMsg(
        "Aplikacija pripravljena."
    );
}

init();
