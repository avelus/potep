let route = null;

let gpsAccuracy = 999;
let insideCounter = 0;

let track = [];
let wps = [];
let segments = [];
let questions = [];

let hikes = [];
let activeHike = null;

let userPos = null;
let userMarker = null;

let line = null;

let started = false;
let finished = false;

let startDialogShown = false;
let endDialogShown = false;

let hikeLoaded = false;
let currentQuestionIndex = 0;
let questionOpened = false;

let autoCenter = true;

const HIKE_RADIUS = 5000;

const map = L.map("map");

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "© OpenStreetMap contributors"
    }
).addTo(map);

const userIcon = L.icon({
    iconUrl: "images/user.png",
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

const startMarkers = [];

function logMsg(msg) {

    const log =
        document.getElementById(
            "gpsLog"
        );

    if (!log) {

        console.log(msg);

        return;
    }

    log.innerHTML =
        `[${new Date().toLocaleTimeString()}] ${msg}<br>` +
        log.innerHTML;
}

function hav(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const p =
        Math.PI / 180;

    const dLat =
        (lat2 - lat1) * p;

    const dLon =
        (lon2 - lon1) * p;

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

function getConfig(name) {

    return questions.find(
        q => q.waypoint === name
    );
}

function getWaypoint(name) {

    return wps.find(
        w => w.name === name
    );
}

function showModal(
    title,
    message,
    button,
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

    const text =
        document.createElement(
            "p"
        );

    text.innerText =
        message;

    container.appendChild(
        text
    );

    const btn =
        document.createElement(
            "button"
        );

    btn.className =
        "answer-btn";

    btn.innerText =
        button;

    btn.onclick = () => {

        modal.classList.add(
            "hidden"
        );

        if (callback) {
            callback();
        }
    };

    container.appendChild(
        btn
    );

    modal.classList.remove(
        "hidden"
    );
}

async function loadHikes() {

    hikes =
        await (
            await fetch(
                "data/hikes.json"
            )
        ).json();

    logMsg(
        `Pohodi: ${hikes.length}`
    );
}

async function loadHike(id) {

    if (hikeLoaded) {
        return;
    }

    hikeLoaded = true;

    route = id;

    logMsg(
        `Nalagam pohod ${id}`
    );

    questions =
        await (
            await fetch(
                `data/${id}.json`
            )
        ).json();

    const gpxText =
        await (
            await fetch(
                `routes/${id}.gpx`
            )
        ).text();

    const xml =
        new DOMParser()
            .parseFromString(
                gpxText,
                "text/xml"
            );

    track = [];
    wps = [];

    xml.querySelectorAll(
        "trkpt"
    )
    .forEach(p => {

        track.push({

            lat: Number(
                p.getAttribute(
                    "lat"
                )
            ),

            lon: Number(
                p.getAttribute(
                    "lon"
                )
            )

        });

    });

    xml.querySelectorAll(
        "wpt"
    )
    .forEach(w => {

        const nameNode =
            w.querySelector(
                "name"
            );

        wps.push({

            name: nameNode
                ? nameNode.textContent.trim()
                : "",

            lat: Number(
                w.getAttribute(
                    "lat"
                )
            ),

            lon: Number(
                w.getAttribute(
                    "lon"
                )
            )

        });

    });

    build();
    draw();

    logMsg(
        `Track: ${track.length}`
    );

    logMsg(
        `Waypointi: ${wps.length}`
    );
}

function build() {

    segments = [];

    if (
        track.length === 0
    ) {
        return;
    }

    segments.push({
        pts: track
    });
}

function draw() {

    if (
        !segments.length
    ) {
        return;
    }

    if (line) {
        map.removeLayer(line);
    }

    const seg =
        segments[0];

    line =
        L.polyline(
            seg.pts.map(
                p => [
                    p.lat,
                    p.lon
                ]
            ),
            {
                color: "#2F5D50",
                weight: 5
            }
        ).addTo(map);

    wps.forEach(w => {

        L.marker(
            [
                w.lat,
                w.lon
            ]
        )
        .addTo(map)
        .bindPopup(
            w.name
        );

    });
}

function showNearbyStarts() {

    hikes.forEach(h => {

        if (!userPos) {
            return;
        }

        const d =
            hav(
                userPos.lat,
                userPos.lon,
                h.startLat,
                h.startLon
            );

        if (
            d <=
            HIKE_RADIUS
        ) {

            if (
                !h._marker
            ) {

                h._marker =
                    L.marker([
                        h.startLat,
                        h.startLon
                    ])
                    .addTo(map)
                    .bindPopup(
                        h.name
                    );
            }

        }

    });
}

function startGPS() {

    if (
        !navigator.geolocation
    ) {

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
            enableHighAccuracy:true,
            timeout:15000,
            maximumAge:1000
        }
    );

    logMsg(
        "GPS inicializiran"
    );
}

function gpsSuccess(pos) {

    gpsAccuracy =
        Math.round(
            pos.coords.accuracy
        );

    userPos = {

        lat:
            pos.coords.latitude,

        lon:
            pos.coords.longitude
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

        if (
            gpsAccuracy <= 15
        ) {

            status.className =
                "good";

            status.innerText =
                "✅ GPS pripravljen";
        }
        else if (
            gpsAccuracy <= 30
        ) {

            status.className =
                "warn";

            status.innerText =
                "⚠ GPS se izboljšuje";
        }
        else {

            status.className =
                "bad";

            status.innerText =
                "📡 Slab signal";
        }
    }

    if (!userMarker) {

        userMarker =
            L.marker(
                [
                    userPos.lat,
                    userPos.lon
                ],
                {
                    icon:userIcon
                }
            ).addTo(map);

        map.setView(
            [
                userPos.lat,
                userPos.lon
            ],
            17
        );
    }
    else {

        userMarker.setLatLng([
            userPos.lat,
            userPos.lon
        ]);
    }

    if (autoCenter) {

        map.setView(
            [
                userPos.lat,
                userPos.lon
            ],
            17
        );
    }

    if (!activeHike) {

        showNearbyStarts();

        hikes.forEach(h => {

            const d =
                hav(
                    userPos.lat,
                    userPos.lon,
                    h.startLat,
                    h.startLon
                );

            if (
                d <= 50
            ) {

                activeHike = h;

                loadHike(
                    h.id
                );
            }

        });
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
        !userPos ||
        !wps.length ||
        !questions.length
    ) {
        return;
    }

    const startCfg =
        getConfig(
            "START"
        );

    const startWp =
        getWaypoint(
            "START"
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
            d <=
            startCfg.radius
        ) {

            startDialogShown =
                true;

            showModal(
                startCfg.title,
                startCfg.message,
                startCfg.button,
                () => {

                    started =
                        true;

                    document
                        .getElementById(
                            "stageName"
                        )
                        .innerText =
                        "Pohod aktiven";
                }
            );
        }

        return;
    }

    if (!started) {
        return;
    }

    const questionList =
        questions.filter(
            q => q.question
        );

    const currentQuestion =
        questionList[
            currentQuestionIndex
        ];

    if (
        currentQuestion
    ) {

        const wp =
            getWaypoint(
                currentQuestion.waypoint
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
                currentQuestion.radius
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
                        currentQuestion
                    );

                    insideCounter = 0;
                }
            }
            else {

                insideCounter = 0;

                const confirm =
                    document.getElementById(
                        "gpsConfirm"
                    );

                if (confirm) {

                    confirm.innerText =
                        "";
                }
            }
        }
    }

    const endCfg =
        getConfig(
            "CILJ"
        );

    const endWp =
        getWaypoint(
            "CILJ"
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
            d <=
            endCfg.radius
        ) {

            finished = true;

            endDialogShown =
                true;

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

    if (
        !modal ||
        questionOpened
    ) {
        return;
    }

    questionOpened =
        true;

    modal.classList.remove(
        "hidden"
    );

    document
        .getElementById(
            "questionTitle"
        )
        .innerText =
        q.question;

    const container =
        document.getElementById(
            "questionContainer"
        );

    container.innerHTML =
        "";

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

            btn.onclick =
                () => {

                if (
                    index ===
                    q.correct
                ) {

                    currentQuestionIndex++;

                    modal.classList.add(
                        "hidden"
                    );

                    questionOpened =
                        false;

                    alert(
                        "Pravilno!"
                    );
                }
                else {

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
}

async function init() {

    try {

        logMsg(
            "Inicializacija..."
        );

        await loadHikes();

        map.on(
            "dragstart",
            () => {

                autoCenter =
                    false;
            }
        );

        const centerBtn =
            document.getElementById(
                "centerBtn"
            );

        if (centerBtn) {

            centerBtn.onclick =
                () => {

                autoCenter =
                    true;

                if (
                    userPos
                ) {

                    map.setView(
                        [
                            userPos.lat,
                            userPos.lon
                        ],
                        17
                    );
                }
            };
        }

        startGPS();

    }
    catch(err) {

        console.error(
            err
        );

        logMsg(
            "NAPAKA: " +
            err.message
        );
    }
}

window.addEventListener(
    "load",
    init
);
