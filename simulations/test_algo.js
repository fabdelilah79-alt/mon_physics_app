const schemaElements = [
    { type: 'bat', x: 2, y: 2, rotation: 0 },
    { type: 'lamp', x: 4, y: 2, rotation: 0 },
    { type: 'sw_open', x: 6, y: 2, rotation: 0 }
];
const schemaWires = [
    { x1: 2, y1: 2, x2: 4, y2: 2 },
    { x1: 4, y1: 2, x2: 6, y2: 2 },
    { x1: 6, y1: 2, x2: 7, y2: 2 },
    { x1: 7, y1: 2, x2: 7, y2: 5 },
    { x1: 7, y1: 5, x2: 1, y2: 5 },
    { x1: 1, y1: 5, x2: 1, y2: 2 },
    { x1: 1, y1: 2, x2: 2, y2: 2 }
];

function analyzeCircuit() {
    let segments = [];
    schemaWires.forEach(w => {
        let x1 = w.x1, y1 = w.y1, x2 = w.x2, y2 = w.y2;
        if (x1 === x2) {
            let min = Math.min(y1, y2), max = Math.max(y1, y2);
            for (let y = min; y < max; y++) segments.push({ x1: x1, y1: y, x2: x1, y2: y + 1 });
        } else if (y1 === y2) {
            let min = Math.min(x1, x2), max = Math.max(x1, x2);
            for (let x = min; x < max; x++) segments.push({ x1: x, y1: y1, x2: x + 1, y2: y1 });
        }
    });

    let uniqueSegments = [];
    let seenSegs = new Set();
    segments.forEach(s => {
        let key = `${s.x1},${s.y1}-${s.x2},${s.y2}`;
        if (!seenSegs.has(key)) { seenSegs.add(key); uniqueSegments.push(s); }
    });

    let elMap = {};
    schemaElements.forEach((el, index) => {
        let rot = el.rotation || 0;
        let isHoriz = Math.abs(Math.cos(rot)) > 0.5;
        let uid = `elem_${el.x}_${el.y}`;
        elMap[`${el.x},${el.y}`] = Object.assign({}, el, { isHoriz, uid });
    });

    function getTerminal(x, y, side) {
        let el = elMap[`${x},${y}`];
        if (!el) return `node_${x}_${y}`;
        if (el.isHoriz) {
            if (side === 'LEFT') return `${el.uid}_1`;
            if (side === 'RIGHT') return `${el.uid}_2`;
            return null;
        } else {
            if (side === 'TOP') return `${el.uid}_1`;
            if (side === 'BOTTOM') return `${el.uid}_2`;
            return null;
        }
    }

    let adj = {};
    function addEdge(u, v) {
        if (!u || !v) return;
        if (!adj[u]) adj[u] = [];
        if (!adj[v]) adj[v] = [];
        adj[u].push(v);
        adj[v].push(u);
    }

    uniqueSegments.forEach(s => {
        if (s.y1 === s.y2) {
            addEdge(getTerminal(s.x1, s.y1, 'RIGHT'), getTerminal(s.x2, s.y2, 'LEFT'));
        } else {
            addEdge(getTerminal(s.x1, s.y1, 'BOTTOM'), getTerminal(s.x2, s.y2, 'TOP'));
        }
    });

    let batteries = Object.values(elMap).filter(e => e.type === 'bat');
    let lamps = Object.values(elMap).filter(e => e.type === 'lamp');
    let sws = Object.values(elMap).filter(e => e.type.startsWith('sw'));

    if (batteries.length === 0 || lamps.length === 0 || sws.length === 0)
        return { valid: false, reason: "Il manque des composants importants (pile, lampe ou interrupteur)." };

    let visited = new Set();
    let compId = 0;
    let nodeToComp = {};
    for (let node in adj) {
        if (!visited.has(node)) {
            compId++;
            let q = [node];
            visited.add(node);
            while (q.length > 0) {
                let curr = q.shift();
                nodeToComp[curr] = compId;
                (adj[curr] || []).forEach(n => {
                    if (!visited.has(n)) {
                        visited.add(n);
                        q.push(n);
                    }
                });
            }
        }
    }

    let getComp = (node) => {
        if (nodeToComp[node]) return nodeToComp[node];
        compId++;
        nodeToComp[node] = compId;
        return compId;
    };

    let absEdges = [];
    Object.values(elMap).forEach(el => {
        let u = `${el.uid}_1`;
        let v = `${el.uid}_2`;
        let c1 = getComp(u);
        let c2 = getComp(v);
        absEdges.push({ el: el, c1: c1, c2: c2 });
    });

    for (let edge of absEdges) {
        if (edge.c1 === edge.c2) {
            return { valid: false, reason: `Attention, un composant court-circuité a été détecté ! (${edge.el.type})` };
        }
    }

    let netAdj = {};
    absEdges.forEach(edge => {
        if (!netAdj[edge.c1]) netAdj[edge.c1] = [];
        if (!netAdj[edge.c2]) netAdj[edge.c2] = [];
        netAdj[edge.c1].push({ to: edge.c2, el: edge.el });
        netAdj[edge.c2].push({ to: edge.c1, el: edge.el });
    });

    let validCycleFound = false;

    for (let bat of batteries) {
        let batC1 = getComp(`${bat.uid}_1`);
        let batC2 = getComp(`${bat.uid}_2`);

        let dfs = (curr, pathElems) => {
            if (validCycleFound) return;
            if (curr === batC2) {
                let hasL = pathElems.some(e => e.type === 'lamp');
                let hasS = pathElems.some(e => e.type.startsWith('sw'));
                if (hasL && hasS) {
                    validCycleFound = true;
                }
                return;
            }
            if (!netAdj[curr]) return;
            netAdj[curr].forEach(edge => {
                if (edge.el.type === 'bat') return;
                if (!pathElems.includes(edge.el)) {
                    dfs(edge.to, [...pathElems, edge.el]);
                }
            });
        };

        dfs(batC1, []);
        if (validCycleFound) break;
    }

    if (validCycleFound) return { valid: true };
    return { valid: false, reason: "Le circuit n'est pas correctement fermé ou un composant n'est pas relié en boucle." };
}

console.log(analyzeCircuit());
