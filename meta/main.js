import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

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
      const { author, date, time, timezone, datetime } = lines[0];

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
    })
    .sort((a, b) => a.datetime - b.datetime);
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

function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id;

  document.getElementById('commit-date').textContent =
    commit.datetime.toLocaleDateString('en', {
      dateStyle: 'full',
    });

  document.getElementById('commit-tooltip-time').textContent =
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

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 20, bottom: 40, left: 60 };

  const container = d3.select('#chart');
  container.selectAll('*').remove();

  d3.select('#selection-count').text('No commits selected');
  d3.select('#language-breakdown').selectAll('*').remove();

  if (commits.length === 0) {
    container.append('p').text('No commit data available.');
    return () => {};
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

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
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

  const xAxisGroup = svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const maxLines = d3.max(commits, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([0, maxLines])
    .range([0, 30]);

  const dots = svg.append('g').attr('class', 'dots');
  let visibleCommits = [];

  function isCommitSelected(selection, commit) {
    if (!selection) return false;

    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }

  function renderSelectionCount(selectedCommits) {
    const count = selectedCommits.length;

    d3.select('#selection-count').text(
      count === 0
        ? 'No commits selected'
        : `${count} commit${count === 1 ? '' : 's'} selected`,
    );
  }

  function renderLanguageBreakdown(selectedCommits) {
    const breakdownContainer = d3.select('#language-breakdown');
    breakdownContainer.selectAll('*').remove();

    if (selectedCommits.length === 0) return;

    const lines = selectedCommits.flatMap((commit) => commit.lines);

    const breakdown = d3.rollups(
      lines,
      (v) => v.length,
      (d) => d.type,
    );

    for (const [language, count] of breakdown) {
      const proportion = d3.format('.1~%')(count / lines.length);

      breakdownContainer.append('dt').text(language.toUpperCase());
      breakdownContainer
        .append('dd')
        .text(`${count} lines (${proportion})`);
    }
  }

  function brushed(event) {
    const selection = event.selection;

    const selectedCommits = visibleCommits.filter((commit) =>
      isCommitSelected(selection, commit),
    );

    dots.selectAll('circle').classed('selected', (commit) =>
      isCommitSelected(selection, commit),
    );

    updateTooltipVisibility(false);
    renderSelectionCount(selectedCommits);
    renderLanguageBreakdown(selectedCommits);
  }

  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', brushed);

  const brushGroup = svg.append('g').attr('class', 'brush').call(brush);
  dots.raise();

  return function updateScatterPlot(filteredCommits) {
    visibleCommits = filteredCommits;
    brushGroup.call(brush.move, null);
    const [first, last] = d3.extent(filteredCommits, (d) => d.datetime);
    // Give the first commit a readable date axis when it is the only point.
    const domain = +first === +last
      ? [d3.timeDay.floor(first), d3.timeDay.offset(d3.timeDay.floor(first), 1)]
      : [first, last];
    xScale.domain(domain).nice();
    xAxisGroup.call(xAxis);

    const sortedCommits = d3.sort(filteredCommits, (d) => -d.totalLines);
    dots
      .selectAll('circle')
      .data(sortedCommits, (d) => d.id)
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

  };
}

function updateFileDisplay(lines, colors) {
  const files = d3.groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length || d3.ascending(a.name, b.name));

  const rows = d3.select('#files').selectAll(':scope > div')
    .data(files, (d) => d.name)
    .join((enter) => {
      const row = enter.append('div');
      const label = row.append('dt');
      label.append('code');
      label.append('small');
      row.append('dd').attr('aria-hidden', 'true');
      return row;
    });

  rows.select('code').text((d) => d.name);
  rows.select('small').text((d) => `${d.lines.length} ${d.lines.length === 1 ? 'line' : 'lines'}`);
  rows.select('dd').selectAll('.loc')
    .data((d) => d.lines, (d) => d.line)
    .join('span')
    .attr('class', 'loc')
    .style('--line-color', (d) => colors(d.type))
    .attr('title', (d) => `${d.type || 'Other'} · line ${d.line}`);
}

function renderStory(commits) {
  const steps = d3.select('#scatter-story').selectAll('.step')
    .data(commits, (d) => d.id)
    .join('article')
    .attr('class', 'step');

  steps.append('p').append('time')
    .attr('datetime', (d) => d.datetime.toISOString())
    .text((d) => d.datetime.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' }));

  steps.append('h3').append('a')
    .attr('href', (d) => d.url)
    .text((d, i) => `Commit ${i + 1} · ${d.id}`);

  steps.append('p').text((d) => {
    const fileCount = new Set(d.lines.map((line) => line.file)).size;
    return `This commit accounts for ${d.totalLines} ${d.totalLines === 1 ? 'line' : 'lines'} across ${fileCount} ${fileCount === 1 ? 'file' : 'files'} in the dataset.`;
  });
}

function initialize(data) {
  const commits = processCommits(data);
  const updateScatterPlot = renderScatterPlot(commits);
  const slider = document.getElementById('commit-progress');
  const time = document.getElementById('commit-time');

  if (commits.length === 0) {
    renderCommitInfo(data, commits);
    slider.disabled = true;
    return;
  }

  const timeScale = d3.scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);
  const types = d3.sort(new Set(data.map((d) => d.type)));
  const colors = d3.scaleOrdinal(types, d3.schemeTableau10);

  d3.select('#file-legend').selectAll('li')
    .data(types)
    .join('li')
    .style('--line-color', colors)
    .text((type) => type || 'Other');

  function updateTimeline(commitMaxTime, activeStep = null) {
    const filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    const lines = filteredCommits.flatMap((d) => d.lines);

    time.dateTime = commitMaxTime.toISOString();
    time.textContent = commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    d3.select('#scatter-story').selectAll('.step')
      .classed('is-active', function () { return this === activeStep; });
    updateScatterPlot(filteredCommits);
    renderCommitInfo(lines, filteredCommits);
    updateFileDisplay(lines, colors);
  }

  slider.addEventListener('input', () => updateTimeline(timeScale.invert(slider.valueAsNumber)));
  updateTimeline(commits.at(-1).datetime);
  renderStory(commits);

  scrollama()
    .setup({ step: '#scatter-story .step', offset: 0.75 })
    .onStepEnter(({ element }) => {
      const { datetime } = d3.select(element).datum();
      slider.value = timeScale(datetime);
      updateTimeline(datetime, element);
    });
}

try {
  initialize(await loadData());
} catch (error) {
  document.getElementById('commit-progress').disabled = true;
  d3.select('#chart').text('Could not load commit data.');
  console.error(error);
}
