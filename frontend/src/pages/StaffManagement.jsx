/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./StaffManagement.css";

const StaffManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & UI State
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // Stores ID of user to delete
  const [newUser, setNewUser] = useState({ email: "", role: "STAFF" });

  // Toast Notification State
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const navigate = useNavigate();

  const FEATURE_FLAGS = [
    { key: "can_manage_fees", label: "Fees" },
    { key: "can_upload_data", label: "Uploads" },
    { key: "can_manage_students", label: "Students" },
  ];

  // Helper to show notifications
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

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

  // 1. DELETE LOGIC (Now opens a modal first)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/staff/?id=${deleteTarget}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showToast("User removed successfully", "success");
      fetchMembers();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    } finally {
      setDeleteTarget(null); // Close modal
    }
  };

  // 2. PERMISSION TOGGLE
  const togglePermission = async (memberId, permissionKey, currentValue) => {
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const newPerms = { ...m.permissions, [permissionKey]: !currentValue };
        return { ...m, permissions: newPerms };
      }
      return m;
    });
    setMembers(updatedMembers);

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
      showToast("Failed to save permission", "error");
      fetchMembers();
    }
  };

  // 3. ADD MEMBER
  const handleAddMember = async () => {
    // --- 1. EMAIL VALIDATION CHECK ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newUser.email || !emailRegex.test(newUser.email)) {
      showToast(
        "Please enter a valid email address (e.g., user@example.com)",
        "error"
      );
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(`${import.meta.env.VITE_API_URL}/api/staff/`, newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast(`Invitation sent to ${newUser.email}!`, "success");
      setShowAddModal(false);
      setNewUser({ email: "", role: "STAFF" });
      fetchMembers();
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to add user", "error");
    }
  };

  return (
    <div className="staff-page">
      {/* Toast Notification */}
      <div
        className={`toast-notification ${toast.type} ${
          toast.show ? "show" : ""
        }`}
      >
        {toast.type === "success" ? (
          <Check size={18} />
        ) : (
          <AlertTriangle size={18} />
        )}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Team & Permissions</h1>
          <p>Manage access and features for your staff.</p>
        </div>
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
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
                  <td>
                    {m.role_code !== "ORG_ADMIN" && (
                      <button
                        className="icon-btn delete"
                        onClick={() => setDeleteTarget(m.id)}
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

      {/* --- ADD USER MODAL --- */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invite New Member</h2>
              <button
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="teacher@school.edu"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <div className="select-wrapper">
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
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
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

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal-card delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-icon-wrapper">
              <Trash2 size={32} />
            </div>
            <h3>Remove User?</h3>
            <p>
              Are you sure you want to remove this user? They will lose access
              immediately.
            </p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setDeleteTarget(null)}
              >
                Keep User
              </button>
              <button className="delete-confirm-btn" onClick={confirmDelete}>
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
