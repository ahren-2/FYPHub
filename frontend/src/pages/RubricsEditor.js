import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { Callout } from '../components';
import './RubricsEditor.css';

const PHP_API_URL = process.env.REACT_APP_PHP_API_URL || 'http://localhost/php';

const LEVEL_LABELS = [
  'Inadequate\n(F, D)',
  'Satisfactory\n(C-, C, C+)',
  'Good\n(B-, B, B+)',
  'Excellent\n(A-, A, A+)'
];

const DEFAULT_CLOS = [
  'CO1: Acknowledge the continuous development of knowledge and the needs of self-upgrading.',
  'CO2: Define the objectives of a research.',
  'CO3: Compare reviews on previous research.',
  'CO4: Carry out methodology to collect data for conducting research.',
  'CO5: Prepare the schedule of a research.',
  'CO6: Produce a research proposal.'
];

const DEFAULT_TEMPLATE = {
  title: '',
  course: '',
  fyp_stage: '',
  student: { name: '', id: '', supervisor: '', examiner: '', project: '' },
  clos: DEFAULT_CLOS,
  section_order: ['presentation', 'project_outcome'],
  section_meta: {
    presentation: {
      label: 'Presentation',
      mark_total: 26,
      total_weight: 13,
      evaluators: ['s', 'm'],
      compilation: 'Supervisor (S) marks /100*weight + Moderator (M) marks/100 * weight'
    },
    project_outcome: {
      label: 'Project Outcome',
      mark_total: 25,
      total_weight: 12.5,
      evaluators: ['s', 'm'],
      compilation: 'Supervisor (S) marks /100*weight + Moderator (M) marks/100 * weight'
    }
  },
  presentation: [],
  project_outcome: [],
  justification: '',
  general_comments: ''
};

function emptyRow(evaluators = ['s', 'm']) {
  const next = {
    item: 'New criterion',
    co: '',
    weight: 1,
    levels: ['', '', '', ''],
    comments: ''
  };
  if (evaluators.includes('s')) next.s = 0;
  if (evaluators.includes('m')) next.m = 0;
  return next;
}

function normalizeRow(row, evaluators) {
  const normalized = {
    item: row.item || '',
    co: row.co || row.po || row.clo || '',
    weight: Number(row.weight) || 0,
    levels: Array.isArray(row.levels) ? [...row.levels, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
    comments: row.comments || ''
  };
  if (evaluators.includes('s')) normalized.s = Number(row.s) || 0;
  if (evaluators.includes('m')) normalized.m = Number(row.m) || 0;
  return normalized;
}

function normalizeTemplate(raw = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
  const merged = { ...base, ...raw };

  merged.student = { ...base.student, ...(raw.student || {}) };
  merged.clos = Array.isArray(raw.clos) && raw.clos.length ? raw.clos : base.clos;
  merged.section_meta = { ...(raw.section_meta || {}) };

  const detectedKeys = Object.keys(raw).filter((key) => Array.isArray(raw[key]));
  const orderedKeys = Array.isArray(raw.section_order) && raw.section_order.length
    ? raw.section_order.filter((key) => detectedKeys.includes(key) || merged.section_meta[key])
    : [
        'presentation',
        'project_outcome',
        'prototype_outcome',
        'brochure',
        'sv_evaluation',
        'report',
        ...detectedKeys.filter((key) => !['presentation', 'project_outcome', 'prototype_outcome', 'brochure', 'sv_evaluation', 'report', 'clos'].includes(key))
      ].filter((key, index, arr) => arr.indexOf(key) === index && Array.isArray(raw[key]));

  merged.section_order = orderedKeys.length ? orderedKeys : base.section_order;

  merged.section_order.forEach((key) => {
    const existingRows = Array.isArray(raw[key]) ? raw[key] : [];
    const oldDefaultMeta = base.section_meta[key] || {};
    const meta = {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      mark_total: 0,
      total_weight: existingRows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
      evaluators: existingRows.some((row) => Object.prototype.hasOwnProperty.call(row, 'm')) ? ['s', 'm'] : ['s'],
      compilation: '',
      ...oldDefaultMeta,
      ...(raw.section_meta?.[key] || {})
    };
    if (!Array.isArray(meta.evaluators) || meta.evaluators.length === 0) meta.evaluators = ['s', 'm'];
    merged.section_meta[key] = meta;
    merged[key] = existingRows.map((row) => normalizeRow(row, meta.evaluators));
  });

  return merged;
}

function sectionSubtotal(rows, evaluators) {
  const totalWeight = rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const sumS = evaluators.includes('s')
    ? rows.reduce((sum, row) => sum + ((Number(row.s) || 0) * (Number(row.weight) || 0)) / 100, 0)
    : 0;
  const sumM = evaluators.includes('m')
    ? rows.reduce((sum, row) => sum + ((Number(row.m) || 0) * (Number(row.weight) || 0)) / 100, 0)
    : 0;
  const sectionTotal = evaluators.includes('m') ? sumS + sumM : sumS;
  return { totalWeight, sumS, sumM, sectionTotal };
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

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `section_${Date.now()}`;
}

function RubricsEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawTemplateId = searchParams.get('id');
  const templateId = rawTemplateId && rawTemplateId.trim() !== '' ? rawTemplateId.trim() : null;
  const isEditMode = templateId !== null;
  // Which programme the template being edited belongs to. A template is saved
  // under one programme: that is what decides which cohort is marked against it,
  // and which programme's Active slot it can occupy. The Rubrics page carries it
  // through, but it is only a seed — the authoritative value is fixed below.
  const programmeFromUrl = (searchParams.get('programme') || '').trim();

  const [template, setTemplate] = useState(() => normalizeTemplate(DEFAULT_TEMPLATE));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  // The signed-in coordinator's own programme. Rubrics are kept per programme,
  // so this is the only programme they may save one under. `known` records
  // whether the answer actually arrived, which is different from an account that
  // simply has no programme: nothing is pinned until the answer is in.
  const [ownProgramme, setOwnProgramme] = useState('');
  const [ownProgrammeKnown, setOwnProgrammeKnown] = useState(false);
  // The programme the loaded template is stored under: '' means shared, and null
  // means "not loaded yet", which is a distinction the lock below depends on.
  const [loadedProgramme, setLoadedProgramme] = useState(isEditMode ? null : '');
  // Set when the link points at a rubric owned by a different programme.
  const [lockedOut, setLockedOut] = useState(false);
  // Blank means "shared template", which any programme may adopt as its active
  // rubric. That is the only null the schema treats as meaningful.
  const [programmeCode, setProgrammeCode] = useState(programmeFromUrl);

  useEffect(() => {
    const fetchOwnProgramme = async () => {
      try {
        const meRes = await api.get('/user/me/');
        setOwnProgramme((meRes.data?.programme_code || '').trim());
        setOwnProgrammeKnown(true);
      } catch (error) {
        console.error('Could not read the signed-in programme:', error);
      }
    };
    fetchOwnProgramme();
  }, []);

  // The programme is pinned here rather than chosen. A new template belongs to
  // the coordinator's own programme (or Shared, if they deliberately pick it); an
  // existing one keeps the programme it already has. A rubric owned by another
  // programme is refused outright instead of being quietly re-homed into this
  // one, which is what a programme dropdown used to allow.
  useEffect(() => {
    if (!ownProgrammeKnown) return;
    if (!isEditMode) {
      setProgrammeCode(ownProgramme);
      return;
    }
    if (loadedProgramme === null) return;
    if (loadedProgramme === '' || loadedProgramme === ownProgramme) {
      setProgrammeCode(loadedProgramme);
    } else {
      setLockedOut(true);
    }
  }, [ownProgramme, ownProgrammeKnown, loadedProgramme, isEditMode]);

  useEffect(() => {
    // The null check is inline rather than reading `isEditMode`, which is derived
    // from `templateId` in the same render — referencing it here would add a
    // dependency that changes nothing while tripping the exhaustive-deps rule.
    if (templateId) loadTemplate(templateId);
  }, [templateId]);

  const loadTemplate = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`${PHP_API_URL}/get_template.php?id=${encodeURIComponent(id)}`);
      const result = await response.json();
      if (result.success && result.template) {
        // Read off the server, not the URL: this is what the lock above checks,
        // so a hand-edited link cannot claim another programme's rubric.
        setLoadedProgramme((result.template.programme_code || '').trim());
        setTemplate(normalizeTemplate(result.template.data || {}));
      } else {
        alert(`Failed to load template: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Error loading template');
    } finally {
      setLoading(false);
    }
  };

  const sectionTotals = useMemo(() => {
    const totals = {};
    template.section_order.forEach((key) => {
      const meta = template.section_meta[key] || { evaluators: ['s', 'm'] };
      totals[key] = sectionSubtotal(template[key] || [], meta.evaluators || ['s', 'm']);
    });
    return totals;
  }, [template]);

  const grandTotal = useMemo(
    () => template.section_order.reduce((sum, key) => sum + (sectionTotals[key]?.sectionTotal || 0), 0),
    [template.section_order, sectionTotals]
  );

  const updateTemplateField = (field, value) => {
    setTemplate((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'course' && value === 'CDM3413 Academic Research Fundamental') {
        next.fyp_stage = 'Proposal';
      }
      return next;
    });
  };

  const updateStudentField = (field, value) => {
    setTemplate((prev) => ({ ...prev, student: { ...prev.student, [field]: value } }));
  };

  const updateClo = (index, value) => {
    setTemplate((prev) => {
      const clos = [...prev.clos];
      clos[index] = value;
      return { ...prev, clos };
    });
  };

  const updateSectionMeta = (key, field, value) => {
    setTemplate((prev) => ({
      ...prev,
      section_meta: {
        ...prev.section_meta,
        [key]: { ...prev.section_meta[key], [field]: value }
      }
    }));
  };

  const updateSectionEvaluators = (key, value) => {
    const evaluators = value === 's' ? ['s'] : ['s', 'm'];
    setTemplate((prev) => {
      const rows = (prev[key] || []).map((row) => normalizeRow(row, evaluators));
      return {
        ...prev,
        [key]: rows,
        section_meta: {
          ...prev.section_meta,
          [key]: { ...prev.section_meta[key], evaluators }
        }
      };
    });
  };

  const updateRow = (sectionKey, index, field, value) => {
    setTemplate((prev) => {
      const rows = [...(prev[sectionKey] || [])];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, [sectionKey]: rows };
    });
  };

  const updateLevel = (sectionKey, rowIndex, levelIndex, value) => {
    setTemplate((prev) => {
      const rows = [...(prev[sectionKey] || [])];
      const levels = [...(rows[rowIndex].levels || ['', '', '', ''])];
      levels[levelIndex] = value;
      rows[rowIndex] = { ...rows[rowIndex], levels };
      return { ...prev, [sectionKey]: rows };
    });
  };

  const addRow = (sectionKey) => {
    setTemplate((prev) => {
      const evaluators = prev.section_meta[sectionKey]?.evaluators || ['s', 'm'];
      return { ...prev, [sectionKey]: [...(prev[sectionKey] || []), emptyRow(evaluators)] };
    });
  };

  const deleteRow = (sectionKey, rowIndex) => {
    setTemplate((prev) => {
      const rows = [...(prev[sectionKey] || [])];
      if (rows.length <= 1) return prev;
      rows.splice(rowIndex, 1);
      return { ...prev, [sectionKey]: rows };
    });
  };

  const addSection = () => {
    const label = window.prompt('New section name, e.g. Poster / Demonstration');
    if (!label) return;
    const key = slugify(label);
    if (template.section_order.includes(key)) {
      alert('A section with this name already exists.');
      return;
    }
    setTemplate((prev) => ({
      ...prev,
      section_order: [...prev.section_order, key],
      section_meta: {
        ...prev.section_meta,
        [key]: {
          label,
          mark_total: 0,
          total_weight: 0,
          evaluators: ['s', 'm'],
          compilation: 'Supervisor (S) marks /100*weight + Moderator (M) marks/100 * weight'
        }
      },
      [key]: [emptyRow(['s', 'm'])]
    }));
  };

  const deleteSection = (sectionKey) => {
    if (!window.confirm('Delete this section?')) return;
    setTemplate((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      const nextMeta = { ...next.section_meta };
      delete nextMeta[sectionKey];
      next.section_meta = nextMeta;
      next.section_order = next.section_order.filter((key) => key !== sectionKey);
      return next;
    });
  };

  const handleReset = () => {
    if (window.confirm('Confirm to reset this editor?')) {
      setTemplate(normalizeTemplate(DEFAULT_TEMPLATE));
    }
  };

  const handleSave = async () => {
    if (!template.title.trim()) {
      alert('Please enter a Rubric Title before saving');
      return;
    }

    if (!template.course || !template.course.trim()) {
      alert('Please select a Course before saving');
      return;
    }

    if (!template.fyp_stage || !template.fyp_stage.trim()) {
      alert('Please select a FYP Stage before saving');
      return;
    }

    setSaving(true);
    const totals = {};
    template.section_order.forEach((key) => {
      const subtotal = sectionTotals[key];
      totals[`${key}_S`] = subtotal.sumS.toFixed(2);
      if ((template.section_meta[key]?.evaluators || []).includes('m')) {
        totals[`${key}_M`] = subtotal.sumM.toFixed(2);
      }
      totals[`${key}_total`] = subtotal.sectionTotal.toFixed(2);
    });
    totals.grand_total = grandTotal.toFixed(2);

    // The programme is clamped one last time on the way out. An existing template
    // keeps the programme it was loaded with; a new one may only be this
    // coordinator's own programme or shared. Anything else collapses to shared,
    // so no route into this page — including a hand-edited link — can file a
    // rubric under a programme that is not yours.
    const payloadProgramme = isEditMode
      ? (loadedProgramme || '')
      : (programmeCode && programmeCode === ownProgramme ? ownProgramme : '');

    const payload = {
      ...template,
      totals,
      // Stored inside the template JSON and, for a new template, written to
      // `rubrics_templates.programme_id` by save_template.php. An empty value
      // marks the template as shared rather than unassigned.
      programme: payloadProgramme,
    };

    if (isEditMode) payload.id = templateId;

    try {
      const url = isEditMode ? `${PHP_API_URL}/update_template.php` : `${PHP_API_URL}/save_template.php`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        showToast('Template saved successfully!', 'success');
        setTimeout(() => navigate('/rubrics'), 1200);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `rubrics-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const selectZeroValue = (e) => {
    if (String(e.target.value) === '0') {
      e.target.select();
    }
  };

  const parseNumberOrZero = (value) => {
    if (value === '') return 0;
    return parseFloat(value) || 0;
  };

  if (loading) {
    return <div className="rubrics-editor-app"><h2>Loading template...</h2></div>;
  }

  // Reached only by opening a link to another programme's rubric — the Rubrics
  // page no longer offers one. Nothing is loaded for editing, so there is no
  // risk of saving over a cohort's rubric by accident.
  if (lockedOut) {
    return (
      <div className="rubrics-editor-app">
        <header className="rubrics-editor-header">
          <div>
            <h1>Rubrics Editor</h1>
            <p className="ui-page-subtitle">This rubric belongs to another programme.</p>
          </div>
          <div className="controls">
            <button onClick={() => navigate('/rubrics')}>Back to Marking Rubrics</button>
          </div>
        </header>
        <main>
          <Callout tone="plain" title="Each programme edits only its own rubrics">
            This template is kept by <strong>{loadedProgramme}</strong>, and rubrics are marked
            against the programme that owns them — editing another programme's rubric would change
            how its students are graded. Your own programme's templates, and any shared ones, are on
            the Marking Rubrics page.
          </Callout>
        </main>
      </div>
    );
  }

  return (
    <div className="rubrics-editor-app">
      <header className="rubrics-editor-header">
        <div>
          <h1>Rubrics Editor</h1>
          <p className="ui-page-subtitle">
            {isEditMode
              ? 'Editing an existing template. Changes apply the next time a lecturer opens this rubric.'
              : 'Building a new template. Add sections and criteria, then save — you can set it active from the Marking Rubrics page.'}
          </p>
        </div>
        <div className="controls">
          <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (isEditMode ? 'Update Rubrics' : 'Save Rubrics')}</button>
          <button onClick={addSection} className="ghost">+ Section</button>
          <button onClick={handleReset} className="ghost">Reset</button>
        </div>
      </header>

      <main>
        <div className="editor-guidance-card edit-legend-card">
          <div className="edit-guide-copy">
            <strong>Rubric Editing Guide</strong>
            <p>Fields with a coloured background can be edited directly. Click inside the field, type your changes, then save the rubric.</p>
          </div>
        </div>

        <div className="template-card-editor">
          <div className="field wide admin-edit-field">
            <label>Rubric Title</label>
            <input value={template.title} onChange={(e) => updateTemplateField('title', e.target.value)} placeholder="Please Fill in Rubric Title" />
          </div>
          <div className="field admin-edit-field">
            <label>Course</label>
            <select
              value={template.course || ''}
              onChange={(e) => updateTemplateField('course', e.target.value)}
              className="rubric-select rubric-course-select"
            >
              <option value="" disabled hidden>Select Course</option>
              <option value="CSS3714 Final Year Project I">CSS3714 Final Year Project I</option>
              <option value="CSS3724 Final Year Project II">CSS3724 Final Year Project II</option>
              <option value="BID3516 Design Research Project 1">BID3516 Design Research Project 1</option>
              <option value="BID3616 Design Research Project 2">BID3616 Design Research Project 2</option>
              <option value="CDM3413 Academic Research Fundamental">CDM3413 Academic Research Fundamental</option>
              <option value="CDM3516 Research Project 1">CDM3516 Research Project 1</option>
              <option value="CDM3616 Research Project 2">CDM3616 Research Project 2</option>
              <option value="CMD3516 Final Year Project I">CMD3516 Final Year Project I</option>
              <option value="CMD3616 Final Year Project II">CMD3616 Final Year Project II</option>
            </select>
          </div>
          <div className="field admin-edit-field">
            <label>FYP Stage</label>
            <select
              value={template.fyp_stage || ''}
              onChange={(e) => updateTemplateField('fyp_stage', e.target.value)}
              className="rubric-select rubric-stage-select"
            >
              <option value="" disabled hidden>Select FYP Stage</option>
              <option value="FYP1">FYP1</option>
              <option value="FYP2">FYP2</option>
              <option value="Proposal">Proposal</option>
            </select>
          </div>

          {/* Which programme the template is saved under. It is not a picker:
              the only choices are the coordinator's own programme and Shared,
              because a rubric belongs to the cohort it marks. */}
          <div className="field wide admin-edit-field">
            <label htmlFor="rubric-programme">Programme</label>
            {isEditMode ? (
              <div className="rubric-programme-locked" id="rubric-programme">
                {loadedProgramme ? (
                  <>
                    <span className="rubric-programme-chip">{loadedProgramme}</span>
                    <span className="rubric-programme-locked-note">this rubric's programme</span>
                  </>
                ) : (
                  <>
                    <span className="rubric-programme-chip is-shared">Shared</span>
                    <span className="rubric-programme-locked-note">usable by any programme</span>
                  </>
                )}
              </div>
            ) : (
              <select
                id="rubric-programme"
                value={programmeCode}
                onChange={(e) => setProgrammeCode(e.target.value)}
                className="rubric-select"
              >
                {ownProgramme && (
                  <option value={ownProgramme}>{ownProgramme} — your programme</option>
                )}
                <option value="">Shared — any programme may use it</option>
              </select>
            )}
            <p className="ui-hint is-tight" style={{ marginTop: '6px' }}>
              {isEditMode
                ? (loadedProgramme
                  ? `A rubric stays with the programme it was created for, so it cannot be moved to another one. `
                    + `Your changes affect how ${loadedProgramme} students are marked.`
                  : 'This template is shared: any programme that has adopted it is affected by your changes.')
                : (programmeCode
                  ? `Saved under ${programmeCode}. Only a lecturer in ${programmeCode} sees this rubric.`
                  : 'Saved as Shared: every programme can see and adopt it, but no programme has it '
                    + 'active until one of them sets it.')}
            </p>
          </div>
        </div>

        <div className="meta-form">
          <div><label>Student Name</label><input value={template.student.name} onChange={(e) => updateStudentField('name', e.target.value)} placeholder="Please Fill in Student Name" /></div>
          <div><label>Student ID</label><input value={template.student.id} onChange={(e) => updateStudentField('id', e.target.value)} placeholder="Please Fill in Student ID" /></div>
          <div><label>Supervisor</label><input value={template.student.supervisor} onChange={(e) => updateStudentField('supervisor', e.target.value)} placeholder="Please Fill in Supervisor Name" /></div>
          <div><label>Examiner</label><input value={template.student.examiner} onChange={(e) => updateStudentField('examiner', e.target.value)} placeholder="Please Fill in Examiner Name" /></div>
          <div className="span-2"><label>Project Name</label><input value={template.student.project} onChange={(e) => updateStudentField('project', e.target.value)} placeholder="Please Fill in Project Name" /></div>
        </div>

        <div className="clo-edit-panel">
          <div className="clo-edit-header">
            <div>
              <h3>Course Learning Outcomes (CLOs)</h3>
              <p>Modify CLO details below. Rows below are editable; click onto any existing wording to update it.</p>
            </div>
          </div>
          <table className="clo-table">
            <tbody>
            {template.clos.map((clo, index) => (
              <tr key={index}>
                <td className="editable-cell clo-editable-cell" contentEditable suppressContentEditableWarning title="Click to modify this CLO" onBlur={(e) => updateClo(index, e.currentTarget.textContent)}>{clo}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>

        {template.section_order.map((sectionKey) => {
          const rows = template[sectionKey] || [];
          const meta = template.section_meta[sectionKey] || { label: sectionKey, evaluators: ['s', 'm'] };
          const evaluators = meta.evaluators || ['s', 'm'];
          const subtotal = sectionTotals[sectionKey] || { totalWeight: 0, sumS: 0, sumM: 0, sectionTotal: 0 };
          const colSpan = evaluators.includes('m') ? 11 : 10;

          return (
            <section className="rubrics-section" key={sectionKey}>
              <div className="section-toolbar">
                <div className="section-meta-grid">
                  <div className="field editable-field-wrapper"><label>Section Title</label><input value={meta.label || ''} onChange={(e) => updateSectionMeta(sectionKey, 'label', e.target.value)} /></div>
                  <div className="field admin-edit-field"><label>Section % / Marks</label><input type="number" step="0.1" value={meta.mark_total ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateSectionMeta(sectionKey, 'mark_total', parseNumberOrZero(e.target.value))} /></div>
                  <div className="field admin-edit-field"><label>Evaluator Columns</label><select value={evaluators.includes('m') ? 'sm' : 's'} onChange={(e) => updateSectionEvaluators(sectionKey, e.target.value)}><option value="sm">Supervisor + Moderator</option><option value="s">Supervisor only</option></select></div>
                </div>
                <div className="controls">
                  <button className="ghost" onClick={() => addRow(sectionKey)}>+ Row</button>
                  <button className="ghost danger" onClick={() => deleteSection(sectionKey)}>Delete Section</button>
                </div>
              </div>

              <div className="compilation-line editable-field-wrapper">
                <label>Mark Compilation</label>
                <input value={meta.compilation || ''} onChange={(e) => updateSectionMeta(sectionKey, 'compilation', e.target.value)} placeholder="Supervisor (S) marks /100*weight + Moderator (M) marks/100 * weight" />
              </div>

              {(() => {
                const sectionMarks = Number(meta.mark_total) || 0;
                const weightTotal = subtotal.totalWeight;
                const mismatch = Math.abs(weightTotal - sectionMarks) > 0.01;
                return (
                  <div className={`ui-weight-check ${mismatch ? 'is-warn' : 'is-ok'}`} role="status">
                    <span className="ui-badge-dot" aria-hidden="true" />
                    {mismatch ? (
                      <>
                        Criteria weights total <strong>{weightTotal.toFixed(2)}%</strong> but the section is worth{' '}
                        <strong>{sectionMarks}%</strong> — adjust the weights or the section marks so they match.
                      </>
                    ) : (
                      <>Criteria weights match the section marks ({sectionMarks}%).</>
                    )}
                  </div>
                );
              })()}

              <div className="section-edit-hint">
                <strong>Editable section:</strong> Click onto the coloured cells to add or change its details. Section totals are calculated automatically.
              </div>

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
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={`${sectionKey}-${rowIndex}`}>
                        <td className="editable-cell" contentEditable suppressContentEditableWarning title="Click to edit item name" onBlur={(e) => updateRow(sectionKey, rowIndex, 'item', e.currentTarget.textContent)}>{row.item}</td>
                        <td className="editable-cell mapping-cell" contentEditable suppressContentEditableWarning title="Click to edit CLO/CO mapping" onBlur={(e) => updateRow(sectionKey, rowIndex, 'co', e.currentTarget.textContent)}>{row.co}</td>
                        <td><input type="number" step="0.1" className="weight-input mark-entry-input" value={row.weight ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateRow(sectionKey, rowIndex, 'weight', parseNumberOrZero(e.target.value))} /></td>
                        {[0, 1, 2, 3].map((levelIndex) => (
                          <td key={levelIndex} className="editable-cell rubric-level-cell" contentEditable suppressContentEditableWarning title="Click to edit performance description" onBlur={(e) => updateLevel(sectionKey, rowIndex, levelIndex, e.currentTarget.textContent)}>{row.levels?.[levelIndex] || ''}</td>
                        ))}
                        <td><input type="number" min="0" max="100" className="mark-input mark-entry-input" value={row.s ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateRow(sectionKey, rowIndex, 's', clamp(parseNumberOrZero(e.target.value), 0, 100))} /></td>
                        {evaluators.includes('m') && <td><input type="number" min="0" max="100" className="mark-input mark-entry-input" value={row.m ?? 0} onFocus={selectZeroValue} onClick={selectZeroValue} onChange={(e) => updateRow(sectionKey, rowIndex, 'm', clamp(parseNumberOrZero(e.target.value), 0, 100))} /></td>}
                        <td className="editable-cell comments-editable-cell" contentEditable suppressContentEditableWarning title="Click to edit comments" onBlur={(e) => updateRow(sectionKey, rowIndex, 'comments', e.currentTarget.textContent)}>{row.comments}</td>
                        <td><button className="tiny danger" onClick={() => deleteRow(sectionKey, rowIndex)}>Remove</button></td>
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
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}

        <div className="summary-grid">
          <div className="summary-box">
            <h3>Rubrics Summary</h3>
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
            <h3>Justification / General Comments</h3>
            <textarea value={template.general_comments || ''} onChange={(e) => updateTemplateField('general_comments', e.target.value)} placeholder="Enter overall justification or comments here." />
          </div>
        </div>

        <div className="grade-scale">
          <strong>Grade scale:</strong> 0 F | 40 D | 45 C- | 50 C | 55 C+ | 60 B- | 65 B | 70 B+ | 75 A- | 80 A | 90 A+
        </div>
      </main>
    </div>
  );
}

export default RubricsEditor;
