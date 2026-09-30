import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Rubrics.css";
import { Callout, EmptyState } from "../components";

const PHP_API_URL = process.env.REACT_APP_PHP_API_URL || "http://localhost/php";

function Rubrics() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  const normalizeFypStage = (value = '') => {
    const compact = String(value).toUpperCase().replace(/\s+/g, '').replace(/PROJECT/g, 'FYP');
    if (compact.includes('PROPOSAL')) return 'PROPOSAL';
    if (compact.includes('FYP1') || compact === '1') return 'FYP1';
    if (compact.includes('FYP2') || compact === '2') return 'FYP2';
    return '';
  };

  const displayFypStage = (value = '') => {
    const normalized = normalizeFypStage(value);
    if (normalized === 'FYP1') return 'FYP 1';
    if (normalized === 'FYP2') return 'FYP 2';
    if (normalized === 'PROPOSAL') return 'Proposal';
    return 'Unknown FYP Stage';
  };

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${PHP_API_URL}/list_templates.php`);
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.templates);
      } else {
        console.error("Failed to fetch templates");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const response = await fetch(`${PHP_API_URL}/delete_template.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Template deleted successfully!");
        fetchTemplates(); // Refresh list
      } else {
        alert("Error: " + data.message);
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template");
    } finally {
      setMenuOpen(null);
    }
  };

  const handleRename = async (templateId) => {
    if (!newName.trim()) {
      alert("Template name cannot be empty");
      return;
    }

    try {
      const response = await fetch(`${PHP_API_URL}/rename_template.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId, title: newName }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Template renamed successfully!");
        fetchTemplates(); // Refresh list
        setRenameId(null);
        setNewName("");
      } else {
        alert("Error: " + data.message);
      }
    } catch (error) {
      console.error("Error renaming template:", error);
      alert("Failed to rename template");
    }
  };

  const handleSetActive = async (template) => {
    const stage = normalizeFypStage(template.fyp_stage || template.title);

    if (!stage) {
      alert('Unable to detect whether this template is for FYP 1, FYP 2, or Proposal. Please update the FYP Stage field in the Rubrics Editor first.');
      setMenuOpen(null);
      return;
    }

    const currentActive = templates.find((item) => item.active_for_stage === stage);
    const stageLabel = displayFypStage(stage);

    let message = `Set "${template.title}" as the active rubric for ${stageLabel}?\n\nLecturers will use this rubric when grading ${stageLabel} students.`;

    if (currentActive && currentActive.id !== template.id) {
      message = `There is already an active rubric for ${stageLabel}:\n"${currentActive.title}"\n\nDo you want to replace it with:\n"${template.title}"?`;
    } else if (currentActive && currentActive.id === template.id) {
      alert(`This template is already the active rubric for ${stageLabel}.`);
      setMenuOpen(null);
      return;
    }

    if (!window.confirm(message)) {
      setMenuOpen(null);
      return;
    }

    try {
      const response = await fetch(`${PHP_API_URL}/set_active_template.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          fyp_stage: stage,
          updated_by: 'coordinator'
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`${stageLabel} active rubric updated successfully.`);
        fetchTemplates();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error setting active rubric:', error);
      alert('Failed to set active rubric.');
    } finally {
      setMenuOpen(null);
    }
  };

  const handleEditTemplate = (templateId) => {
    // Navigate to React editor with template ID (string VARCHAR)
    navigate(`/rubrics-editor?id=${encodeURIComponent(templateId)}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const toggleMenu = (templateId) => {
    setMenuOpen(menuOpen === templateId ? null : templateId);
  };

  const getActiveRank = (template) => {
    const activeStage = normalizeFypStage(template.active_for_stage);
    if (activeStage === 'FYP1') return 1;
    if (activeStage === 'FYP2') return 2;
    if (activeStage === 'PROPOSAL') return 3;
    return 4; // Non-active templates get lowest priority
  };

  const sortedTemplates = [...templates].sort((a, b) => {
    const rankA = getActiveRank(a);
    const rankB = getActiveRank(b);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });

  return (
    <div className="rubrics">
      <h1>Marking Rubrics</h1>
      <p className="ui-page-subtitle">
        A rubric is the marking template lecturers use. Each FYP stage — FYP 1, FYP 2 and Proposal — keeps one
        <strong> active</strong> template, and that is the one that opens when a lecturer presses Grade.
      </p>

      <Callout tone="plain" title="Editing a template changes future marking">
        Marks already saved keep the values they were given, but any student graded after your change uses the new
        criteria and weights. Set the updated template active only when you are happy with it.
      </Callout>

      {/* Create New Template Button */}
      <button 
        onClick={() => navigate('/rubrics-editor')} 
        className="create-template-btn"
        style={{ border: 'none' }}
        data-testid="create-template-btn"
      >
        <span className="plus">+</span>
        Create New Template
      </button>

      {/* Available Templates Section */}
      <div className="templates-section">
        <h2>Available Templates</h2>
        <p className="ui-hint" style={{ marginTop: 0, marginBottom: '18px' }}>
          {templates.length} template{templates.length === 1 ? '' : 's'}. Use the ⋮ menu on a card to rename it, set
          it active, or delete it.
        </p>

        {loading ? (
          <p>Loading templates...</p>
        ) : templates.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No marking templates yet"
            message="Create a template for each FYP stage, then set one active per stage so lecturers can grade."
          >
            <button className="create-template-btn" style={{ border: 'none' }} onClick={() => navigate('/rubrics-editor')}>
              Create your first template
            </button>
          </EmptyState>
        ) : (
          <div className="templates-row">
            {sortedTemplates.map((template) => (
              <div
                key={template.id}
                className={`template-card ${
                  normalizeFypStage(template.active_for_stage) === 'FYP1'
                    ? 'active-rubric-card active-rubric-fyp1'
                    : normalizeFypStage(template.active_for_stage) === 'FYP2'
                    ? 'active-rubric-card active-rubric-fyp2'
                    : normalizeFypStage(template.active_for_stage) === 'PROPOSAL'
                    ? 'active-rubric-card active-rubric-proposal'
                    : ''
                }`}
              >
                {template.active_for_stage && (
                  <span
                    className={`active-rubric-badge ${
                      normalizeFypStage(template.active_for_stage) === 'FYP2'
                        ? 'active-rubric-badge-fyp2'
                        : normalizeFypStage(template.active_for_stage) === 'PROPOSAL'
                        ? 'active-rubric-badge-proposal'
                        : 'active-rubric-badge-fyp1'
                    }`}
                  >
                    Active {displayFypStage(template.active_for_stage)}
                  </span>
                )}
                <div className="card-header">
                  <div style={{ position: "relative" }}>
                    <div
                      className="vertical-ellipse"
                      onClick={() => toggleMenu(template.id)}
                    >
                      ⋮
                    </div>
                    
                    {/* Dropdown Menu */}
                    {menuOpen === template.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "25px",
                          right: "0",
                          background: "white",
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          zIndex: 10,
                          minWidth: "120px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setRenameId(template.id);
                            setNewName(template.title);
                            setMenuOpen(null);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 16px",
                            border: "none",
                            background: "transparent",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "#1f2937",
                            fontSize: "14px",
                          }}
                          onMouseEnter={(e) => (e.target.style.background = "#f5f5f5")}
                          onMouseLeave={(e) => (e.target.style.background = "transparent")}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleSetActive(template)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 16px",
                            border: "none",
                            background: "transparent",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "#1f2937",
                            fontSize: "14px",
                          }}
                          onMouseEnter={(e) => (e.target.style.background = "#f5f5f5")}
                          onMouseLeave={(e) => (e.target.style.background = "transparent")}
                        >
                          Set as Active Rubric
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 16px",
                            border: "none",
                            background: "transparent",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "#e74c3c",
                            fontSize: "14px",
                          }}
                          onMouseEnter={(e) => (e.target.style.background = "#f5f5f5")}
                          onMouseLeave={(e) => (e.target.style.background = "transparent")}
                          data-testid={`delete-btn-${template.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Template Name (editable if rename mode) */}
                {renameId === template.id ? (
                  <div style={{ margin: "16px 0" }}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        fontSize: "16px",
                        border: "1px solid #4a90e2",
                        borderRadius: "4px",
                      }}
                      autoFocus
                    />
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleRename(template.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#4a90e2",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setRenameId(null);
                          setNewName("");
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "#ddd",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="template-name">{template.title}</div>
                )}

                <div className="template-stage">
                  Template Stage: {displayFypStage(template.fyp_stage || template.title)}
                </div>

                <div className="template-date">
                  Last modified: {formatDate(template.updated_at)}
                </div>

                <button
                  className="edit-btn"
                  onClick={() => handleEditTemplate(template.id)}
                >
                  Edit Template
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close menu when clicking outside */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
          }}
        />
      )}
    </div>
  );
}

export default Rubrics;
