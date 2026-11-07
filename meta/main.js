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

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);