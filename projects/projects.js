import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = (await fetchJSON('../lib/projects.json')) ?? [];
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');

let query = '';

const colors = d3.scaleOrdinal(d3.schemeTableau10)
  .domain(projects.map((project) => String(project.year)));

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

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);

  const svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();

  const legend = d3.select('.legend');
  legend.selectAll('*').remove();

  arcData.forEach((slice) => {
    svg
      .append('path')
      .attr('d', arcGenerator(slice))
      .attr('fill', colors(slice.data.label));
  });

  data.forEach((d) => {
    const item = legend
      .append('li')
      .attr('class', 'legend-item')
      .style('--color', colors(d.label));

    item.append('span').attr('class', 'swatch');
    item.append('span').text(d.label);
    item.append('em').text(`(${d.value})`);
  });
}

renderProjects(projects, projectsContainer, 'h2');
renderPieChart(projects);

searchInput.addEventListener('input', (event) => {
  query = event.target.value.trim().toLowerCase();

  const filteredProjects = projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query);
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});