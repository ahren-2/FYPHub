import React, { useState, useEffect } from 'react';
import api from '../api';
import './TeammateCoordinator.css';
import { Callout, EmptyState } from '../components';

function ManageAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAnn, setEditingAnn] = useState(null);

    const fetchAnnouncements = async () => {
        try {
            const res = await api.get('/announcements/');
            setAnnouncements(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchAnnouncements(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // 【修正】: 移除了 '/api' 前缀
            await api.post('/announcements/', { title, content });
            alert("Published!");
            setTitle(''); setContent('');
            fetchAnnouncements();
        } catch (err) { alert("Failed to publish"); }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this?")) {
            try {
                // 【修正】: 移除了 '/api' 前缀
                await api.delete(`/announcements/${id}/`);
                fetchAnnouncements();
            } catch (err) {
                alert("Failed to delete.");
            }
        }
    };

    const handleOpenEditModal = (announcement) => {
        setEditingAnn(announcement);
        setIsModalOpen(true);
    };

    // 2. 关闭编辑弹窗的函数
    const handleCloseEditModal = () => {
        setIsModalOpen(false);
        setEditingAnn(null);
    };

    // 3. 提交更新的函数
    const handleUpdate = async () => {
        if (!editingAnn) return;
        try {
            await api.put(`/announcements/${editingAnn.id}/`, {
                title: editingAnn.title,
                content: editingAnn.content
            });
            alert("Announcement updated successfully!");
            handleCloseEditModal();
            fetchAnnouncements();
        } catch (err) {
            alert("Update failed.");
            console.error("Update error:", err);
        }
    };

    return (
        <div className="main-content">
            <header>
                <h1>Manage Announcements</h1>
                <p className="ui-page-subtitle">
                    Announcements are visible to every student and lecturer immediately after publishing, and the
                    newest one is shown on their dashboards.
                </p>
            </header>

            <Callout tone="plain" title="Write it so it can be acted on">
                Put the deadline, the action and the audience in the first two lines — students read the title and the
                opening sentence before deciding whether the notice applies to them.
            </Callout>

            <div className="grid-container-large">
                <div className="card">
                    <h3>Create New Announcement</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>
                                Title
                            </label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>
                                Content
                            </label>
                            <textarea rows="8" value={content} onChange={(e) => setContent(e.target.value)} required />
                        </div>
                        <button className="btn btn-primary">Publish Announcement</button>
                    </form>
                </div>
                <div className="card">
                    <h3>Published Announcements</h3>
                    <p className="ui-hint" style={{ marginTop: 0 }}>
                        {announcements.length} announcement{announcements.length === 1 ? '' : 's'} published. Editing
                        updates the notice everywhere; deleting removes it for everyone.
                    </p>
                    <div className="announcement-manage-list">
                        {announcements.length === 0 && (
                            <EmptyState
                                icon="📣"
                                title="Nothing published yet"
                                message="Use the form on the left to post your first notice to the whole course."
                            />
                        )}
                        {announcements.map(ann => (
                            <div key={ann.id} className="announcement-manage-item">
                                <p>{ann.title}</p>
                                <div className="actions">
                                    <button onClick={() => handleOpenEditModal(ann)} className="btn-icon edit">
                                        ✏️ Edit
                                    </button>
                                    <button onClick={() => handleDelete(ann.id)} className="btn-icon delete">
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {isModalOpen && editingAnn && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Edit Announcement</h2>
                            <span onClick={handleCloseEditModal}>&times;</span>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Title</label>
                                <input 
                                    type="text" 
                                    value={editingAnn.title}
                                    onChange={(e) => setEditingAnn({ ...editingAnn, title: e.target.value })} 
                                />
                            </div>
                            <div className="form-group">
                                <label>Content</label>
                                <textarea 
                                    rows="10"
                                    value={editingAnn.content}
                                    onChange={(e) => setEditingAnn({ ...editingAnn, content: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={handleCloseEditModal} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleUpdate} className="btn btn-primary">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageAnnouncements;