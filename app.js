import { course } from "./data/course.js";
import { distanceYards, formatCoord } from "./lib/geo.js";
import { watchPosition } from "./lib/gps.js";

const els = {
  holeLabel: document.querySelector("[data-hole-label]"),
  distance: document.querySelector("[data-distance]"),
  youCoords: document.querySelector("[data-you-coords]"),
  holeCoords: document.querySelector("[data-hole-coords]"),
  status: document.querySelector("[data-status]"),
  prev: document.querySelector("[data-prev-hole]"),
  next: document.querySelector("[data-next-hole]"),
};

let holeIndex = 0;
let you = null;

function currentHole() {
  return course.holes[holeIndex];
}

function render() {
  const hole = currentHole();
  const pin = hole.middle;

  els.holeLabel.textContent = `Hole ${hole.number} · Par ${hole.par}`;
  els.holeCoords.textContent = `${formatCoord(pin.lat)}, ${formatCoord(pin.lon)}`;

  if (you) {
    els.youCoords.textContent = `${formatCoord(you.lat)}, ${formatCoord(you.lon)}`;
    els.distance.textContent = String(Math.round(distanceYards(you, pin)));
  } else {
    els.youCoords.textContent = "—";
    els.distance.textContent = "—";
  }
}

function cycleHole(step) {
  const count = course.holes.length;
  holeIndex = (holeIndex + step + count) % count;
  render();
}

els.prev.addEventListener("click", () => cycleHole(-1));
els.next.addEventListener("click", () => cycleHole(1));

els.status.textContent = "Getting GPS…";
render();

watchPosition(
  (pos) => {
    you = pos;
    const accuracyYds = Math.round(pos.accuracyMeters / 0.9144);
    els.status.textContent = `GPS ±${accuracyYds} yd`;
    render();
  },
  (message) => {
    els.status.textContent = message;
  }
);
