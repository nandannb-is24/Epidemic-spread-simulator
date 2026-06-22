/**
 * graph.js — Reusable D3.js force-directed graph component.
 *
 * Each lab gets its own Graph instance with an independent SVG element.
 * All share the same visual language (node/edge styling from style.css).
 */

export class Graph {
  /**
   * @param {string} svgId    — ID of the <svg> element to render into
   * @param {object} [opts]   — Optional overrides
   */
  constructor(svgId, opts = {}) {
    this.svgId     = svgId;
    this.svg       = null;
    this.g         = null;      // main group (inside zoom transform)
    this.simulation = null;

    this.nodeData  = [];
    this.edgeData  = [];

    this.nodeElements = null;
    this.edgeElements = null;
    this.labelElements = null;
    this.valueLabelElements = null;
    this.edgeWeightElements = null;

    this.opts = {
      nodeRadius:      14,
      showWeights:     opts.showWeights ?? false,
      showCosts:       opts.showCosts ?? false,
      interactive:     opts.interactive ?? true,   // drag + zoom
      chargeStrength:  opts.chargeStrength ?? -300,
      linkDistance:    opts.linkDistance ?? 80,
    };

    // Per-node colour overrides (set by lab logic)
    this._nodeColors   = {};    // nodeId → fill hex
    this._nodeGlows    = {};    // nodeId → glow colour
    this._nodeLabels   = {};    // nodeId → extra label below node
    this._edgeColors   = {};    // "u-v" → { stroke, width }

    this._zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', e => {
      if (this.g) this.g.attr('transform', e.transform);
    });
  }

  // -------------------------------------------------------------------------
  // Render / update
  // -------------------------------------------------------------------------

  /**
   * Full re-render from a graph data object returned by the backend.
   * @param {object} graphData  — { nodes: [{id,x,y,cost?}], edges:[{source,target,weight}] }
   */
  render(graphData) {
    if (!graphData) return;
    this.nodeData = graphData.nodes.map(n => ({ ...n }));
    this.edgeData = graphData.edges.map(e => ({
      source: e.source, target: e.target, weight: e.weight ?? 1,
    }));

    this._nodeColors   = {};
    this._nodeGlows    = {};
    this._nodeLabels   = {};
    this._edgeColors   = {};

    this._build();
  }

  _build() {
    const svgEl = document.getElementById(this.svgId);
    if (!svgEl) return;

    // Clear previous content
    d3.select(svgEl).selectAll('*').remove();

    const W = svgEl.clientWidth  || svgEl.parentElement?.clientWidth  || 600;
    const H = svgEl.clientHeight || svgEl.parentElement?.clientHeight || 400;

    this.svg = d3.select(svgEl)
      .attr('width',  '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${W} ${H}`);

    if (this.opts.interactive) {
      this.svg.call(this._zoom);
    }

    // Auto-scale node coordinates to fit beautifully within viewport margins
    if (this.nodeData.length > 0) {
      const xs = this.nodeData.map(n => n.x);
      const ys = this.nodeData.map(n => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;

      const marginX = W * 0.15;
      const marginY = H * 0.15;
      const usableW = W - 2 * marginX;
      const usableH = H - 2 * marginY;

      this.nodeData.forEach(n => {
        n.scaledX = marginX + ((n.x - minX) / rangeX) * usableW;
        n.scaledY = marginY + ((n.y - minY) / rangeY) * usableH;
      });
    }

    // Add subtle grid background
    const defs = this.svg.append('defs');
    defs.append('pattern')
      .attr('id', `grid-${this.svgId}`)
      .attr('width', 40).attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('path')
        .attr('d', 'M 40 0 L 0 0 0 40')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.03)')
        .attr('stroke-width', 1);

    this.svg.append('rect')
      .attr('width', '100%').attr('height', '100%')
      .attr('fill', `url(#grid-${this.svgId})`);

    this.g = this.svg.append('g').attr('class', 'graph-g');

    // Build id→node map for link references
    const nodeById = Object.fromEntries(this.nodeData.map(n => [n.id, n]));

    const links = this.edgeData.map(e => ({
      source: nodeById[e.source],
      target: nodeById[e.target],
      weight: e.weight,
      key: `${Math.min(e.source, e.target)}-${Math.max(e.source, e.target)}`,
    }));

    // ---- Edges ----
    const edgeGroup = this.g.append('g').attr('class', 'edges');
    this.edgeElements = edgeGroup.selectAll('line')
      .data(links, d => d.key)
      .join('line')
        .attr('class', 'edge-line')
        .attr('x1', d => d.source.scaledX)
        .attr('y1', d => d.source.scaledY)
        .attr('x2', d => d.target.scaledX)
        .attr('y2', d => d.target.scaledY);

    // Edge weight labels
    if (this.opts.showWeights) {
      const ewGroup = this.g.append('g').attr('class', 'edge-weights');
      this.edgeWeightElements = ewGroup.selectAll('text')
        .data(links)
        .join('text')
          .attr('class', 'edge-weight-label')
          .attr('x', d => (d.source.scaledX + d.target.scaledX) / 2)
          .attr('y', d => (d.source.scaledY + d.target.scaledY) / 2)
          .text(d => d.weight);
    }

    // ---- Nodes ----
    const nodeGroup = this.g.append('g').attr('class', 'nodes');
    const nodeGs = nodeGroup.selectAll('g.node-g')
      .data(this.nodeData, d => d.id)
      .join('g')
        .attr('class', 'node-g')
        .attr('transform', d => `translate(${d.scaledX},${d.scaledY})`);

    if (this.opts.interactive) {
      const drag = d3.drag()
        .on('start', (event, d) => { d3.select(event.sourceEvent.target.closest('g.node-g')).raise(); })
        .on('drag', (event, d) => {
          d.scaledX = event.x;
          d.scaledY = event.y;
          this._updatePositions();
        });
      nodeGs.call(drag);
    }

    // Circle
    this.nodeElements = nodeGs.append('circle')
      .attr('class', 'node-circle')
      .attr('r', this.opts.nodeRadius)
      .attr('fill', d => this._nodeColors[d.id] ?? '#2a3441')
      .attr('stroke', '#30363d')
      .attr('stroke-width', 1.5);

    // Node ID label (inside circle)
    nodeGs.append('text')
      .attr('class', 'node-label')
      .text(d => d.id);

    // Value label (below circle — for sigma/delta/distance etc.)
    this.valueLabelElements = nodeGs.append('text')
      .attr('class', 'node-value-label')
      .attr('dy', this.opts.nodeRadius + 10)
      .text('');

    this.labelElements = nodeGs;

    // Cost label (if showing for DP lab)
    if (this.opts.showCosts) {
      nodeGs.append('text')
        .attr('class', 'node-value-label')
        .attr('dy', -(this.opts.nodeRadius + 4))
        .style('fill', '#6e7681')
        .style('font-size', '8px')
        .text(d => d.cost != null ? `[$${d.cost}]` : '');
    }

    this._W = W;
    this._H = H;
  }

  _updatePositions() {
    if (!this.g) return;

    this.g.selectAll('g.node-g')
      .attr('transform', d => `translate(${d.scaledX},${d.scaledY})`);

    this.edgeElements
      .attr('x1', d => d.source.scaledX)
      .attr('y1', d => d.source.scaledY)
      .attr('x2', d => d.target.scaledX)
      .attr('y2', d => d.target.scaledY);

    if (this.edgeWeightElements) {
      this.edgeWeightElements
        .attr('x', d => (d.source.scaledX + d.target.scaledX) / 2)
        .attr('y', d => (d.source.scaledY + d.target.scaledY) / 2);
    }
  }

  // -------------------------------------------------------------------------
  // Color / highlight API (called by lab modules during animation)
  // -------------------------------------------------------------------------

  /** Set the fill colour of a specific node */
  setNodeColor(nodeId, fill, glowColor = null) {
    this._nodeColors[nodeId] = fill;
    if (!this.g) return;
    this.g.selectAll('g.node-g')
      .filter(d => d.id === nodeId)
      .select('circle')
        .attr('fill', fill)
        .attr('filter', glowColor
          ? `drop-shadow(0 0 6px ${glowColor})`
          : null);
  }

  /** Set the fill of all nodes at once from a map {id: color} */
  setAllNodeColors(colorMap) {
    Object.assign(this._nodeColors, colorMap);
    if (!this.g) return;
    this.g.selectAll('g.node-g').select('circle')
      .attr('fill', d => this._nodeColors[d.id] ?? '#2a3441')
      .attr('filter', d => {
        const gc = this._nodeGlows[d.id];
        return gc ? `drop-shadow(0 0 6px ${gc})` : null;
      });
  }

  /** Set the small text label below a node (sigma, delta, distance, etc.) */
  setNodeValueLabel(nodeId, text) {
    if (!this.g) return;
    this.g.selectAll('g.node-g')
      .filter(d => d.id === nodeId)
      .select('.node-value-label')
        .text(text ?? '');
  }

  /** Clear all value labels */
  clearAllValueLabels() {
    if (!this.g) return;
    this.g.selectAll('.node-value-label').text('');
  }

  /** Highlight or un-highlight an edge */
  setEdgeStyle(u, v, styleClass = '') {
    const key = `${Math.min(u,v)}-${Math.max(u,v)}`;
    if (!this.edgeElements) return;
    this.edgeElements
      .filter(d => d.key === key)
      .attr('class', `edge-line ${styleClass}`);
  }

  /** Reset all edge styles */
  resetEdgeStyles() {
    if (!this.edgeElements) return;
    this.edgeElements.attr('class', 'edge-line');
  }

  /** Reset all node colours to default */
  resetColors() {
    this._nodeColors = {};
    this._nodeGlows = {};
    if (!this.g) return;
    this.g.selectAll('g.node-g').select('circle')
      .attr('fill', '#2a3441')
      .attr('filter', null);
    this.clearAllValueLabels();
  }

  /** Add a glow effect to nodes */
  setNodeGlow(nodeId, glowColor) {
    this._nodeGlows[nodeId] = glowColor;
    if (!this.g) return;
    this.g.selectAll('g.node-g')
      .filter(d => d.id === nodeId)
      .select('circle')
        .attr('filter', `drop-shadow(0 0 8px ${glowColor})`);
  }

  /** Get all node IDs */
  getNodeIds() {
    return this.nodeData.map(n => n.id);
  }
}
