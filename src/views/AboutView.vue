<template>
  <div class="page-body">
    <div class="info-card">
      <h5><i class="bi bi-database me-2" style="color:var(--orange);"></i>Data Source</h5>
      <p>
        This application uses the <strong>LA County Department of Public Health — Environmental Health Restaurant and Market Inspections</strong> dataset,
        available on the <a href="https://data.lacounty.gov/" target="_blank">LA County Open Data Portal</a>.
      </p>
    </div>
    <div class="info-card">
      <h5><i class="bi bi-bar-chart me-2" style="color:var(--orange);"></i>Dataset Summary</h5>
      <ul>
        <li>Coverage: January 2023 – December 2025</li>
        <li>Total inspections: 106,767 records across 42,917 unique facilities</li>
        <li>Cities covered: 163 cities in Los Angeles County</li>
        <li>Routine inspections: 98.2% · Owner-Initiated: 1.8%</li>
        <li>Grade A: 89.4% · Grade B: 3.9% · Grade C: 0.7%</li>
        <li>Non-Grade-A rate: 3.2% (2023) → 4.2% (2024) → 6.8% (2025)</li>
      </ul>
    </div>
    <div class="info-card">
      <h5><i class="bi bi-code-slash me-2" style="color:var(--orange);"></i>Tech Stack</h5>
      <ul>
        <li><strong>Vue.js 3</strong> — Frontend framework with Composition API</li>
        <li><strong>Vue Router 4</strong> — Client-side multi-page routing</li>
        <li><strong>Pinia</strong> — State management (shared data store)</li>
        <li><strong>Bootstrap 5</strong> — Grid layout & responsive components</li>
        <li><strong>Leaflet.js</strong> — Interactive OpenStreetMap (no API key needed)</li>
        <li><strong>D3.js v7</strong> — Charts (planned for final submission)</li>
        <li><strong>PapaParse</strong> — CSV parsing</li>
        <li><strong>Vite</strong> — Build tool</li>
        <li><strong>GitHub Pages</strong> — Static hosting</li>
      </ul>
    </div>
    <div class="info-card">
      <h5><i class="bi bi-people me-2" style="color:var(--orange);"></i>DSCI 554 Group Project · USC</h5>
      <p>Pre-submission skeleton for the DSCI 554 Visual Analytics course at the University of Southern California.</p>
    </div>
  </div>
</template>
