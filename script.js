const map = L.map('map', {
  zoomControl: true,
  attributionControl: false
});

const metricSelect = document.getElementById('metric-select');
const legendContainer = document.getElementById('legend');
const municipisCountEl = document.getElementById('municipis-count');
const avgValueEl = document.getElementById('avg-value');
const maxValueEl = document.getElementById('max-value');

const metricMeta = {
  comuns_pct: { label: '% Comuns Sumar', suffix: '%' },
  participacio_pct: { label: '% Participació', suffix: '%' },
  psc_pct: { label: '% PSC', suffix: '%' },
  erc_pct: { label: '% ERC', suffix: '%' },
  junts_pct: { label: '% Junts', suffix: '%' }
};

const colors = ['#f7f2f4', '#edd6df', '#e2b7c8', '#d491aa', '#c46587', '#af3b65', '#7f163e'];
const breaks = [0, 2, 5, 10, 20, 30, 45];

let geojsonLayer;
let dataByMunicipi = {};
let currentMetric = metricSelect.value;

function getColor(value) {
  if (value == null || Number.isNaN(value)) return '#ffffff';
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (value >= breaks[i]) return colors[i];
  }
  return colors[0];
}

function formatValue(value) {
  if (value == null || Number.isNaN(value)) return 'Sense dades';
  return `${value.toFixed(2).replace('.', ',')} %`;
}

function buildLegend() {
  legendContainer.innerHTML = '';
  breaks.forEach((start, index) => {
    const end = breaks[index + 1];
    const label = end == null ? `${start}+` : (index === 0 ? `0–${end}` : `${start}–${end}`);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-swatch" style="background:${colors[index]}"></div><div>${label}</div>`;
    legendContainer.appendChild(item);
  });
}

function style(feature) {
  const code = Number(feature.properties.codi_municipi);
  const row = dataByMunicipi[code];
  const value = row ? row[currentMetric] : null;

  return {
    fillColor: getColor(value),
    weight: 0.8,
    opacity: 1,
    color: '#c8c8c8',
    fillOpacity: 0.95
  };
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 2,
    color: '#333'
  });
  layer.bringToFront();
}

function resetHighlight(e) {
  geojsonLayer.resetStyle(e.target);
}

function popupHtml(props, row) {
  return `
    <div class="info-popup">
      <strong>${props.municipi}</strong><br>
      ${props.comarca} · ${props.provincia}<hr>
      <div><strong>${metricMeta[currentMetric].label}:</strong> ${formatValue(row?.[currentMetric])}</div>
      <div><strong>Cens:</strong> ${row?.cens?.toLocaleString('ca-ES') ?? '-'}</div>
      <div><strong>Vots vàlids:</strong> ${row?.vots_valids?.toLocaleString('ca-ES') ?? '-'}</div>
      <div><strong>Comuns:</strong> ${row?.comuns_vots?.toLocaleString('ca-ES') ?? '-'} (${formatValue(row?.comuns_pct)})</div>
      <div><strong>PSC:</strong> ${row?.psc_vots?.toLocaleString('ca-ES') ?? '-'} (${formatValue(row?.psc_pct)})</div>
      <div><strong>ERC:</strong> ${row?.erc_vots?.toLocaleString('ca-ES') ?? '-'} (${formatValue(row?.erc_pct)})</div>
      <div><strong>Junts:</strong> ${row?.junts_vots?.toLocaleString('ca-ES') ?? '-'} (${formatValue(row?.junts_pct)})</div>
      <div><strong>Participació:</strong> ${formatValue(row?.participacio_pct)}</div>
    </div>
  `;
}

function onEachFeature(feature, layer) {
  const code = Number(feature.properties.codi_municipi);
  const row = dataByMunicipi[code];

  layer.on({
    mouseover: (e) => {
      highlightFeature(e);
      layer.bindTooltip(
        `${feature.properties.municipi}<br>${metricMeta[currentMetric].label}: ${formatValue(row?.[currentMetric])}`,
        { sticky: true }
      ).openTooltip();
    },
    mouseout: (e) => {
      resetHighlight(e);
      layer.closeTooltip();
    },
    click: () => {
      layer.bindPopup(popupHtml(feature.properties, row)).openPopup();
    }
  });
}

function updateStats() {
  const rows = Object.values(dataByMunicipi).filter(r => typeof r[currentMetric] === 'number');
  municipisCountEl.textContent = rows.length.toLocaleString('ca-ES');
  if (!rows.length) {
    avgValueEl.textContent = '-';
    maxValueEl.textContent = '-';
    return;
  }
  const avg = rows.reduce((acc, row) => acc + row[currentMetric], 0) / rows.length;
  const maxRow = rows.reduce((best, row) => row[currentMetric] > best[currentMetric] ? row : best, rows[0]);
  avgValueEl.textContent = formatValue(avg);
  maxValueEl.textContent = `${maxRow.municipi}: ${formatValue(maxRow[currentMetric])}`;
}

function refreshMap() {
  geojsonLayer.setStyle(style);
  updateStats();
}

Promise.all([
  fetch('./data/base.geojson').then(r => r.json()),
  fetch('./data/dades_municipals.json').then(r => r.json())
]).then(([geojson, rows]) => {
  rows.forEach(row => {
    dataByMunicipi[Number(row.codi_municipi)] = row;
  });

  geojsonLayer = L.geoJSON(geojson, {
    style,
    onEachFeature
  }).addTo(map);

  map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
  buildLegend();
  updateStats();
}).catch((error) => {
  console.error(error);
  alert('No s\'han pogut carregar les dades. Revisa que obris el projecte des d\'un servidor web o GitHub Pages.');
});

metricSelect.addEventListener('change', (event) => {
  currentMetric = event.target.value;
  refreshMap();
});
