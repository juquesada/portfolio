import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  return d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: `https://github.com/juquesada/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
    const container = d3.select('#stats');
    container.selectAll('*').remove();
  
    container.append('h2').text('Summary');
  
    const dl = container.append('dl').attr('class', 'stats');
  
    const fileLengths = d3.rollups(
      data,
      (lines) => d3.max(lines, (d) => d.line),
      (d) => d.file,
    );
  
    dl.append('dt').text('Commits');
    dl.append('dd').text(commits.length);
  
    dl.append('dt').text('Files');
    dl.append('dd').text(fileLengths.length);
  
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    dl.append('dt').text('Max depth');
    dl.append('dd').text(d3.max(data, (d) => d.depth) ?? 0);
  
    dl.append('dt').text('Longest line');
    dl.append('dd').text(d3.max(data, (d) => d.length) ?? 0);
  
    dl.append('dt').text('Max lines');
    dl.append('dd').text(d3.max(fileLengths, (d) => d[1]) ?? 0);
  }

  function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;
    const margin = { top: 10, right: 20, bottom: 40, left: 60 };
  
    const container = d3.select('#chart');
    container.selectAll('*').remove();
  
    if (commits.length === 0) {
      container.append('p').text('No commit data available.');
      return;
    }
  
    const usableArea = {
      top: margin.top,
      right: width - margin.right,
      bottom: height - margin.bottom,
      left: margin.left,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    };
  
    const svg = container
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');
  
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(commits, (d) => d.datetime))
      .range([usableArea.left, usableArea.right])
      .nice();
  
    const yScale = d3
      .scaleLinear()
      .domain([0, 24])
      .range([usableArea.bottom, usableArea.top]);

    const gridlines = svg
      .append('g')
      .attr('class', 'gridlines')
      .attr('transform', `translate(${usableArea.left}, 0)`);
    
    gridlines.call(
      d3.axisLeft(yScale)
        .tickValues(d3.range(0, 25, 2))
        .tickFormat('')
        .tickSize(-usableArea.width),
    );
  
    const xAxis = d3.axisBottom(xScale);
  
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(d3.range(0, 25, 2))
      .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');
  
    svg
      .append('g')
      .attr('transform', `translate(0, ${usableArea.bottom})`)
      .call(xAxis);
  
    svg
      .append('g')
      .attr('transform', `translate(${usableArea.left}, 0)`)
      .call(yAxis);

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

    const rScale = d3
      .scaleSqrt()
      .domain([0, maxLines])
      .range([0, 30]);
    
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    
    const dots = svg.append('g').attr('class', 'dots');

    dots
      .selectAll('circle')
      .data(sortedCommits)
      .join('circle')
      .attr('cx', (d) => xScale(d.datetime))
      .attr('cy', (d) => yScale(d.hourFrac))
      .attr('r', (d) => rScale(d.totalLines))
      .attr('fill', 'steelblue')
      .style('fill-opacity', 0.7)
      .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on('mousemove', (event) => {
        updateTooltipPosition(event);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipVisibility(false);
      });
  }

  function renderTooltipContent(commit) {
    if (!commit || Object.keys(commit).length === 0) return;
  
    const link = document.getElementById('commit-link');
    link.href = commit.url;
    link.textContent = commit.id;
  
    document.getElementById('commit-date').textContent =
      commit.datetime.toLocaleDateString('en', {
        dateStyle: 'full',
      });
  
    document.getElementById('commit-time').textContent =
      commit.datetime.toLocaleTimeString('en', {
        timeStyle: 'short',
      });
  
    document.getElementById('commit-author').textContent = commit.author;
    document.getElementById('commit-lines').textContent = commit.totalLines;
  }
  
  function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
  }
  
  function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    const gap = 12;
    const bounds = tooltip.getBoundingClientRect();
  
    const left = Math.max(
      gap,
      Math.min(event.clientX + gap, window.innerWidth - bounds.width - gap),
    );
  
    const top = Math.max(
      gap,
      Math.min(event.clientY + gap, window.innerHeight - bounds.height - gap),
    );
  
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);