import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./StaffManagement.css";

const StaffManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", role: "STAFF" });

  const navigate = useNavigate();

  // Define available features to toggle
  const FEATURE_FLAGS = [
    { key: "can_manage_fees", label: "Fees" },
    { key: "can_upload_data", label: "Uploads" },
    { key: "can_manage_students", label: "Students" },
  ];

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/staff/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMembers(res.data);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        alert("Access Denied: Only Admins can view this page.");
        navigate("/");
      } else {
        console.error("Failed to fetch staff", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 1. DELETE FUNCTION
  const handleDelete = async (userId) => {
    if (
      !confirm(
        "Are you sure you want to remove this user? This cannot be undone."
      )
    )
      return;

    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/staff/?id=${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchMembers(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  // 2. PERMISSION TOGGLE
  const togglePermission = async (memberId, permissionKey, currentValue) => {
    // Optimistic Update
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const newPerms = { ...m.permissions, [permissionKey]: !currentValue };
        return { ...m, permissions: newPerms };
      }
      return m;
    });
    setMembers(updatedMembers);

    // Send to Backend
    try {
      const token = localStorage.getItem("access_token");
      const targetMember = updatedMembers.find((m) => m.id === memberId);

      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/staff/`,
        {
          user_id: memberId,
          permissions: targetMember.permissions,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Failed to update permission", err);
      fetchMembers(); // Revert on error
    }
  };

  // 3. ADD MEMBER FUNCTION (RESTORED)
  const handleAddMember = async () => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(`${import.meta.env.VITE_API_URL}/api/staff/`, newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Success: Close modal and refresh list
      alert(`Invitation sent to ${newUser.email}!`);
      setShowModal(false);
      setNewUser({ email: "", role: "STAFF" });
      fetchMembers();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to add user");
    }
  };

  return (
    <div className="staff-page">
      <div className="page-header">
        <div>
          <h1>Team & Permissions</h1>
          <p>Manage access and features for your staff.</p>
        </div>
        <button className="add-btn" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Member
        </button>
      </div>

      <div className="glass-panel table-container">
        {loading ? (
          <p style={{ padding: "2rem" }}>Loading...</p>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Feature Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar-circle">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <span className="name">{m.name}</span>
                        <span className="email">{m.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${m.role_code.toLowerCase()}`}>
                      {m.role}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td>
                    {m.status === "Active" ? (
                      <span className="status-badge active">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="status-badge invited">
                        <Clock size={12} /> Invited
                      </span>
                    )}
                  </td>

                  {/* Permissions */}
                  <td>
                    <div className="perm-toggles">
                      {FEATURE_FLAGS.map((feat) => (
                        <label
                          key={feat.key}
                          className="toggle-label"
                          title={feat.label}
                        >
                          <input
                            type="checkbox"
                            checked={!!m.permissions[feat.key]}
                            onChange={() =>
                              togglePermission(
                                m.id,
                                feat.key,
                                m.permissions[feat.key]
                              )
                            }
                            disabled={m.role_code === "ORG_ADMIN"}
                          />
                          <span>{feat.label}</span>
                        </label>
                      ))}
                    </div>
                  </td>

                  {/* Delete Action */}
                  <td>
                    {m.role_code !== "ORG_ADMIN" && (
                      <button
                        className="icon-btn delete"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. MODAL POPUP (RESTORED) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Invite New Member</h2>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="teacher@school.edu"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
              >
                <option value="STAFF">Staff / Teacher</option>
                <option value="ORG_ADMIN">Co-Admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleAddMember}>
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
