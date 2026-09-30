import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import './TeammateLecturer.css';
import { Term } from '../components';

const PHP_API_URL = process.env.REACT_APP_PHP_API_URL || 'http://localhost/php';

const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
const STATUS_ORDER = ['Pass', 'Fail', 'I', 'XA', 'XB', 'XM', 'W'];

function normalizeFypStage(value = '') {
  const compact = String(value).toUpperCase().replace(/\s+/g, '').replace(/PROJECT/g, 'FYP');
  if (compact.includes('FYP1') || compact === '1') return 'FYP1';
  if (compact.includes('FYP2') || compact === '2') return 'FYP2';
  return compact;
}

function displayFypStage(value = '') {
  const normalized = normalizeFypStage(value);
  if (normalized === 'FYP1') return 'FYP 1';
  if (normalized === 'FYP2') return 'FYP 2';
  return value || 'N/A';
}

function stageClass(value = '') {
  return normalizeFypStage(value).toLowerCase();
}

function gradeFromMarks(mark) {
  const score = Number(mark) || 0;
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 75) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 65) return 'B';
  if (score >= 60) return 'B-';
  if (score >= 55) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 45) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

function normalizeStatus(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'PASS' || raw === 'PASSED') return 'Pass';
  if (raw === 'FAIL' || raw === 'FAILED') return 'Fail';
  if (['I', 'XA', 'XB', 'XM', 'W'].includes(raw)) return raw;
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function crc32(str) {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i += 1) {
    let byte = str.charCodeAt(i);
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function writeUInt16(value) {
  return String.fromCharCode(value & 0xff, (value >>> 8) & 0xff);
}

function writeUInt32(value) {
  return String.fromCharCode(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeZip(files) {
  let offset = 0;
  let localParts = '';
  let centralParts = '';
  const { time, date } = dosDateTime();

  files.forEach(({ name, content }) => {
    const crc = crc32(content);
    const size = content.length;
    const localHeader = [
      writeUInt32(0x04034b50),
      writeUInt16(20), writeUInt16(0), writeUInt16(0),
      writeUInt16(time), writeUInt16(date),
      writeUInt32(crc), writeUInt32(size), writeUInt32(size),
      writeUInt16(name.length), writeUInt16(0),
      name
    ].join('');

    const centralHeader = [
      writeUInt32(0x02014b50),
      writeUInt16(20), writeUInt16(20), writeUInt16(0), writeUInt16(0),
      writeUInt16(time), writeUInt16(date),
      writeUInt32(crc), writeUInt32(size), writeUInt32(size),
      writeUInt16(name.length), writeUInt16(0), writeUInt16(0),
      writeUInt16(0), writeUInt16(0), writeUInt32(0), writeUInt32(offset),
      name
    ].join('');

    localParts += localHeader + content;
    centralParts += centralHeader;
    offset += localHeader.length + size;
  });

  const end = [
    writeUInt32(0x06054b50),
    writeUInt16(0), writeUInt16(0),
    writeUInt16(files.length), writeUInt16(files.length),
    writeUInt32(centralParts.length), writeUInt32(offset),
    writeUInt16(0)
  ].join('');

  return localParts + centralParts + end;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sheetXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.map((row, rIdx) => `<row r="${rIdx + 1}">${row.map((cell, cIdx) => {
      const col = columnName(cIdx + 1);
      const isNumber = typeof cell === 'number' && Number.isFinite(cell);
      if (isNumber) return `<c r="${col}${rIdx + 1}"><v>${cell}</v></c>`;
      return `<c r="${col}${rIdx + 1}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join('')}</row>`).join('')}
  </sheetData>
</worksheet>`;
}

function columnName(index) {
  let name = '';
  while (index > 0) {
    const mod = (index - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    index = Math.floor((index - mod) / 26);
  }
  return name;
}

function workbookXml(sheetNames) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}
  </sheets>
</workbook>`;
}

function workbookRelsXml(count) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${Array.from({ length: count }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
</Relationships>`;
}

function contentTypesXml(sheetCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}


function toBinaryString(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return binary;
}

function downloadXlsx(filename, sheets) {
  const sheetNames = sheets.map((sheet) => sheet.name);
  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(sheetNames) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet.rows) }))
  ].map((file) => ({ ...file, content: toBinaryString(file.content) }));
  const zipContent = makeZip(files);
  const bytes = new Uint8Array(zipContent.length);
  for (let i = 0; i < zipContent.length; i += 1) bytes[i] = zipContent.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function extractCoCode(value = '') {
  const match = String(value).toUpperCase().match(/CO\s*([0-9]+)/);
  return match ? `CO${match[1]}` : '';
}

function sortCoCodes(codes) {
  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function sectionKeyToLabel(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeSectionName(label = '') {
  const text = String(label || '').toLowerCase();
  if (text.includes('presentation')) return 'Presentation';
  if (text.includes('prototype')) return 'Prototype Outcome';
  if (text.includes('brochure')) return 'Brochure';
  if (text.includes('project outcome')) return 'Project Outcome';
  if (text.includes('sv') || text.includes('supervisor evaluation')) return 'SV Evaluation';
  if (text.includes('report') || text.includes('thesis')) return 'Report';
  return label || 'Other';
}

function getSectionTotalsFromMark(mark) {
  if (mark?.section_totals && Object.keys(mark.section_totals).length > 0) return mark.section_totals;
  const data = mark?.marks_data || {};
  if (data.section_totals && Object.keys(data.section_totals).length > 0) return data.section_totals;

  const totals = {};
  const sectionOrder = Array.isArray(data.section_order) ? data.section_order : [];
  sectionOrder.forEach((sectionKey) => {
    const rows = Array.isArray(data[sectionKey]) ? data[sectionKey] : [];
    const meta = data.section_meta?.[sectionKey] || {};
    const evaluators = Array.isArray(meta.evaluators) && meta.evaluators.length ? meta.evaluators : ['s'];
    const sumS = rows.reduce((sum, row) => sum + (evaluators.includes('s') ? ((Number(row.s) || 0) * (Number(row.weight) || 0)) / 100 : 0), 0);
    const sumM = rows.reduce((sum, row) => sum + (evaluators.includes('m') ? ((Number(row.m) || 0) * (Number(row.weight) || 0)) / 100 : 0), 0);
    totals[sectionKey] = {
      label: meta.label || sectionKeyToLabel(sectionKey),
      mark_total: Number(meta.mark_total) || sumS + sumM,
      total_weight: Number(meta.total_weight) || rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
      supervisor_total: Number(sumS.toFixed(2)),
      moderator_total: Number(sumM.toFixed(2)),
      section_total: Number((sumS + sumM).toFixed(2))
    };
  });
  return totals;
}

function getCoAttainmentFromMark(mark) {
  const existing = mark?.co_attainment?.summary || mark?.marks_data?.co_attainment?.summary;
  if (Array.isArray(existing) && existing.length > 0) return existing;

  const data = mark?.marks_data || {};
  const cos = {};
  const sectionOrder = Array.isArray(data.section_order) ? data.section_order : [];

  sectionOrder.forEach((sectionKey) => {
    const rows = Array.isArray(data[sectionKey]) ? data[sectionKey] : [];
    const meta = data.section_meta?.[sectionKey] || {};
    const sectionLabel = meta.label || sectionKeyToLabel(sectionKey);
    const evaluators = Array.isArray(meta.evaluators) && meta.evaluators.length ? meta.evaluators : ['s'];

    rows.forEach((row) => {
      const co = extractCoCode(row.co || row.clo || row.po || row.item);
      if (!co) return;
      const weight = Number(row.weight) || 0;
      const earned = (evaluators.includes('s') ? ((Number(row.s) || 0) * weight) / 100 : 0)
        + (evaluators.includes('m') ? ((Number(row.m) || 0) * weight) / 100 : 0);
      const possible = weight * evaluators.length;
      if (!cos[co]) cos[co] = { co, earned: 0, possible: 0, sections: {} };
      if (!cos[co].sections[sectionLabel]) cos[co].sections[sectionLabel] = { earned: 0, possible: 0 };
      cos[co].earned += earned;
      cos[co].possible += possible;
      cos[co].sections[sectionLabel].earned += earned;
      cos[co].sections[sectionLabel].possible += possible;
    });
  });

  return sortCoCodes(Object.keys(cos)).map((co) => {
    const item = cos[co];
    const percentage = item.possible > 0 ? (item.earned / item.possible) * 100 : 0;
    return {
      ...item,
      earned: Number(item.earned.toFixed(2)),
      possible: Number(item.possible.toFixed(2)),
      percentage: Number(percentage.toFixed(2)),
      attained: percentage >= 40,
      attainment_symbol: percentage >= 40 ? '✔' : '✘'
    };
  });
}

function SimpleBarChart({ data }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="report-chart-box">
      <h3>Grade Distribution</h3>
      <p className="ui-sub">How many students fall into each grade band. Taller bars mean more students.</p>
      <div className="grade-bar-chart">
        {data.map((item) => (
          <div className="grade-bar-item" key={item.label}>
            <div className="grade-bar-value">{item.count}</div>
            <div className="grade-bar-track">
              <div className="grade-bar-fill" style={{ height: `${Math.max((item.count / max) * 100, item.count ? 8 : 0)}%` }} />
            </div>
            <div className="grade-bar-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let current = 0;
  const palette = ['#198754', '#dc3545', '#ffc107', '#0d6efd', '#6f42c1', '#20c997', '#6c757d'];
  const segments = data.map((item, index) => {
    const start = current;
    const angle = total ? (item.count / total) * 360 : 0;
    current += angle;
    return `${palette[index % palette.length]} ${start}deg ${current}deg`;
  });

  return (
    <div className="report-chart-box">
      <h3>Student Status</h3>
      <p className="ui-sub">Pass, Fail and the other status codes, for students who have been marked.</p>
      <div className="status-pie-layout">
        <div className="status-pie" style={{ background: total ? `conic-gradient(${segments.join(', ')})` : '#edf2f7' }}>
          <span>{total}</span>
        </div>
        <div className="status-legend">
          {data.map((item, index) => (
            <div key={item.label} className="status-legend-row">
              <span className="legend-dot" style={{ backgroundColor: palette[index % palette.length] }} />
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoAttainmentChart({ data }) {
  const max = 100;
  return (
    <div className="report-chart-box co-attainment-card">
      <h3>CO Attainment Rate</h3>
      <p className="ui-sub">Share of marked students who reached 40% or more for each course outcome.</p>
      <div className="co-attainment-bars">
        {data.length === 0 ? (
          <p>No CO data available yet.</p>
        ) : data.map((item) => (
          <div className="co-attainment-row" key={item.co}>
            <span>{item.co}</span>
            <div className="co-attainment-track">
              <div className="co-attainment-fill" style={{ width: `${Math.min(item.rate, max)}%` }} />
            </div>
            <strong>{item.rate.toFixed(0)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoursePerformanceReport() {
  const [projects, setProjects] = useState([]);
  const [marks, setMarks] = useState([]);
  const [selectedStage, setSelectedStage] = useState('FYP1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError('');

      try {
        const [projectsRes, marksRes] = await Promise.all([
          api.get('/projects/'),
          fetch(`${PHP_API_URL}/list_marks.php`).then((res) => res.json())
        ]);

        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
        setMarks(marksRes.success ? marksRes.marks || [] : []);
      } catch (err) {
        console.error('Failed to load course performance report', err);
        setError('Unable to load report data. Please check the Django API and PHP backend.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

  const rows = useMemo(() => {
    const latestMarksByStudent = new Map();

    marks.forEach((mark) => {
      const studentId = String(mark.student_id || '').trim();
      if (!studentId) return;

      const existing = latestMarksByStudent.get(studentId);
      const existingDate = existing ? new Date(existing.updated_at || existing.evaluated_at || 0).getTime() : 0;
      const nextDate = new Date(mark.updated_at || mark.evaluated_at || 0).getTime();
      if (!existing || nextDate >= existingDate) latestMarksByStudent.set(studentId, mark);
    });

    return projects
      .filter((project) => normalizeFypStage(project.fyp_stage) === selectedStage)
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
      .map((project, index) => {
        const studentId = String(project.student_matric_id || project.student || '').trim();
        const mark = latestMarksByStudent.get(studentId);
        const rawMarksData = mark?.marks_data || {};
        const sectionTotals = mark ? getSectionTotalsFromMark(mark) : {};
        const coAttainment = mark ? getCoAttainmentFromMark(mark) : [];
        const totalScore = mark ? Number(mark.total_score || 0) : null;
        const grade = mark ? gradeFromMarks(totalScore) : '';
        const statusOverride = normalizeStatus(rawMarksData.overall_status || rawMarksData.student_status || rawMarksData.report_status);
        const overallStatus = statusOverride || (mark ? (totalScore >= 40 ? 'Pass' : 'Fail') : 'I');

        return {
          no: index + 1,
          studentId: project.student_matric_id || 'N/A',
          studentName: project.student_name || mark?.student_name || 'N/A',
          projectTitle: project.title || mark?.project_name || 'N/A',
          supervisor: project.supervisor_name || mark?.supervisor || 'N/A',
          fypStage: displayFypStage(project.fyp_stage || mark?.fyp_stage),
          course: mark?.course || rawMarksData.course || (selectedStage === 'FYP1' ? 'CSS3714 Final Year Project I' : 'CSS3724 Final Year Project II'),
          sectionTotals,
          coAttainment,
          totalScore,
          grade,
          overallStatus,
          markStatus: mark?.status || 'not graded',
          updatedAt: mark?.updated_at || ''
        };
      });
  }, [projects, marks, selectedStage]);

  const sectionColumns = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      Object.entries(row.sectionTotals || {}).forEach(([key, value]) => {
        const label = normalizeSectionName(value.label || sectionKeyToLabel(key));
        if (!seen.has(label)) seen.set(label, { key: label, label });
      });
    });
    return [...seen.values()];
  }, [rows]);

  const coColumns = useMemo(() => {
    const codes = new Set();
    rows.forEach((row) => row.coAttainment.forEach((co) => codes.add(co.co)));
    return sortCoCodes([...codes]);
  }, [rows]);

  const coSummary = useMemo(() => {
    return coColumns.map((coCode) => {
      const gradedRows = rows.filter((row) => row.totalScore !== null);
      const attained = gradedRows.filter((row) => row.coAttainment.find((co) => co.co === coCode)?.attained).length;
      const notAttained = gradedRows.filter((row) => {
        const co = row.coAttainment.find((item) => item.co === coCode);
        return co && !co.attained;
      }).length;
      const available = gradedRows.filter((row) => row.coAttainment.some((co) => co.co === coCode)).length;
      return {
        co: coCode,
        rate: available > 0 ? (attained / available) * 100 : 0,
        attained,
        notAttained,
        available
      };
    });
  }, [coColumns, rows]);

  const gradeDistribution = useMemo(() => {
    return GRADE_ORDER.map((grade) => ({
      label: grade,
      count: rows.filter((row) => row.grade === grade).length
    }));
  }, [rows]);

  const statusDistribution = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      label: status,
      count: rows.filter((row) => row.overallStatus === status).length
    }));
  }, [rows]);

  const passCount = rows.filter((row) => row.overallStatus === 'Pass').length;
  const failCount = rows.filter((row) => row.overallStatus === 'Fail').length;
  const gradedCount = rows.filter((row) => row.totalScore !== null).length;

  const getSectionValue = (row, label) => {
    const match = Object.values(row.sectionTotals || {}).find((section) => normalizeSectionName(section.label) === label);
    return match ? Number(match.section_total || 0) : null;
  };

  const buildExportData = (useSymbolAttainment = false) => {
    const reportTitle = selectedStage === 'FYP1' ? 'CSS3714 Final Year Project I' : 'CSS3724 Final Year Project II';
    const generatedAt = new Date().toLocaleString();
    const attainmentValue = (attained) => {
      if (attained === null || attained === undefined) return '';
      if (useSymbolAttainment) return attained ? '✓' : '✗';
      return attained ? 'Attained' : 'Not Attained';
    };

    const markHeader = ['No.', 'Name', 'ID No.', ...sectionColumns.map((section) => section.label), 'Total', 'Status', 'Grade', 'Overall Status'];
    const marksRows = [
      ['Course Performance Report'],
      ['Course, Code:', reportTitle],
      ['Lecturer:', 'Khairunnisa Ibrahim'],
      ['Generated At:', generatedAt],
      [],
      ['Marks'],
      markHeader,
      ...rows.map((row) => [
        row.no,
        row.studentName,
        row.studentId,
        ...sectionColumns.map((section) => {
          const value = getSectionValue(row, section.label);
          return value === null ? '' : Number(value.toFixed(2));
        }),
        row.totalScore === null ? '' : Number(row.totalScore.toFixed(2)),
        row.overallStatus === 'Pass' ? 'Pass' : row.overallStatus === 'Fail' ? 'Fail' : row.overallStatus,
        row.grade,
        row.overallStatus
      ])
    ];

    const coHeader = ['No.', 'Name', 'ID No.'];
    coColumns.forEach((co) => {
      sectionColumns.forEach((section) => coHeader.push(`${co} ${section.label}`));
      coHeader.push(`${co} Total`, `${co} Attainment`);
    });
    coHeader.push('Overall Attainment');

    const coRows = [
      ['Course Outcome Attainment of selected course.'],
      ['Course, Code:', reportTitle],
      ['Lecturer:', 'Khairunnisa Ibrahim'],
      ['Generated At:', generatedAt],
      [],
      ['COs'],
      coHeader,
      ...rows.map((row) => {
        const values = [row.no, row.studentName, row.studentId];
        coColumns.forEach((coCode) => {
          const co = row.coAttainment.find((item) => item.co === coCode);
          sectionColumns.forEach((section) => {
            const sectionData = co?.sections?.[section.label];
            values.push(sectionData ? Number(Number(sectionData.earned || 0).toFixed(2)) : '');
          });
          values.push(
            co ? Number(Number(co.earned || 0).toFixed(2)) : '',
            co ? attainmentValue(co.attained) : ''
          );
        });
        const allAttained = row.coAttainment.length > 0 && row.coAttainment.every((co) => co.attained);
        values.push(row.coAttainment.length === 0 ? '' : attainmentValue(allAttained));
        return values;
      }),
      [],
      ['Attainment Rate / CO'],
      ['CO', 'Attainment Rate', 'Students Attained', 'Students Not Attained', 'Total Marked Students'],
      ...coSummary.map((item) => [item.co, `${item.rate.toFixed(2)}%`, item.attained, item.notAttained, item.available])
    ];

    const summaryRows = [
      ['Course Performance Report Summary'],
      ['Course, Code:', reportTitle],
      ['Lecturer:', 'Khairunnisa Ibrahim'],
      ['Generated At:', generatedAt],
      [],
      ['Overall Summary'],
      ['Total Students', rows.length],
      ['Total Marked Students', gradedCount],
      ['Pass', passCount],
      ['Fail', failCount],
      [],
      ['Grade Distribution'],
      ['Grade', 'No. of Students'],
      ...gradeDistribution.map((item) => [item.label, item.count]),
      [],
      ['Student Status Distribution'],
      ['Status', 'No. of Students'],
      ...statusDistribution.map((item) => [item.label, item.count]),
      [],
      ['CO Attainment Summary'],
      ['CO', 'Attainment Rate', 'Students Attained', 'Students Not Attained', 'Total Marked Students'],
      ...coSummary.map((item) => [item.co, `${item.rate.toFixed(2)}%`, item.attained, item.notAttained, item.available])
    ];

    return { reportTitle, marksRows, coRows, summaryRows };
  };

  const handleDownloadCsv = () => {
    const { marksRows, coRows, summaryRows } = buildExportData(false);
    const csvRows = [...marksRows, [], ...coRows, [], ...summaryRows];
    downloadCsv(`course-performance-report-${selectedStage.toLowerCase()}-cpr-style.csv`, csvRows);
  };

  const handleDownloadXlsx = () => {
    const { marksRows, coRows, summaryRows } = buildExportData(true);
    downloadXlsx(`course-performance-report-${selectedStage.toLowerCase()}-cpr-style.xlsx`, [
      { name: 'Marks', rows: marksRows },
      { name: 'COs', rows: coRows },
      { name: 'Summary', rows: summaryRows }
    ]);
  };

  return (
    <div className="main-content course-report-page">
      <header>
        <h1>Course Performance Report</h1>
        <p className="ui-page-subtitle">
          Marks, grade distribution, student status and <Term tip="Course Outcomes. A CO is attained when a student reaches 40% or more for it.">CO</Term> attainment
          for one FYP stage at a time. Only marks that have been saved by a lecturer appear here.
        </p>
      </header>

      <div className="card report-toolbar-card">
        <div className="filters-wrapper report-filters-wrapper">
          <div className="course-filter-container">
            <span>Course Report: </span>
            {[{ code: 'FYP 1', value: 'FYP1' }, { code: 'FYP 2', value: 'FYP2' }].map((stage) => (
              <button
                key={stage.value}
                className={`course-filter-btn ${selectedStage === stage.value ? 'active' : ''}`}
                onClick={() => setSelectedStage(stage.value)}
              >
                {stage.code}
              </button>
            ))}
          </div>
          <div className="report-export-actions">
            <button className="btn btn-view" onClick={handleDownloadCsv} disabled={loading || rows.length === 0}>
              Download CSV
            </button>
            <button className="btn btn-review" onClick={handleDownloadXlsx} disabled={loading || rows.length === 0}>
              Download XLSX
            </button>
          </div>
        </div>
      </div>

      <div className="report-summary-grid">
        <div className="report-summary-card"><span>Total Students</span><strong>{rows.length}</strong></div>
        <div className="report-summary-card">
          <span>Graded</span><strong>{gradedCount}</strong>
          <small>{rows.length - gradedCount} still awaiting marks</small>
        </div>
        <div className="report-summary-card"><span>Pass</span><strong>{passCount}</strong></div>
        <div className="report-summary-card"><span>Fail</span><strong>{failCount}</strong></div>
      </div>

      <div className="report-chart-grid">
        <SimpleBarChart data={gradeDistribution} />
        <StatusPieChart data={statusDistribution} />
      </div>

      <CoAttainmentChart data={coSummary} />

      <div className="card">
        <div className="report-table-header">
          <div>
            <h2>Status &amp; Grade of Students</h2>
            <p>
              {selectedStage === 'FYP1' ? 'CSS3714 Final Year Project I' : 'CSS3724 Final Year Project II'}
            </p>
          </div>
        </div>

        <div className="report-table-scroll">
          <table className="course-report-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>ID No.</th>
                <th>Project Title</th>
                <th>Supervisor</th>
                <th>FYP Stage</th>
                {sectionColumns.map((section) => <th key={section.key}>{section.label}</th>)}
                <th>Total Marks</th>
                <th>Grade</th>
                <th>Overall Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" style={{ textAlign: 'center' }}>Loading report...</td></tr>
              ) : error ? (
                <tr><td colSpan="12" style={{ textAlign: 'center', color: '#842029' }}>{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="12" style={{ textAlign: 'center' }}>No students found for the selected FYP stage.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.studentId}-${row.no}`}>
                    <td>{row.no}</td>
                    <td>{row.studentName}</td>
                    <td style={{ fontWeight: 600 }}>{row.studentId}</td>
                    <td>{row.projectTitle}</td>
                    <td>{row.supervisor}</td>
                    <td><span className={`fyp-stage-tag fyp-stage-${stageClass(row.fypStage)}`}>{row.fypStage}</span></td>
                    {sectionColumns.map((section) => {
                      const value = getSectionValue(row, section.label);
                      return <td key={section.key}>{value === null ? '-' : value.toFixed(2)}</td>;
                    })}
                    <td>{row.totalScore === null ? '—' : row.totalScore.toFixed(2)}</td>
                    <td>
                      {row.grade
                        ? <strong>{row.grade}</strong>
                        : <span className="ui-badge is-neutral" title="No marks have been saved for this student yet.">Not graded</span>}
                    </td>
                    <td>
                      <span className={`status report-status-${String(row.overallStatus).toLowerCase()}`}>
                        {row.overallStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="report-table-header">
          <div>
            <h2>CO Attainment Summary</h2>
            <p>
              Course Outcome Attainment of selected course.
            </p>
          </div>
        </div>
        <table className="co-summary-table">
          <thead>
            <tr>
              <th>CO</th>
              <th>Attainment Rate</th>
              <th>Students Attained</th>
              <th>Students Not Attained</th>
              <th>Total Marked Students</th>
            </tr>
          </thead>
          <tbody>
            {coSummary.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No CO attainment data available yet.</td></tr>
            ) : coSummary.map((item) => (
              <tr key={item.co}>
                <td><strong>{item.co}</strong></td>
                <td>{item.rate.toFixed(2)}%</td>
                <td>{item.attained}</td>
                <td>{item.notAttained}</td>
                <td>{item.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CoursePerformanceReport;
