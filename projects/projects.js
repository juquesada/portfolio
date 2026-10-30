import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = '';
let selectedIndex = -1;
let selectedYear = null;

const colors = d3.scaleOrdinal(d3.schemeTableau10)
  .domain(projects.map((project) => String(project.year)));

function getSearchResults() {
  return projects.filter((project) =>
    Object.values(project)
      .join('\n')
      .toLowerCase()
      .includes(query),
  );
}

function renderVisibleProjects() {
  const searchResults = getSearchResults();

  const visibleProjects = selectedYear === null
    ? searchResults
    : searchResults.filter(
        (project) => String(project.year) === selectedYear,
      );

  renderProjects(visibleProjects, projectsContainer, 'h2');
}

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => String(d.year),
  );

  const data = rolledData.map(([year, count]) => ({
    value: count,
    label: year,
  }));

  selectedIndex = data.findIndex((d) => d.label === selectedYear);

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);

  const svg = d3.select('#projects-pie-plot');
  const legend = d3.select('.legend');

  svg.selectAll('path').remove();
  legend.selectAll('*').remove();

  function updateSelection() {
    svg.selectAll('path')
      .classed('selected', (_, idx) => idx === selectedIndex);

    legend.selectAll('.legend-item')
      .classed('selected', (_, idx) => idx === selectedIndex);
  }

  function toggleSelection(index) {
    selectedIndex = selectedIndex === index ? -1 : index;

    selectedYear = selectedIndex === -1
      ? null
      : data[selectedIndex].label;

    updateSelection();
    renderVisibleProjects();
  }

  arcData.forEach((slice, idx) => {
    svg
      .append('path')
      .attr('d', arcGenerator(slice))
      .attr('fill', colors(slice.data.label))
      .on('click', () => toggleSelection(idx));
  });

  data.forEach((d, idx) => {
    const item = legend
      .append('li')
      .attr('class', 'legend-item')
      .style('--color', colors(d.label))
      .on('click', () => toggleSelection(idx));

    item.append('span').attr('class', 'swatch');
    item.append('span').text(d.label);
    item.append('em').text(`(${d.value})`);
  });

  updateSelection();
}

function updateDisplay() {
  renderVisibleProjects();
  renderPieChart(getSearchResults());
}

updateDisplay();

searchInput.addEventListener('input', (event) => {
  query = event.target.value.trim().toLowerCase();
  updateDisplay();
});