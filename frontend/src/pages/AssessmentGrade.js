import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import './RubricsEditor.css';
import { Callout, Term } from '../components';

const PHP_API_URL = process.env.REACT_APP_PHP_API_URL || 'http://localhost/php';

const LEVEL_LABELS = [
  'Inadequate\n(F, D)',
  'Satisfactory\n(C-, C, C+)',
  'Good\n(B-, B, B+)',
  'Excellent\n(A-, A, A+)'
];

function normalizeFypStage(value = '') {
  const compact = String(value).toUpperCase().replace(/\s+/g, '').replace(/PROJECT/g, 'FYP');
  if (compact.includes('PROPOSAL')) return 'PROPOSAL';
  if (compact.includes('FYP1') || compact === '1') return 'FYP1';
  if (compact.includes('FYP2') || compact === '2') return 'FYP2';
  return compact;
}

function displayFypStage(value = '') {
  const normalized = normalizeFypStage(value);
  if (normalized === 'FYP1') return 'FYP 1';
  if (normalized === 'FYP2') return 'FYP 2';
  if (normalized === 'PROPOSAL') return 'Proposal';
  return value || 'N/A';
}

function normalizeTemplate(raw = {}) {
  const sectionKeys = Array.isArray(raw.section_order) && raw.section_order.length
    ? raw.section_order
    : Object.keys(raw).filter((key) => Array.isArray(raw[key]) && key !== 'clos');

  const section_meta = raw.section_meta || {};
  const next = {
    ...raw,
    section_order: sectionKeys,
    section_meta,
    student: raw.student || {},
    clos: Array.isArray(raw.clos) ? raw.clos : []
  };

  sectionKeys.forEach((key) => {
    const rows = Array.isArray(raw[key]) ? raw[key] : [];
    const meta = section_meta[key] || {};
    const evaluators = Array.isArray(meta.evaluators) && meta.evaluators.length
      ? meta.evaluators
      : rows.some((row) => Object.prototype.hasOwnProperty.call(row, 'm')) ? ['s', 'm'] : ['s'];

    next.section_meta[key] = {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      mark_total: 0,
      total_weight: rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
      evaluators,
      ...meta
    };

    next[key] = rows.map((row) => ({
      item: row.item || '',
      co: row.co || row.po || row.clo || '',
      weight: Number(row.weight) || 0,
      levels: Array.isArray(row.levels) ? [...row.levels, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
      s: Number(row.s) || 0,
      m: Number(row.m) || 0,
      comments: row.comments || ''
    }));
  });

  return next;
}

function sectionSubtotal(rows, evaluators) {
  const totalWeight = rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const sumS = evaluators.includes('s')
    ? rows.reduce((sum, row) => sum + ((Number(row.s) || 0) * (Number(row.weight) || 0)) / 100, 0)
    : 0;
  const sumM = evaluators.includes('m')
    ? rows.reduce((sum, row) => sum + ((Number(row.m) || 0) * (Number(row.weight) || 0)) / 100, 0)
    : 0;

  return { totalWeight, sumS, sumM, sectionTotal: evaluators.includes('m') ? sumS + sumM : sumS };
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseNumberOrZero(value) {
  if (value === '') return 0;
  return parseFloat(value) || 0;
}

function selectZeroValue(e) {
  if (String(e.target.value) === '0') {
    e.target.select();
  }
}

function buildSectionTotals(template, sectionTotals) {
  if (!template) return {};
  return (template.section_order || []).reduce((acc, key) => {
    const meta = template.section_meta?.[key] || {};
    const totals = sectionTotals[key] || {};
    acc[key] = {
      label: meta.label || key,
      mark_total: Number(meta.mark_total) || Number(totals.sectionTotal) || 0,
      total_weight: Number(meta.total_weight) || Number(totals.totalWeight) || 0,
      supervisor_total: Number(totals.sumS) || 0,
      moderator_total: Number(totals.sumM) || 0,
      section_total: Number(totals.sectionTotal) || 0
    };
    return acc;
  }, {});
}

function extractCoCode(value = '') {
  const match = String(value).toUpperCase().match(/CO\s*([0-9]+)/);
  return match ? `CO${match[1]}` : '';
}

function calculateCoAttainment(template) {
  if (!template) return { cos: {}, summary: [] };

  const cos = {};
  (template.section_order || []).forEach((sectionKey) => {
    const meta = template.section_meta?.[sectionKey] || {};
    const evaluators = Array.isArray(meta.evaluators) && meta.evaluators.length ? meta.evaluators : ['s'];
    const sectionLabel = meta.label || sectionKey;

    (template[sectionKey] || []).forEach((row, rowIndex) => {
      const coCode = extractCoCode(row.co || row.clo || row.po || row.item);
      if (!coCode) return;

      const weight = Number(row.weight) || 0;
      const supervisorContribution = evaluators.includes('s') ? ((Number(row.s) || 0) * weight) / 100 : 0;
      const moderatorContribution = evaluators.includes('m') ? ((Number(row.m) || 0) * weight) / 100 : 0;
      const earned = supervisorContribution + moderatorContribution;
      const possible = weight * evaluators.length;

      if (!cos[coCode]) {
        cos[coCode] = { co: coCode, earned: 0, possible: 0, sections: {}, criteria: [] };
      }

      cos[coCode].earned += earned;
      cos[coCode].possible += possible;
      if (!cos[coCode].sections[sectionLabel]) {
        cos[coCode].sections[sectionLabel] = { earned: 0, possible: 0 };
      }
      cos[coCode].sections[sectionLabel].earned += earned;
      cos[coCode].sections[sectionLabel].possible += possible;
      cos[coCode].criteria.push({
        section_key: sectionKey,
        section_label: sectionLabel,
        row_index: rowIndex,
        item: row.item || '',
        mapping: row.co || '',
        weight,
        possible,
        supervisor_mark: Number(row.s) || 0,
        moderator_mark: Number(row.m) || 0,
        earned
      });
    });
  });

  const summary = Object.values(cos)
    .sort((a, b) => a.co.localeCompare(b.co, undefined, { numeric: true }))
    .map((co) => {
      const percentage = co.possible > 0 ? (co.earned / co.possible) * 100 : 0;
      return {
        ...co,
        earned: Number(co.earned.toFixed(2)),
        possible: Number(co.possible.toFixed(2)),
        percentage: Number(percentage.toFixed(2)),
        attained: percentage >= 40,
        attainment_symbol: percentage >= 40 ? '✔' : '✘'
      };
    });

  return { cos, summary };
}


function mergeSavedMarksIntoTemplate(baseTemplate, savedMarksData) {
  if (!baseTemplate || !savedMarksData || typeof savedMarksData !== 'object') {
    return baseTemplate;
  }

  const merged = {
    ...baseTemplate,
    general_comments: savedMarksData.general_comments ?? baseTemplate.general_comments ?? '',
    justification: savedMarksData.justification ?? baseTemplate.justification ?? ''
  };

  (baseTemplate.section_order || []).forEach((sectionKey) => {
    const baseRows = Array.isArray(baseTemplate[sectionKey]) ? baseTemplate[sectionKey] : [];
    const savedRows = Array.isArray(savedMarksData[sectionKey]) ? savedMarksData[sectionKey] : [];

    merged[sectionKey] = baseRows.map((row, rowIndex) => {
      const savedRow = savedRows[rowIndex] || {};
      return {
        ...row,
        s: savedRow.s !== undefined && savedRow.s !== null ? Number(savedRow.s) || 0 : row.s,
        m: savedRow.m !== undefined && savedRow.m !== null ? Number(savedRow.m) || 0 : row.m,
        comments: savedRow.comments !== undefined ? savedRow.comments : (row.comments || '')
      };
    });
  });

  return merged;
}

function AssessmentGrade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const templateId = searchParams.get('templateId');

  const [project, setProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchGradeData = async () => {
      setLoading(true);

      try {
        const [userRes, projectRes, templateRes] = await Promise.all([
          api.get('/user/me/'),
          api.get(`/projects/${projectId}/`),
          fetch(`${PHP_API_URL}/get_template.php?id=${encodeURIComponent(templateId)}`).then((res) => res.json())
        ]);

        const loadedProject = projectRes.data;
        let loadedTemplate = normalizeTemplate(templateRes.template?.data || {});

        const studentId = loadedProject.student_matric_id || String(loadedProject.student || '');
        try {
          // The programme narrows the saved marks to this cohort. Marks are stored
          // per (template, student), and two programmes can now hold a template of
          // the same stage, so without it a lookup could return another cohort's row.
          const marksParams = new URLSearchParams({
            student_id: studentId,
            template_id: templateId,
          });
          if (userRes.data.programme_code) marksParams.set('programme', userRes.data.programme_code);

          const savedMarksRes = await fetch(
            `${PHP_API_URL}/list_marks.php?${marksParams.toString()}`
          ).then((res) => res.json());

          if (savedMarksRes.success && Array.isArray(savedMarksRes.marks) && savedMarksRes.marks.length > 0) {
            const latestSavedMark = savedMarksRes.marks[0];
            loadedTemplate = mergeSavedMarksIntoTemplate(loadedTemplate, latestSavedMark.marks_data);
          }
        } catch (savedErr) {
          console.warn('No saved marks were loaded for this student/template.', savedErr);
        }

        loadedTemplate.student = {
          ...loadedTemplate.student,
          name: loadedProject.student_name || '',
          id: loadedProject.student_matric_id || '',
          supervisor: loadedProject.supervisor_name || '',
          examiner: loadedProject.examiner_name || '',
          project: loadedProject.title || ''
        };
        loadedTemplate.fyp_stage = loadedProject.fyp_stage || loadedTemplate.fyp_stage;

        setCurrentUser(userRes.data);
        setProject(loadedProject);
        setTemplate(loadedTemplate);
      } catch (err) {
        console.error('Failed to load grading data', err);
        alert('Unable to load grading data. Please check that the student and rubric template exist.');
        navigate('/assessment');
      } finally {
        setLoading(false);
      }
    };

    if (projectId && templateId) {
      fetchGradeData();
    } else {
      navigate('/assessment');
    }
  }, [projectId, templateId, navigate]);

  const updateRow = (sectionKey, rowIndex, field, value) => {
    setTemplate((prev) => {
      const rows = [...(prev[sectionKey] || [])];
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [sectionKey]: rows };
    });
  };

  const sectionTotals = useMemo(() => {
    if (!template) return {};

    return template.section_order.reduce((totals, key) => {
      const meta = template.section_meta[key] || { evaluators: ['s'] };
      totals[key] = sectionSubtotal(template[key] || [], meta.evaluators || ['s']);
      return totals;
    }, {});
  }, [template]);

  const grandTotal = useMemo(() => {
    if (!template) return 0;
    return template.section_order.reduce((sum, key) => sum + (sectionTotals[key]?.sectionTotal || 0), 0);
  }, [template, sectionTotals]);

  // Live view of which course outcomes are currently attained, shown in the
  // totals bar so the marker does not have to scroll to the summary.
  const liveAttainment = useMemo(() => {
    if (!template) return { summary: [] };
    return calculateCoAttainment(template);
  }, [template]);

  const attainedCount = liveAttainment.summary.filter((co) => co.attained).length;
  const ungradedRows = useMemo(() => {
    if (!template) return 0;
    return template.section_order.reduce((count, key) => {
      const meta = template.section_meta[key] || { evaluators: ['s'] };
      const evaluators = meta.evaluators || ['s'];
      return count + (template[key] || []).filter((row) => {
        const supervisorBlank = row.s === null || row.s === undefined || row.s === '';
        const moderatorBlank = !evaluators.includes('m') || row.m === null || row.m === undefined || row.m === '';
        return supervisorBlank && moderatorBlank;
      }).length;
    }, 0);
  }, [template]);

  const handleSave = async (status = 'draft') => {
    setSaving(true);

    try {
      const sectionTotalsPayload = buildSectionTotals(template, sectionTotals);
      const coAttainmentPayload = calculateCoAttainment(template);
      const payload = {
        template_id: templateId,
        student_id: project.student_matric_id || String(project.student),
        student_name: project.student_name || '',
        supervisor: project.supervisor_name || '',
        examiner: project.examiner_name || '',
        project_name: project.title || '',
        course: template.course || '',
        fyp_stage: template.fyp_stage || project.fyp_stage || '',
        // Recorded on the mark row so a mark is attributable to a cohort without
        // having to resolve the student's profile later.
        programme: currentUser?.programme_code || '',
        marks_data: {
          ...template,
          section_totals: sectionTotalsPayload,
          co_attainment: coAttainmentPayload
        },
        section_totals: sectionTotalsPayload,
        co_attainment: coAttainmentPayload,
        criterion_marks: coAttainmentPayload.summary.flatMap((co) => co.criteria || []),
        total_score: grandTotal,
        evaluated_by: currentUser?.full_name || currentUser?.username || 'lecturer',
        status
      };

      const response = await fetch(`${PHP_API_URL}/save_mark.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Unable to save marks');

      alert(status === 'submitted' ? 'Marks submitted successfully.' : 'Draft saved successfully.');
    } catch (err) {
      console.error('Failed to save assessment', err);
      alert(err.message || 'Unable to save assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handleJumpToSummary = () => {
    const summary = document.getElementById('assessment-summary-section');
    if (summary) {
      summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading || !template || !project) {
    return <div className="main-content">Loading grading form...</div>;
  }

  return (
    <div className="rubrics-editor-app assessment-grade-page">
      <header className="rubrics-editor-header">
        <div>
          <h1>Assessment - {project.student_name}</h1>
          <p>{displayFypStage(project.fyp_stage)} marking rubric for {project.title}</p>
        </div>
        <div className="controls">
          <button className="ghost" onClick={() => navigate('/assessment')}>Back to Assessment</button>
          <button type="button" onClick={handleJumpToSummary}>Review Summary</button>
        </div>
      </header>

      <main>
        <div className="ui-live-total">
          <div className="ui-live-total-figures">
            <div className="ui-live-total-item">
              <span>Grand total</span>
              <strong>{grandTotal.toFixed(2)}</strong>
            </div>
            <div className="ui-live-total-item">
              <span>Grade</span>
              <strong className="is-grade">{gradeFromMarks(grandTotal)}</strong>
            </div>
            <div className="ui-live-total-item">
              <span>
                <Term tip="Course Outcomes. A CO counts as attained when a student reaches 40% or more for it.">COs</Term> attained
              </span>
              <strong>{attainedCount} / {liveAttainment.summary.length}</strong>
            </div>
            <div className="ui-live-total-item">
              <span>Criteria left blank</span>
              <strong style={{ color: ungradedRows > 0 ? '#b45309' : '#14663a' }}>{ungradedRows}</strong>
            </div>
          </div>
          <button type="button" className="ui-btn is-sm" onClick={handleJumpToSummary}>Review Summary</button>
        </div>

        <Callout tone="plain" title="How to fill this rubric">
          Type a mark from <strong>0 to 100</strong> for each criterion. <Term tip="S = supervisor mark. The lecturer supervising the project enters this.">S</Term> is your
          supervisor column and <Term tip="M = moderator mark. Only shown on sections that are double-marked.">M</Term> the
          moderator column. The <Term tip="Each criterion contributes its weight to the section total; you never calculate this by hand.">weight</Term> is
          applied automatically and the totals bar above updates as you type.
        </Callout>

        <div className="template-card-editor">
          <div className="field wide"><label>Rubric Title</label><input value={template.title || ''} readOnly /></div>
          <div className="field"><label>Course</label><input value={template.course || ''} readOnly /></div>
          <div className="field"><label>FYP Stage</label><input value={displayFypStage(template.fyp_stage)} readOnly /></div>
        </div>

        <div className="meta-form">
          <div><label>Student Name</label><input value={template.student.name || ''} readOnly /></div>
          <div><label>Student ID</label><input value={template.student.id || ''} readOnly /></div>
          <div><label>Supervisor</label><input value={template.student.supervisor || ''} readOnly /></div>
          <div><label>Examiner</label><input value={template.student.examiner || ''} readOnly /></div>
          <div className="span-2"><label>Project Name</label><input value={template.student.project || ''} readOnly /></div>
        </div>

        {template.clos.length > 0 && (
          <table className="clo-table">
            <tbody>
              <tr className="clo-title">
                <td>
                  Course Learning Outcomes (CLOs)
                </td>
              </tr>
              {template.clos.map((clo, index) => (
                <tr key={index}><td>{clo}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {template.section_order.map((sectionKey) => {
          const rows = template[sectionKey] || [];
          const meta = template.section_meta[sectionKey] || { label: sectionKey, evaluators: ['s'] };
          const evaluators = meta.evaluators || ['s'];
          const subtotal = sectionTotals[sectionKey] || { totalWeight: 0, sumS: 0, sumM: 0, sectionTotal: 0 };
          const colSpan = evaluators.includes('m') ? 10 : 9;

          return (
            <section className="rubrics-section" key={sectionKey}>
              <div className="sheet-wrap">
                <table className="sheet multi-section-sheet">
                  <thead>
                    <tr className="section-title-row">
                      <td colSpan={colSpan}>{meta.label} ({meta.mark_total || 0}%)</td>
                    </tr>
                    <tr>
                      <th>Items</th>
                      <th>CLO Mapping</th>
                      <th>Weight</th>
                      {LEVEL_LABELS.map((label) => <th key={label}>{label.split('\n').map((part) => <span key={part}>{part}<br /></span>)}</th>)}
                      <th>S<br />(0-100)</th>
                      {evaluators.includes('m') && <th>M<br />(0-100)</th>}
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={`${sectionKey}-${rowIndex}`}>
                        <td>{row.item}</td>
                        <td>{row.co}</td>
                        <td>{row.weight}</td>
                        {[0, 1, 2, 3].map((levelIndex) => <td key={levelIndex}>{row.levels?.[levelIndex] || ''}</td>)}
                        <td><input type="number" min="0" max="100" className="mark-input" value={row.s ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateRow(sectionKey, rowIndex, 's', clamp(parseNumberOrZero(e.target.value), 0, 100))} /></td>
                        {evaluators.includes('m') && <td><input type="number" min="0" max="100" className="mark-input" value={row.m ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateRow(sectionKey, rowIndex, 'm', clamp(parseNumberOrZero(e.target.value), 0, 100))} /></td>}
                        <td><textarea value={row.comments || ''} onChange={(e) => updateRow(sectionKey, rowIndex, 'comments', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="sum-row">
                      <td>Section subtotal</td>
                      <td></td>
                      <td>{subtotal.totalWeight.toFixed(2)}</td>
                      <td colSpan="4"></td>
                      <td>{subtotal.sumS.toFixed(2)}</td>
                      {evaluators.includes('m') && <td>{subtotal.sumM.toFixed(2)}</td>}
                      <td>Total: {subtotal.sectionTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}

        <div className="summary-grid" id="assessment-summary-section">
          <div className="summary-box">
            <h3>Assessment Summary</h3>
            <table>
              <tbody>
                {template.section_order.map((key) => (
                  <tr key={key}><td>{template.section_meta[key]?.label || key}</td><td>{(sectionTotals[key]?.sectionTotal || 0).toFixed(2)}</td></tr>
                ))}
                <tr className="grand-total"><td>Grand Total</td><td>{grandTotal.toFixed(2)} ({gradeFromMarks(grandTotal)})</td></tr>
              </tbody>
            </table>
          </div>
          <div className="summary-box">
            <h3>General Comments</h3>
            <textarea value={template.general_comments || ''} onChange={(e) => setTemplate((prev) => ({ ...prev, general_comments: e.target.value }))} placeholder="Enter overall comments here." />
          </div>
        </div>

        <div className="assessment-bottom-actions">
          <div>
            <h3>Ready to save this assessment?</h3>
            <p>Use Save Draft if you want to continue later, or Submit Marks when the grading is complete.</p>
          </div>
          <div className="assessment-bottom-buttons">
            <button className="ghost" onClick={() => handleSave('draft')} disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button onClick={() => handleSave('submitted')} disabled={saving}>
              {saving ? 'Saving...' : 'Submit Marks'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AssessmentGrade;
