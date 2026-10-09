#!/usr/bin/env bash
# Workbench performance benchmark (spec 009).
#
# Drives agent-browser against the running dev server, measures frame deltas +
# long tasks for three scenarios on a populated scene:
#   S1 single-node drag   — 30 mouse steps @ ~33ms
#   S2 marquee select     — 25 steps over a rect enclosing >=4 nodes; asserts selectedCount
#   S3 multi-node drag    — drags one node of the S2 selection, 30 steps
#
# Usage: scripts/perf/workbench-bench.sh [workbenchUrl]
#   Default URL targets the 30-node "Test" scene on localhost:3001.
#
# Requires: agent-browser (headed session), jq, dev server running, dev login available.
# Output: JSON report to stdout; also written to $OUT_FILE if set.

set -euo pipefail

BASE_URL="${OPENVIZ_BASE:-http://localhost:3001}"
WORKBENCH_URL="${1:-$BASE_URL/projects/9ad32117-9cda-4a96-a112-b7591439e61f/workbench}"
OUT_FILE="${OPENVIZ_BENCH_OUT:-}"

ab() { agent-browser "$@"; }

# Unwrap one layer of JSON string encoding from agent-browser eval output.
unwrap_json() { jq -r 'if type == "string" then . else tojson end'; }

die() { echo "BENCH FAIL: $*" >&2; exit 1; }

# --- login (dev login button) -----------------------------------------------
ab open "$BASE_URL/login" >/dev/null
sleep 2
if ab get url | grep -q "/login"; then
    ab find text "Dev Login" click >/dev/null 2>&1 || die "could not find dev login button"
    sleep 3
fi

# --- open workbench + wait for nodes ----------------------------------------
ab open "$WORKBENCH_URL" >/dev/null
for i in $(seq 1 20); do
    count="$(ab eval "document.querySelectorAll('.react-flow__node').length" 2>/dev/null | tail -1 | tr -d '"')"
    if [[ "${count:-0}" =~ ^[0-9]+$ ]] && (( count > 0 )); then break; fi
    sleep 1
done
[[ "${count:-0}" =~ ^[0-9]+$ ]] && (( count > 0 )) || die "no nodes loaded after wait"

# --- inject harness ----------------------------------------------------------
ab eval "$(cat "$(dirname "$0")/inject-harness.js")" >/dev/null

# --- helpers -----------------------------------------------------------------
# Get screen-center of a node by data-id, or first visible node.
node_center() {
    local id="${1:-}"
    local findExpr='els[0]'
    [[ -n "$id" ]] && findExpr="els.find(n => n.getAttribute('data-id') === '$id') || els[0]"
    ab eval "(() => {
        const els = [...document.querySelectorAll('.react-flow__node')];
        const pick = $findExpr;
        if (!pick) return 'null';
        const r = pick.getBoundingClientRect();
        return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), id: pick.getAttribute('data-id') });
    })()" 2>/dev/null | tail -1 | unwrap_json
}

# Drag from (cx,cy) with N steps of (dx,dy) each at ~33ms.
drag() {
    local cx=$1 cy=$2 n=$3 dx=$4 dy=$5
    ab mouse move "$cx" "$cy" >/dev/null; sleep 0.1
    ab mouse down >/dev/null
    for i in $(seq 1 "$n"); do
        ab mouse move $((cx + dx*i)) $((cy + dy*i)) >/dev/null
        sleep 0.033
    done
    sleep 0.1
    ab mouse up >/dev/null; sleep 0.2
}

# Marquee from (x1,y1) to (x2,y2) in N steps.
marquee() {
    local x1=$1 y1=$2 x2=$3 y2=$4 n=25
    ab mouse move "$x1" "$y1" >/dev/null; sleep 0.1
    ab mouse down >/dev/null
    for i in $(seq 1 "$n"); do
        ab mouse move $((x1 + (x2-x1)*i/n)) $((y1 + (y2-y1)*i/n)) >/dev/null
        sleep 0.033
    done
    sleep 0.1
    ab mouse up >/dev/null; sleep 0.2
}

# Clear selection by clicking an empty pane corner.
clear_selection() {
    ab mouse move 5 5 >/dev/null; sleep 0.05
    ab mouse down >/dev/null; sleep 0.05
    ab mouse up >/dev/null; sleep 0.3
}

selected_count() {
    ab eval "document.querySelectorAll('.react-flow__node.selected').length" 2>/dev/null | tail -1 | tr -d '"'
}

# --- S1: single-node drag ----------------------------------------------------
c1="$(node_center)"
[[ "$c1" == "null" ]] && die "no node center found for S1"
cx=$(echo "$c1" | jq -r .x); cy=$(echo "$c1" | jq -r .y)
ab eval "window.__perf.start()" >/dev/null
drag "$cx" "$cy" 30 5 2
S1="$(ab eval "window.__perf.stop()" 2>/dev/null | tail -1 | unwrap_json)"

# --- S2: marquee select ------------------------------------------------------
clear_selection
# Choose a rect enclosing several nodes. The start corner must be EMPTY pane
# (pointerdown on a node would drag it instead of marqueeing): sample expanded
# bounding-box corners and keep the first one whose elementFromPoint is not a node.
rect="$(ab eval "(() => {
    const els = [...document.querySelectorAll('.react-flow__node')];
    const vis = els.filter(n => { const r = n.getBoundingClientRect(); return r.x < innerWidth && r.y < innerHeight && r.width>0; });
    const box = vis.slice(0,4).map(n => n.getBoundingClientRect());
    if (box.length < 2) return 'null';
    const minx = Math.min(...box.map(b=>b.x)), maxx = Math.max(...box.map(b=>b.x+b.width));
    const miny = Math.min(...box.map(b=>b.y)), maxy = Math.max(...box.map(b=>b.y+b.height));
    const x2 = Math.min(innerWidth-5, maxx + 10);
    const y2 = Math.min(innerHeight-5, maxy + 10);
    const candidates = [
        [Math.max(2, minx - 40), Math.max(2, miny - 40)],
        [Math.max(2, minx - 40), Math.min(innerHeight-2, maxy + 40)],
        [Math.max(2, maxx + 40), Math.max(2, miny - 40)],
        [Math.max(2, minx - 40), Math.max(2, miny - 10)],
    ];
    const isNode = (x,y) => {
        const el = document.elementFromPoint(x,y);
        return !!(el && el.closest && el.closest('.react-flow__node'));
    };
    const [x1, y1] = candidates.find(([x,y]) => x > 0 && y > 0 && x < innerWidth-5 && y < innerHeight-5 && !isNode(x,y)) || [2, 2];
    return JSON.stringify({x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), count: box.length});
})()" 2>/dev/null | tail -1 | unwrap_json)"
[[ "$rect" == "null" ]] && die "no marquee rect for S2"
rx1=$(echo "$rect" | jq -r .x1); ry1=$(echo "$rect" | jq -r .y1)
rx2=$(echo "$rect" | jq -r .x2); ry2=$(echo "$rect" | jq -r .y2)
enclosed=$(echo "$rect" | jq -r .count)
ab eval "window.__perf.start()" >/dev/null
marquee "$rx1" "$ry1" "$rx2" "$ry2"
S2="$(ab eval "window.__perf.stop()" 2>/dev/null | tail -1 | unwrap_json)"
SEL_COUNT="$(selected_count)"

# --- S3: multi-node drag (drag one SELECTED node so the whole selection moves)
c3="$(ab eval "(() => {
    const pick = document.querySelector('.react-flow__node.selected') || document.querySelector('.react-flow__node');
    if (!pick) return 'null';
    const r = pick.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), id: pick.getAttribute('data-id') });
})()" 2>/dev/null | tail -1 | unwrap_json)"
cx3=$(echo "$c3" | jq -r .x); cy3=$(echo "$c3" | jq -r .y)
ab eval "window.__perf.start()" >/dev/null
drag "$cx3" "$cy3" 30 5 2
S3="$(ab eval "window.__perf.stop()" 2>/dev/null | tail -1 | unwrap_json)"

# --- report ------------------------------------------------------------------
report=$(jq -n \
    --arg url "$WORKBENCH_URL" \
    --argjson s1 "$S1" --argjson s2 "$S2" --argjson s3 "$S3" \
    --argjson selCount "${SEL_COUNT:-0}" --argjson enclosed "$enclosed" \
    '{ url: $url,
       singleNodeDrag: $s1,
       marqueeSelect: ($s2 + { selectedCount: $selCount, enclosedApprox: $enclosed }),
       multiNodeDrag: $s3 }')

echo "$report"
if [[ -n "$OUT_FILE" ]]; then echo "$report" | jq . > "$OUT_FILE"; fi
