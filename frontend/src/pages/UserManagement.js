// --- File: src/pages/UserManagement.js (Feature-Enhanced & Translated Version) ---
import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiEdit2, FiTrash2 } from 'react-icons/fi';
import api from '../api';
import './TeammateCoordinator.css'; // Your base styles
import './UserManagement.css';     // Import dedicated styles for the new layout
import { Callout, EmptyState, Legend } from '../components';

const ROLE_OPTIONS = [
    { value: 'student', label: 'Student' },
    { value: 'lecturer', label: 'Lecturer' },
    { value: 'coordinator', label: 'Coordinator' },
];

// The role buttons above the table. "Administrators" is offered to an
// administrator only: an administrator's account holds no programme, so for
// anyone else that filter can only ever come back empty.
const ROLE_FILTERS = [
    { value: '', label: 'All' },
    { value: 'student', label: 'Students' },
    { value: 'lecturer', label: 'Lecturers' },
    { value: 'coordinator', label: 'Coordinators' },
    { value: 'admin', label: 'Administrators', adminsOnly: true },
];

// Not offered in the role picker by default: an administrator account is the
// handover account, and granting the role is an administrator-only action on the
// server too. It is added to the list only when it is the account's current role
// (so the value round-trips) or when an administrator is the one signed in.
const ADMIN_ROLE_OPTION = { value: 'admin', label: 'Administrator' };

const FYP_STAGE_OPTIONS = [
    { value: 'FYP1', label: 'FYP 1' },
    { value: 'FYP2', label: 'FYP 2' },
    { value: 'PROPOSAL', label: 'Proposal' },
];

const emptyForm = {
    full_name: '',
    username: '',
    email: '',
    role: 'student',
    programme: '',
    programme_label: '',
    student_id_no: '',
    // The value the account held when the edit form opened, kept so the form can
    // tell the coordinator that changing it moves the number everywhere the
    // student is matched by it, not just on this screen.
    loaded_student_id_no: '',
    phone_no: '',
    password: '',
    fyp_stage: 'FYP1',
    current_password: '',
};

/** The show/hide control used next to every password on this page. */
function EyeToggle({ visible, onToggle, label }) {
    return (
        <button
            type="button"
            className="password-toggle"
            onClick={onToggle}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={visible}
            title={visible ? 'Hide password' : 'Show password'}
        >
            {visible ? <FiEyeOff /> : <FiEye />}
        </button>
    );
}

/** Turn a DRF error response into one readable message. */
function describeApiError(err) {
    const data = err?.response?.data;
    if (!data) return 'Something went wrong. Please try again.';
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.detail) return data.detail;

    const lines = Object.entries(data).map(([field, value]) => {
        const text = Array.isArray(value) ? value.join(' ') : String(value);
        return `${field.replace(/_/g, ' ')}: ${text}`;
    });
    return lines.join('\n') || 'Something went wrong. Please try again.';
}

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    // A failed request used to be swallowed into the console, so the table fell
    // through to "No accounts match these filters" and the page blamed the
    // filters for a server problem. The message is kept so it can be shown.
    const [loadError, setLoadError] = useState('');
    const [roleFilter, setRoleFilter] = useState(''); // '', 'student', 'lecturer'
    const [programmeFilter, setProgrammeFilter] = useState(''); // '' = every programme

    // State for the upload functionality
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // The programmes this coordinator may file accounts under. Loaded from the
    // server rather than hard-coded so the list cannot drift from the database.
    const [programmes, setProgrammes] = useState([]);

    // Create / edit profile form
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showDetailPassword, setShowDetailPassword] = useState(false);
    // The signed-in account, not just its id: the page behaves differently for a
    // coordinator (their cohort, and the coordinator-access transfer) and for an
    // administrator (every cohort, and nothing but this screen).
    const [me, setMe] = useState(null);

    const isEdit = formMode === 'edit';
    const isStudentForm = formData.role === 'student';
    // An administrator is not attached to a cohort, because there is nothing for
    // it to be scoped to — it looks after accounts in all of them. So the
    // programme is optional (and shown as such) for that role only.
    const isAdminForm = formData.role === 'admin';
    const currentUserId = me ? me.id : null;
    const signedInRole = me ? me.role : '';
    const isSignedInAdmin = signedInRole === 'admin';
    const isSignedInCoordinator = signedInRole === 'coordinator';

    // What the role picker offers: the three course roles, plus Administrator
    // when the account already holds it or the signed-in user may grant it.
    const roleOptions = (
        isAdminForm || isSignedInAdmin ? [...ROLE_OPTIONS, ADMIN_ROLE_OPTION] : ROLE_OPTIONS
    );

    // An account can legitimately sit on a programme the selectable list hides,
    // because the list drops the legacy 'General'/'None' rows. Without this the
    // select would find no matching option, fall back to showing the first
    // programme, and silently move the account there on save.
    const userProgrammeIsLegacy = Boolean(
        isEdit
        && formData.programme
        && !programmes.some((programme) => String(programme.id) === String(formData.programme))
    );

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const params = {};
            if (roleFilter) {
                params['profile__role'] = roleFilter;
            }
            const res = await api.get('/users/', { params });
            // A plain list is what this endpoint returns today. `results` is
            // accepted too, so switching pagination on later cannot silently
            // turn every account into an empty table again.
            const rows = Array.isArray(res.data) ? res.data : res.data?.results;
            if (!Array.isArray(rows)) {
                setUsers([]);
                setLoadError('The server did not return a list of accounts.');
                return;
            }
            setUsers(rows);
        } catch (err) {
            console.error("Failed to fetch user list:", err);
            setUsers([]);
            setLoadError(describeApiError(err));
        } finally {
            setLoading(false);
        }
    }, [roleFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Filtered in the browser rather than by the API: the endpoint only filters
    // on `profile__role`, and the list is already loaded in full. This keeps the
    // programme filter usable while the list spans every programme.
    const visibleUsers = programmeFilter
        ? users.filter((user) => String(user.programme_id) === programmeFilter)
        : users;

    const hasFilters = Boolean(roleFilter || programmeFilter);

    const clearFilters = () => {
        setRoleFilter('');
        setProgrammeFilter('');
    };

    // Names the filters in plain English, for the "nothing matches" message.
    const programmeFilterLabel = (() => {
        if (!programmeFilter) return '';
        const match = programmes.find((programme) => String(programme.id) === programmeFilter);
        return match
            ? `${match.name}${match.code ? ` (${match.code})` : ''}`
            : 'that programme';
    })();

    const activeFilterSummary = [
        roleFilter
            ? (ROLE_FILTERS.find((option) => option.value === roleFilter)?.label || roleFilter)
            : '',
        programmeFilterLabel,
    ].filter(Boolean).join(' + ');

    // Fetched once: the available programmes do not change while this page is
    // open, so there is no reason to re-request them per form open.
    useEffect(() => {
        const fetchProgrammes = async () => {
            try {
                const res = await api.get('/programmes/');
                setProgrammes(res.data);
            } catch (err) {
                console.error("Failed to fetch programmes:", err);
            }
        };
        fetchProgrammes();
    }, []);

    // Needed to know which row is "you", so your own Delete button can be
    // disabled rather than failing on the server, and to know which role is
    // looking at the page.
    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const res = await api.get('/user/me/');
                setMe(res.data);
            } catch (err) {
                console.error("Failed to fetch the signed-in user:", err);
            }
        };
        fetchCurrentUser();
    }, []);

    /* The server refuses these too; disabling the button just makes it obvious
       before the click. */
    const deleteBlockedReason = (user) => {
        if (user.id === currentUserId) {
            return 'You cannot delete your own account.';
        }
        if (user.is_superuser || user.role === 'coordinator' || user.role === 'admin') {
            return 'Coordinator and administrator accounts cannot be deleted here.';
        }
        return '';
    };

    const handleUpload = async () => {
        if (!file) return alert("Please select an Excel file.");
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'students');

        setUploading(true);
        try {
            await api.post('/upload-excel/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Upload successful! User accounts have been created.");
            setFile(null);
            setShowUploadModal(false); // Close the modal
            setRoleFilter(''); // Reset filter to see all new users
        } catch (err) {
            alert("Upload failed. Please ensure the file format is correct and includes the necessary columns.");
        } finally { 
            setUploading(false);
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (window.confirm(`Are you sure you want to delete the user ${userName}? This action cannot be undone.`)) {
            try {
                await api.delete(`/users/${userId}/`);
                // On success remove it from the front-end state directly; that avoids a fresh API request and feels smoother
                setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
            } catch (err) {
                alert(describeApiError(err) || "Delete failed.");
            }
        }
    };

    // [NEW] Function that opens the details modal
    const handleViewDetails = (user) => {
        setSelectedUser(user);
        // Never leave a revealed password on screen for the next account.
        setShowDetailPassword(false);
        setIsDetailModalOpen(true);
    };

    // Open the "Create User" form
    const openCreateForm = () => {
        setFormMode('create');
        setEditingUserId(null);
        // Pre-select the only programme a coordinator can file accounts under,
        // so the common case needs no interaction and the field is never blank.
        setFormData({ ...emptyForm, programme: programmes[0] ? String(programmes[0].id) : '' });
        setFormError('');
        setShowNewPassword(false);
        setShowCurrentPassword(false);
        setIsFormModalOpen(true);
    };

    // Open the "Edit Profile" form and fill in the existing details
    const openEditForm = (user) => {
        setFormMode('edit');
        setEditingUserId(user.id);
        setFormData({
            full_name: user.full_name || '',
            username: user.username || '',
            email: user.email || '',
            role: user.role || 'student',
            programme: user.programme_id
                ? String(user.programme_id)
                // An administrator is not filed under a cohort and must not be
                // given one by the form's default, or saving an unrelated edit
                // would quietly attach it to whichever programme is first.
                : (user.role === 'admin' ? '' : (programmes[0] ? String(programmes[0].id) : '')),
            // Kept so a hidden legacy programme can still be named in the select.
            programme_label: user.programme_name
                ? `${user.programme_name}${user.programme_code ? ` (${user.programme_code})` : ''}`
                : '',
            student_id_no: user.student_id_no || '',
            loaded_student_id_no: user.student_id_no || '',
            phone_no: user.phone_no || '',
            password: '', // Left blank to mean "do not change the password"
            fyp_stage: 'FYP1',
            // The existing password a coordinator may view (display only; it is never submitted)
            current_password: user.visible_password || '',
        });
        setFormError('');
        setShowNewPassword(false);
        setShowCurrentPassword(false);
        setShowDetailPassword(false);
        setIsDetailModalOpen(false);
        setIsFormModalOpen(true);
    };

    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleRoleChange = (role) => {
        setFormData((prev) => ({
            ...prev,
            role,
            // An administrator belongs to no cohort, so the programme is cleared
            // when that role is picked. Choosing any other role puts the default
            // back, so the field is never left blank for a role that needs one.
            programme: role === 'admin'
                ? ''
                : (prev.programme || (programmes[0] ? String(programmes[0].id) : '')),
        }));
    };

    const handleSaveUser = async (event) => {
        event.preventDefault();
        setFormError('');

        const username = formData.username.trim();
        const fullName = formData.full_name.trim();
        // The name is what every other screen shows this person by — the student
        // list, the marks table, schedules and announcements all read
        // `full_name` and fall back to the username when it is blank, which is
        // why an account saved without one looks like a different person in
        // every list it appears in.
        if (!fullName) {
            setFormError('A full name is required — it is what this account is shown by everywhere in FYPHub.');
            return;
        }
        if (!username) {
            setFormError('A username is required.');
            return;
        }
        // On create the coordinator sets the first password; on edit a blank
        // field means "keep the current password".
        if (!isEdit && !formData.password) {
            setFormError('Please set a sign-in password for this account.');
            return;
        }
        if (formData.password && formData.password.length < 6) {
            setFormError(isEdit
                ? 'The new password must be at least 6 characters long.'
                : 'The password must be at least 6 characters long.');
            return;
        }
        // Every account belongs to a programme; it is what the lists group and
        // filter by, so an account without one would be effectively invisible.
        // The one exception is the administrator, which is deliberately not
        // scoped to a cohort at all.
        if (!formData.programme && !isAdminForm) {
            setFormError('Please choose the programme this account belongs to.');
            return;
        }

        // A visible warning before the password is actually replaced.
        if (isEdit && formData.password) {
            const who = formData.full_name || formData.username;
            const confirmed = window.confirm(
                `You are changing the sign-in password for ${who}.\n\n`
                + `Their current password stops working immediately and they will have to use the new one `
                + `the next time they sign in. You will need to tell them the new password yourself.\n\n`
                + `Continue?`
            );
            if (!confirmed) return;
        }

        // Only students have a student ID, and the FYP stage is needed only when creating a student.
        const payload = {
            username,
            email: formData.email.trim(),
            full_name: fullName,
            role: formData.role,
            // `null` is accepted by the API and means "no cohort", which is what
            // an administrator account holds. Only reachable for that role: the
            // guard above requires a programme for every other one.
            programme: formData.programme ? Number(formData.programme) : null,
            phone_no: (formData.phone_no || '').trim(),
        };
        // Sent only when the field was actually on screen. The form used to send
        // `''` for every non-student account, and because this is a PATCH that
        // empty string was written — so editing a lecturer who still carries a
        // matric number (a former student, say) silently erased it.
        if (isStudentForm) {
            payload.student_id_no = (formData.student_id_no || '').trim();
        }
        if (formData.password) {
            payload.password = formData.password;
        }
        if (!isEdit && isStudentForm) {
            payload.fyp_stage = formData.fyp_stage;
        }

        setSaving(true);
        try {
            if (isEdit) {
                await api.patch(`/users/${editingUserId}/`, payload);
            } else {
                await api.post('/users/', payload);
            }
            setIsFormModalOpen(false);
            await fetchUsers();
        } catch (err) {
            setFormError(describeApiError(err));
        } finally {
            setSaving(false);
        }
    };

    // [NEW] Function that handles the permission transfer
    const handlePromote = async () => {
        if (!selectedUser) return;
        if (window.confirm(`WARNING:\nThis will transfer your Coordinator access to ${selectedUser.full_name} and you will be demoted to a Lecturer. This action is irreversible.\n\nAre you sure you want to proceed?`)) {
            try {
                const res = await api.post(`/users/${selectedUser.id}/promote-to-coordinator/`);
                alert(res.data.message);
                // A permission transfer is a major operation, so force a full page reload afterwards to make sure every piece of state (the sidebar included) updates correctly
                window.location.reload();
            } catch (err) {
                alert("Promotion failed: " + (err.response?.data?.error || "An error occurred."));
            }
        }
    };

    return (
        <div className="main-content um-page">
            <header className="um-header">
                <div className="um-header-text">
                    <h1>User Management</h1>
                    <p className="ui-page-subtitle">
                        {isSignedInAdmin
                            ? 'Every account in FYPHub — every student, lecturer, coordinator and administrator, in every programme. Create accounts one at a time, or add several from an Excel file.'
                            : 'Every student, lecturer and coordinator account in your programme. Create accounts one at a time, or add students in bulk from an Excel file.'}
                    </p>
                </div>
                {/* The two actions live in the header rather than in the filter
                    row: the header had the room, and in the filter row they were
                    squeezed onto two lines each on a laptop screen. */}
                <div className="um-header-actions">
                    <button onClick={() => setShowUploadModal(true)} className="btn btn-secondary">
                        Upload information
                    </button>
                    <button onClick={openCreateForm} className="btn btn-primary">
                        + Create User
                    </button>
                </div>
            </header>

            <Legend
                title="Roles"
                items={[
                    { colour: '#e0f2fe', label: 'Student', tip: 'Submits a TRF, follows milestones and views their own feedback.' },
                    { colour: '#dcfce7', label: 'Lecturer', tip: 'Supervises students, reviews TRFs, verifies milestones and grades.' },
                    // Matches .role-coordinator in UserManagement.css — this swatch
                    // used to be purple while the badge in the table was red.
                    { colour: '#fee2e2', label: 'Coordinator', tip: 'Runs the course: quotas, announcements, rubrics, scheduling and reports.' },
                    { colour: '#ede9fe', label: 'Administrator', tip: 'Maintains accounts across every programme. Sees this page only.' },
                ]}
            />

            <div className="card">
                <div className="um-toolbar">
                    <div className="um-filter-group">
                        <span className="um-filter-label" id="um-role-filter-label">Filter by role</span>
                        <div className="um-chips" role="group" aria-labelledby="um-role-filter-label">
                            {ROLE_FILTERS.filter((option) => !option.adminsOnly || isSignedInAdmin).map((option) => (
                                <button
                                    key={option.value || 'all'}
                                    type="button"
                                    onClick={() => setRoleFilter(option.value)}
                                    className={`um-chip${roleFilter === option.value ? ' is-active' : ''}`}
                                    aria-pressed={roleFilter === option.value}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="um-filter-group">
                        <label className="um-filter-label" htmlFor="um-programme-filter">Filter by programme</label>
                        <select
                            id="um-programme-filter"
                            className="um-select"
                            value={programmeFilter}
                            onChange={(e) => setProgrammeFilter(e.target.value)}
                        >
                            <option value="">All programmes</option>
                            {programmes.map((programme) => (
                                <option key={programme.id} value={String(programme.id)}>
                                    {programme.name}{programme.code ? ` (${programme.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {hasFilters && (
                        <button type="button" className="um-clear" onClick={clearFilters}>
                            Clear filters
                        </button>
                    )}
                </div>

                <div className="um-count">
                    <p className="ui-sub">
                        {isSignedInAdmin
                            ? 'Every account, in every programme, whatever its role.'
                            : 'The accounts in your own programme.'}
                        {' '}Showing <strong>{visibleUsers.length}</strong> of{' '}
                        <strong>{users.length}</strong> loaded account{users.length === 1 ? '' : 's'}
                        {hasFilters ? ' after filtering' : ''}.
                    </p>
                </div>

                <div className="um-table-scroll">
                  <table className="schedule-table bordered um-table">
                      <thead>
                          <tr>
                              <th className="um-col-no">NO.</th>
                              <th>NAME</th>
                              <th>USERNAME</th>
                              <th className="um-col-role">ROLE</th>
                              <th className="um-col-programme">PROGRAMME</th>
                              <th className="um-col-action">ACTION</th>
                          </tr>
                      </thead>
                      <tbody>
                          {loading ? (
                              <tr><td colSpan="6" className="um-loading-cell">Loading accounts…</td></tr>
                          ) : loadError ? (
                              /* A failed request must not read as "you have no
                                 accounts" — that is exactly how a stale server
                                 looked like an empty database. */
                              <tr className="um-message-row"><td colSpan="6" className="um-message-cell">
                                <EmptyState
                                  icon="⚠️"
                                  title="The account list could not be loaded"
                                  message={`${loadError} The list is not empty — the request itself failed. Check that the FYPHub API is running, then try again.`}
                                >
                                  <button type="button" className="btn btn-primary" onClick={fetchUsers}>
                                    Try again
                                  </button>
                                </EmptyState>
                              </td></tr>
                          ) : (
                              visibleUsers.map((user, index) => {
                                const blockedReason = deleteBlockedReason(user);
                                return (
                                  <tr key={user.id}>
                                      <td>{index + 1}</td>
                                      <td className="um-cell-name">
                                        {/* Accounts created before the name became
                                            required still hold none. They fall back to
                                            the username, and the short marker is what
                                            tells the coordinator there is something to
                                            fix on that row rather than a name they
                                            simply do not recognise. */}
                                        {user.full_name || user.username}
                                        {!user.full_name && (
                                          <span
                                            className="um-cell-muted"
                                            title="No full name is recorded for this account. Open Edit and add one."
                                          > · no name recorded</span>
                                        )}
                                      </td>
                                      <td className="um-cell-username">{user.username}</td>
                                      <td>
                                        {/* An account with no Profile row (a
                                            createsuperuser leftover) has no role
                                            to name. Only an administrator can see
                                            one, so it is spelled out rather than
                                            left as a blank badge. */}
                                        {user.role
                                          ? <span className={`role-tag role-${user.role}`}>{user.role}</span>
                                          : <span className="um-cell-muted">No profile</span>}
                                      </td>
                                      <td>{user.programme_name || <span className="um-cell-muted">Not set</span>}</td>
                                      <td className="action-buttons">
                                          {/* [NEW] View details button */}
                                          <button onClick={() => handleViewDetails(user)} className="btn-icon view">
                                            <FiEye aria-hidden="true" /> View
                                          </button>
                                          <button onClick={() => openEditForm(user)} className="btn-icon edit">
                                            <FiEdit2 aria-hidden="true" /> Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteUser(user.id, user.full_name || user.username)}
                                            className="btn-icon delete"
                                            disabled={Boolean(blockedReason)}
                                            title={blockedReason || `Delete ${user.full_name || user.username}`}
                                          >
                                            <FiTrash2 aria-hidden="true" /> Delete
                                          </button>
                                      </td>
                                  </tr>
                                );
                              })
                          )}
                           {!loading && !loadError && visibleUsers.length === 0 && (
                              <tr className="um-message-row"><td colSpan="6" className="um-message-cell">
                                {users.length === 0 ? (
                                  /* Nothing came back at all: this is not a filter
                                     problem, so it must not be described as one. */
                                  <EmptyState
                                    icon="👤"
                                    title={isSignedInAdmin ? 'No accounts exist yet' : 'No accounts in your programme yet'}
                                    message="Create the first account with “+ Create User”, or add students in bulk from an Excel file."
                                  >
                                    <button type="button" className="btn btn-primary" onClick={openCreateForm}>
                                      + Create User
                                    </button>
                                  </EmptyState>
                                ) : (
                                  <EmptyState
                                    icon="🔍"
                                    title="No accounts match these filters"
                                    message={`${users.length} account${users.length === 1 ? ' is' : 's are'} loaded, but none of them match ${activeFilterSummary || 'the current filters'}.`}
                                  >
                                    <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                                      Clear filters
                                    </button>
                                  </EmptyState>
                                )}
                              </td></tr>
                           )}
                      </tbody>
                  </table>
                </div>
            </div>

            {/* Upload modal */}
            {showUploadModal && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Bulk Upload Students</h2>
                            <span onClick={() => setShowUploadModal(false)}>&times;</span>
                        </div>
                        <div className="modal-body">
                            <p>Please select an Excel (.xlsx) file with student information.</p>
                            <Callout tone="plain" title="Before you upload" className="is-tight-top">
                                The spreadsheet must contain one row per student with columns for the student name,
                                matric/ID number and programme. Accounts that already exist are skipped, so re-uploading
                                a corrected file is safe. Every new account is created with the role
                                <strong> student</strong>.
                            </Callout>
                            <input type="file" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} />
                            {file && <p className="ui-hint">Selected file: <strong>{file.name}</strong></p>}
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleUpload} className="btn btn-primary" disabled={uploading}>
                                {uploading ? "Processing..." : "Upload & Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / edit user profile modal */}
            {isFormModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content form-modal">
                        <div className="modal-header">
                            <h2>{isEdit ? 'Edit Profile' : 'Create New User'}</h2>
                            <span onClick={() => setIsFormModalOpen(false)}>&times;</span>
                        </div>
                        <form onSubmit={handleSaveUser}>
                            <div className="modal-body">
                                {/* The "Editing an account" tip was removed: the form
                                    explains itself and the password area carries the
                                    only warning that matters. */}
                                {!isEdit && (
                                    <Callout tone="plain" title="Creating an account" className="is-tight-top">
                                        The account signs in with the username and password you set here. Share those
                                        details with the user yourself — the system does not email them.
                                    </Callout>
                                )}

                                {formError && <div className="form-error" role="alert">{formError}</div>}

                                <div className="form-grid">
                                    <div className="form-field">
                                        <label htmlFor="um-full-name">Full Name <span className="required-mark">*</span></label>
                                        <input
                                            id="um-full-name"
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => handleFormChange('full_name', e.target.value)}
                                            placeholder="e.g. Full Name"
                                            required
                                        />
                                        <p className="ui-hint form-hint">
                                            Shown throughout FYPHub — the student list, the marks table, schedules and
                                            announcements all name this account by it.
                                        </p>
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="um-username">Username <span className="required-mark">*</span></label>
                                        <input
                                            id="um-username"
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => handleFormChange('username', e.target.value)}
                                            placeholder="Used to sign in"
                                            required
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="um-email">Email</label>
                                        <input
                                            id="um-email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleFormChange('email', e.target.value)}
                                            placeholder="name@example.com"
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="um-role">Role <span className="required-mark">*</span></label>
                                        <select
                                            id="um-role"
                                            value={formData.role}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                        >
                                            {roleOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="um-programme">
                                            Programme {!isAdminForm && <span className="required-mark"> *</span>}
                                        </label>
                                        <select
                                            id="um-programme"
                                            value={formData.programme}
                                            onChange={(e) => handleFormChange('programme', e.target.value)}
                                            disabled={programmes.length === 0 && !userProgrammeIsLegacy}
                                        >
                                            {isAdminForm && (
                                                <option value="">All programmes (administrator)</option>
                                            )}
                                            {userProgrammeIsLegacy && (
                                                <option value={String(formData.programme)}>
                                                    {formData.programme_label}
                                                </option>
                                            )}
                                            {programmes.map((programme) => (
                                                <option key={programme.id} value={String(programme.id)}>
                                                    {programme.name}{programme.code ? ` (${programme.code})` : ''}
                                                </option>
                                            ))}
                                            {programmes.length === 0 && !userProgrammeIsLegacy && !isAdminForm && (
                                                <option value="">No programme available</option>
                                            )}
                                        </select>
                                        {isAdminForm && (
                                            <p className="ui-hint form-hint">
                                                An administrator is not filed under one programme — that is what lets
                                                the account see and maintain every cohort’s accounts.
                                            </p>
                                        )}
                                        {isEdit && userProgrammeIsLegacy && (
                                            <p className="form-warning">
                                                This account is currently on <strong>{formData.programme_label}</strong>,
                                                which is a leftover from the old spreadsheet upload rather than one of the
                                                four current programmes. It is left in the list so you can see what the
                                                account really holds. Choose a current programme above to move it.
                                            </p>
                                        )}
                                    </div>

                                    {isStudentForm && (
                                        <div className="form-field">
                                            <label htmlFor="um-student-id">Student ID / Matric No.</label>
                                            <input
                                                id="um-student-id"
                                                type="text"
                                                value={formData.student_id_no}
                                                onChange={(e) => handleFormChange('student_id_no', e.target.value)}
                                                placeholder="e.g. BXX26020001"
                                            />
                                            {isEdit
                                                && (formData.student_id_no || '').trim() !== (formData.loaded_student_id_no || '').trim() && (
                                                <p className="form-warning">
                                                    Correcting this number updates every record that matches the student by it —
                                                    their project row, and any marks already saved for them. The Student List,
                                                    the Timetable and the Course Report will show the new number.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="form-field">
                                        <label htmlFor="um-phone">Phone Number</label>
                                        <input
                                            id="um-phone"
                                            type="text"
                                            value={formData.phone_no}
                                            onChange={(e) => handleFormChange('phone_no', e.target.value)}
                                            placeholder="Optional"
                                        />
                                    </div>

                                    {isStudentForm && !isEdit && (
                                        <div className="form-field">
                                            <label htmlFor="um-stage">FYP Stage</label>
                                            <select
                                                id="um-stage"
                                                value={formData.fyp_stage}
                                                onChange={(e) => handleFormChange('fyp_stage', e.target.value)}
                                            >
                                                {FYP_STAGE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Existing accounts: the coordinator can read back the
                                        password this account signs in with. */}
                                    {isEdit && (
                                        <div className="form-field span-2">
                                            <label htmlFor="um-current-password">Current Password</label>
                                            <div className="password-field">
                                                <input
                                                    id="um-current-password"
                                                    type={showCurrentPassword ? 'text' : 'password'}
                                                    value={formData.current_password || ''}
                                                    readOnly
                                                    placeholder="Not recorded for this account"
                                                    className="is-readonly"
                                                />
                                                <EyeToggle
                                                    visible={showCurrentPassword}
                                                    onToggle={() => setShowCurrentPassword((prev) => !prev)}
                                                    label="current password"
                                                />
                                            </div>
                                            <p className="ui-hint form-hint">
                                                {formData.current_password
                                                    ? 'This is the password the account signs in with today.'
                                                    : 'No readable password is stored for this account (it was set outside these screens). Set a new one below.'}
                                            </p>
                                        </div>
                                    )}

                                    <div className="form-field span-2">
                                        <label htmlFor="um-password">
                                            {isEdit ? 'New Password' : 'Sign-in Password'}
                                            {!isEdit && <span className="required-mark"> *</span>}
                                        </label>
                                        <div className="password-field">
                                            <input
                                                id="um-password"
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={(e) => handleFormChange('password', e.target.value)}
                                                placeholder={isEdit
                                                    ? 'Leave blank to keep the current password'
                                                    : 'At least 6 characters'}
                                                autoComplete="new-password"
                                            />
                                            <EyeToggle
                                                visible={showNewPassword}
                                                onToggle={() => setShowNewPassword((prev) => !prev)}
                                                label="new password"
                                            />
                                        </div>
                                        <p className="ui-hint form-hint">
                                            {isEdit
                                                ? 'Leave this blank unless you are changing it. A new password replaces the current one immediately.'
                                                : 'Use the eye to check the password before you save it.'}
                                        </p>
                                    </div>

                                    {/* Explicit warning, shown only once a replacement is typed. */}
                                    {isEdit && formData.password && (
                                        <div className="form-warning span-2" role="alert">
                                            <strong>You are changing this password.</strong>
                                            {' '}{formData.full_name || formData.username} will not be able to sign in with the
                                            old password once you save. Tell them the new password yourself.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsFormModalOpen(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* User details modal */}
            {isDetailModalOpen && selectedUser && (
                <div className="modal-backdrop">
                    <div className="modal-content um-detail-modal">
                        <div className="modal-header">
                            <h2>User Details: {selectedUser.full_name || selectedUser.username}</h2>
                            <span onClick={() => setIsDetailModalOpen(false)}>&times;</span>
                        </div>
                        <div className="modal-body user-details">
                            <p><strong>Full Name:</strong> <span>{selectedUser.full_name || 'N/A'}</span></p>
                            <p><strong>Username:</strong> <span>{selectedUser.username}</span></p>
                            <p>
                                <strong>Password:</strong>
                                <span className="user-details-password">
                                    <span className="password-value">
                                        {selectedUser.visible_password
                                            ? (showDetailPassword ? selectedUser.visible_password : '••••••••')
                                            : 'Not recorded'}
                                    </span>
                                    {selectedUser.visible_password && (
                                        <EyeToggle
                                            visible={showDetailPassword}
                                            onToggle={() => setShowDetailPassword((prev) => !prev)}
                                            label="password"
                                        />
                                    )}
                                </span>
                            </p>
                            <p><strong>Email:</strong> <span>{selectedUser.email || 'N/A'}</span></p>
                            <p><strong>Phone:</strong> <span>{selectedUser.phone_no || 'N/A'}</span></p>
                            {/* Only a student holds a matric number, so the row is
                                left out for every other role instead of reading
                                "N/A" — the same rule the edit form and My Profile
                                follow. */}
                            {selectedUser.role === 'student' && (
                                <p><strong>Student ID:</strong> <span>{selectedUser.student_id_no || 'N/A'}</span></p>
                            )}
                            <p><strong>Role:</strong> <span className={`role-tag role-${selectedUser.role}`}>{selectedUser.role || 'No profile'}</span></p>
                            <p>
                                <strong>Programme:</strong>{' '}
                                <span>
                                    {selectedUser.programme_name
                                        ? `${selectedUser.programme_name}${selectedUser.programme_code ? ` (${selectedUser.programme_code})` : ''}`
                                        : 'Not set'}
                                </span>
                            </p>
                        </div>
                        <div className="modal-footer">
                            {/* Only a coordinator owns coordinator access, so the
                                transfer is offered to that role alone. An
                                administrator sees the account but not the button,
                                rather than a button the API would refuse. */}
                            {isSignedInCoordinator && selectedUser.role === 'lecturer' && (
                                <>
                                    <p className="ui-hint" style={{ marginRight: 'auto', maxWidth: '340px', textAlign: 'left' }}>
                                        Transferring coordinator access gives this lecturer your coordinator tools and
                                        demotes your own account to lecturer. It cannot be undone from the interface.
                                    </p>
                                    <button onClick={handlePromote} className="btn btn-danger">
                                        Transfer Coordinator Access to this User
                                    </button>
                                </>
                            )}
                            <button onClick={() => openEditForm(selectedUser)} className="btn btn-primary">Edit Profile</button>
                            <button onClick={() => setIsDetailModalOpen(false)} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
