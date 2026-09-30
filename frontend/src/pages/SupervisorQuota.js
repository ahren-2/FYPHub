import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateCoordinator.css';
import { Callout, EmptyState, Meter } from '../components';

function SupervisorQuota() {
    const [quotas, setQuotas] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedLec, setSelectedLec] = useState(null);
    const [studentList, setStudentList] = useState([]);
    const [newQuotaValue, setNewQuotaValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [bulkQuotaValue, setBulkQuotaValue] = useState('');

    const fetchQuotas = async () => {
        try {
            const res = await api.get('/supervisors/quotas/');
            setQuotas(res.data.quotas);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchQuotas(); }, []);

    const handleOpenEditView = async (lec) => {
        setSelectedLec(lec);
        setNewQuotaValue(lec.total_quota);
        try {
            const res = await api.get(`/supervisors/students/${lec.id}/`);
            setStudentList(res.data);
            setShowModal(true);
        } catch (err) {
            alert("Could not load managed student list.");
        }
    };

     const handleSaveQuota = async () => {
        if (!selectedLec) return;
        try {
            await api.put(`/supervisors/quotas/${selectedLec.id}/`, { quota_total: parseInt(newQuotaValue) });
            alert("Quota updated!");
            setShowModal(false);
            fetchQuotas(); // 刷新列表
        } catch (err) { 
            alert("Failed to update."); 
            console.error("Quota update error:", err);
        }
    };

    const handleBulkSave = async () => {
        const value = parseInt(bulkQuotaValue);
        if (isNaN(value) || value < 0) {
            return alert("Please enter a valid non-negative number.");
        }
        
        if (window.confirm(`Are you sure you want to set ALL supervisors' quota to ${value}?`)) {
            try {
                await api.post('/supervisors/quotas/bulk-update/', { quota_total: value });
                alert("All quotas have been updated successfully!");
                fetchQuotas();
                setBulkQuotaValue('');
            } catch (err) {
                alert("Bulk update failed. Please check backend API.");
                console.error("Bulk update error:", err);
            }
        }
    };

    if (loading) return <div className="main-content">Loading Quotas...</div>;

    return (
        <div className="main-content">
            <header>
                <h1>Supervisor Quota Management</h1>
                <p className="ui-page-subtitle">
                    A quota is the maximum number of students one lecturer may supervise. Students can only choose
                    lecturers with a free slot, so a full lecturer disappears from the supervisor list on the
                    <strong> Title Registration Form</strong>.
                </p>
            </header>

            <Callout tone="plain" title="Set quotas before students register their titles">
                Raising a quota lets more students pick that lecturer. Lowering it below the number already assigned
                does not remove any student — it only blocks new ones until the numbers balance.
            </Callout>

            <div className="card" style={{ marginBottom: '30px' }}>
                <h3>Bulk Edit Quotas</h3>
                <p style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: 0, marginBottom: '15px' }}>
                    Set a new quota value that will be applied to all supervisors in your course.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="number" 
                        min="0"
                        placeholder="e.g., 10" 
                        value={bulkQuotaValue}
                        onChange={(e) => setBulkQuotaValue(e.target.value)}
                        className="login-input"
                        aria-label="New quota for every supervisor"
                    />
                    <button className="btn btn-primary" onClick={handleBulkSave}>Apply to All</button>
                </div>
                <p className="ui-hint">
                    {quotas.length} supervisor{quotas.length === 1 ? '' : 's'} in your course will be affected.
                </p>
            </div>

            <div className="card">
                <div className="ui-section-head">
                    <div>
                        <h3>Supervisor capacity</h3>
                        <span className="ui-sub">
                            Assigned shows how much of each lecturer’s quota is already taken by a student.
                        </span>
                    </div>
                </div>

                {quotas.length === 0 ? (
                    <EmptyState
                        icon="👥"
                        title="No supervisor records found"
                        message="Lecturer accounts need to exist before quotas can be set. Create them from User Management."
                    />
                ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Supervisor Name</th>
                            <th>
                                Total Quota
                            </th>
                            <th>
                                Assigned
                            </th>
                            <th>
                                Available Slots
                            </th>
                            <th>Capacity</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotas.map(q => {
                            const total = Number(q.total_quota) || 0;
                            const assigned = Number(q.assigned_count) || 0;
                            const available = q.available_quota !== undefined ? Number(q.available_quota) : Math.max(total - assigned, 0);
                            return (
                                <tr key={q.id}>
                                    <td>{q.name}</td>
                                    <td>{total}</td>
                                    <td style={{ color: assigned >= total ? '#dc3545' : 'inherit', fontWeight: assigned >= total ? 600 : 400 }}>
                                        {assigned}
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>
                                        {available > 0 ? available : <span className="ui-badge is-danger">Full</span>}
                                    </td>
                                    <td style={{ minWidth: '150px' }}>
                                        <Meter value={assigned} max={total || 1} label={`${assigned}/${total}`} />
                                    </td>
                                    <td><button className="btn btn-secondary" onClick={() => handleOpenEditView(q)}>Edit &amp; View</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                )}
            </div>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
                            <h2>Management: {selectedLec?.name}</h2>
                            <span style={{cursor:'pointer', fontSize:'1.5rem'}} onClick={()=>setShowModal(false)}>&times;</span>
                        </div>
                        
                        <div style={{ margin: '20px 0', padding: '15px', background: '#f0f7ff', borderRadius: '8px' }}>
                            <label><strong>Adjust Total Quota: </strong></label>
                            <input type="number" min="0" value={newQuotaValue} onChange={(e)=>setNewQuotaValue(e.target.value)} style={{ width: '80px', padding: '5px' }} aria-label="Total quota for this supervisor" />
                            <button className="btn btn-primary" onClick={handleSaveQuota} style={{ marginLeft: '10px' }}>Save Changes</button>
                            <p className="ui-hint" style={{ marginTop: '10px' }}>
                                Currently {studentList.length} student{studentList.length === 1 ? '' : 's'} assigned.
                                Set the total to at least that number to keep every student allocated.
                            </p>
                        </div>

                        <h3>Current Students Managed</h3>
                        <p className="ui-hint" style={{ marginTop: 0 }}>Read-only. Change an allocation from the student’s project record.</p>
                        <div className="timetable-container">
                            <table className="schedule-table">
                                <thead>
                                    <tr><th>No.</th><th>Student ID</th><th>Student Name</th><th>FYP Stage</th></tr>
                                </thead>
                                <tbody>
                                    {studentList.map((s, index) => (
                                        <tr key={s.id}>
                                            <td>{index + 1}</td>
                                            <td>{s.student_matric_id}</td>
                                            <td>{s.student_name}</td>
                                            <td>{s.fyp_stage}</td>
                                        </tr>
                                    ))}
                                    {studentList.length === 0 && <tr><td colSpan="4" style={{textAlign:'center'}}>No students assigned.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{marginTop:'20px'}}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SupervisorQuota;