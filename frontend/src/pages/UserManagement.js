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
    student_id_no: '',
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
    const [roleFilter, setRoleFilter] = useState(''); // '', 'student', 'lecturer'

    // State for the upload functionality
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

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
    const [currentUserId, setCurrentUserId] = useState(null);

    const isEdit = formMode === 'edit';
    const isStudentForm = formData.role === 'student';

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (roleFilter) {
                params['profile__role'] = roleFilter;
            }
            const res = await api.get('/users/', { params });
            setUsers(res.data);
        } catch (err) { 
            console.error("Failed to fetch user list:", err); 
        } finally {
            setLoading(false);
        }
    }, [roleFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Needed to know which row is "you", so your own Delete button can be
    // disabled rather than failing on the server.
    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const res = await api.get('/user/me/');
                setCurrentUserId(res.data.id);
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
        if (user.is_superuser || user.role === 'coordinator') {
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
                // 成功后直接从前端 state 中移除，避免重新请求 API，体验更流畅
                setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
            } catch (err) {
                alert(describeApiError(err) || "Delete failed.");
            }
        }
    };

    // 【新增】打开详情弹窗的函数
    const handleViewDetails = (user) => {
        setSelectedUser(user);
        // Never leave a revealed password on screen for the next account.
        setShowDetailPassword(false);
        setIsDetailModalOpen(true);
    };

    // 打开“创建用户”表单
    const openCreateForm = () => {
        setFormMode('create');
        setEditingUserId(null);
        setFormData(emptyForm);
        setFormError('');
        setShowNewPassword(false);
        setShowCurrentPassword(false);
        setIsFormModalOpen(true);
    };

    // 打开“编辑资料”表单，并填入现有资料
    const openEditForm = (user) => {
        setFormMode('edit');
        setEditingUserId(user.id);
        setFormData({
            full_name: user.full_name || '',
            username: user.username || '',
            email: user.email || '',
            role: user.role || 'student',
            student_id_no: user.student_id_no || '',
            phone_no: user.phone_no || '',
            password: '', // 留空表示不修改密码
            fyp_stage: 'FYP1',
            // 协调员可查看的现有密码（用于显示，不会提交）
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

    const handleSaveUser = async (event) => {
        event.preventDefault();
        setFormError('');

        const username = formData.username.trim();
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

        // 只有学生才有学号；只有新建学生时才需要 FYP stage。
        const payload = {
            username,
            email: formData.email.trim(),
            full_name: formData.full_name.trim(),
            role: formData.role,
            student_id_no: isStudentForm ? (formData.student_id_no || '').trim() : '',
            phone_no: (formData.phone_no || '').trim(),
        };
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

    // 【新增】处理权限转移的函数
    const handlePromote = async () => {
        if (!selectedUser) return;
        if (window.confirm(`WARNING:\nThis will transfer your Coordinator access to ${selectedUser.full_name} and you will be demoted to a Lecturer. This action is irreversible.\n\nAre you sure you want to proceed?`)) {
            try {
                const res = await api.post(`/users/${selectedUser.id}/promote-to-coordinator/`);
                alert(res.data.message);
                // 权限转移是重大操作，成功后强制刷新整个页面以确保所有状态（包括侧边栏）都正确更新
                window.location.reload();
            } catch (err) {
                alert("Promotion failed: " + (err.response?.data?.error || "An error occurred."));
            }
        }
    };

    return (
        <div className="main-content">
            <header>
                <h1>User Management</h1>
                <p className="ui-page-subtitle">
                    Every student, lecturer and coordinator account in the system. Create accounts one at a time, or
                    add students in bulk from an Excel file.
                </p>
            </header>

            <Legend
                title="Roles"
                items={[
                    { colour: '#e0f2fe', label: 'Student', tip: 'Submits a TRF, follows milestones and views their own feedback.' },
                    { colour: '#dcfce7', label: 'Lecturer', tip: 'Supervises students, reviews TRFs, verifies milestones and grades.' },
                    // Matches .role-coordinator in UserManagement.css — this swatch
                    // used to be purple while the badge in the table was red.
                    { colour: '#fee2e2', label: 'Coordinator', tip: 'Runs the course: quotas, announcements, rubrics, scheduling and reports.' },
                ]}
            />

            <div className="card">
                <div className="page-toolbar">
                    <div className="role-filters">
                        <span>Filter by Role:</span>
                        <button onClick={() => setRoleFilter('')} className={!roleFilter ? 'active' : ''}>All</button>
                        <button onClick={() => setRoleFilter('student')} className={roleFilter === 'student' ? 'active' : ''}>Students</button>
                        <button onClick={() => setRoleFilter('lecturer')} className={roleFilter === 'lecturer' ? 'active' : ''}>Lecturers</button>
                    </div>
                    <div className="toolbar-actions">
                        <button onClick={() => setShowUploadModal(true)} className="btn btn-secondary">
                            Upload information
                        </button>
                        <button onClick={openCreateForm} className="btn btn-primary">
                            + Create User
                        </button>
                    </div>
                </div>
                
                <div className="timetable-container">
                  {/* 【修改】添加 bordered 类以应用新样式 */}
                  <table className="schedule-table bordered">
                      <thead>
                          <tr>
                              {/* 【新增】号码列 */}
                              <th style={{width: '50px'}}>NO.</th> 
                              <th>NAME</th>
                              <th>USERNAME</th>
                              <th>ROLE</th>
                              <th>ACTION</th>
                          </tr>
                      </thead>
                      <tbody>
                          {loading ? (
                              <tr><td colSpan="5" style={{textAlign: 'center'}}>Loading...</td></tr>
                          ) : (
                              users.map((user, index) => {
                                const blockedReason = deleteBlockedReason(user);
                                return (
                                  <tr key={user.id}>
                                      {/* 【新增】显示行号 */}
                                      <td>{index + 1}</td> 
                                      <td>{user.full_name || user.username}</td>
                                      <td>{user.username}</td>
                                      <td><span className={`role-tag role-${user.role}`}>{user.role}</span></td>
                                      <td className="action-buttons">
                                          {/* 【新增】查看详情按钮 */}
                                          <button onClick={() => handleViewDetails(user)} className="btn-icon view">
                                            <FiEye aria-hidden="true" /> View
                                          </button>
                                          <button onClick={() => openEditForm(user)} className="btn-icon edit">
                                            <FiEdit2 aria-hidden="true" /> Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteUser(user.id, user.full_name)}
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
                           {!loading && users.length === 0 && (
                              <tr><td colSpan="5">
                                <EmptyState
                                  icon="🔍"
                                  title={roleFilter ? `No ${roleFilter} accounts found` : 'No accounts found'}
                                  message={roleFilter
                                    ? 'Try switching the role filter back to “All”, or create an account to get started.'
                                    : 'Create an account or upload a student spreadsheet to get started.'}
                                />
                              </td></tr>
                           )}
                      </tbody>
                  </table>
                </div>
            </div>

            {/* 上传弹窗 */}
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

            {/* 创建 / 编辑用户资料弹窗 */}
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
                                        <label htmlFor="um-full-name">Full Name</label>
                                        <input
                                            id="um-full-name"
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => handleFormChange('full_name', e.target.value)}
                                            placeholder="e.g. Nur Aisyah binti Hassan"
                                        />
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
                                            onChange={(e) => handleFormChange('role', e.target.value)}
                                        >
                                            {ROLE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {isStudentForm && (
                                        <div className="form-field">
                                            <label htmlFor="um-student-id">Student ID / Matric No.</label>
                                            <input
                                                id="um-student-id"
                                                type="text"
                                                value={formData.student_id_no}
                                                onChange={(e) => handleFormChange('student_id_no', e.target.value)}
                                                placeholder="e.g. A123456"
                                            />
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
            
            {/* 用户详情弹窗 */}
            {isDetailModalOpen && selectedUser && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>User Details: {selectedUser.full_name}</h2>
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
                            <p><strong>Student ID:</strong> <span>{selectedUser.student_id_no || 'N/A'}</span></p>
                            <p><strong>Role:</strong> <span className={`role-tag role-${selectedUser.role}`}>{selectedUser.role}</span></p>
                        </div>
                        <div className="modal-footer">
                            {selectedUser.role === 'lecturer' && (
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
