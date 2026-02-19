import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  GraduationCap,
  CheckCircle,
  Clock,
  Upload,
  X,
  MoreVertical,
  Mail,
  Phone,
  Briefcase,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { staffService } from "../services/api";
import "./StaffManagement.css";

// --- Utility Functions for Auto-Avatars ---
const getInitials = (name) => {
  if (!name) return "F";
  const cleanName = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, "");
  const parts = cleanName.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return cleanName[0].toUpperCase();
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4f46e5, #3730a3)", // Indigo
  "linear-gradient(135deg, #059669, #047857)", // Emerald
  "linear-gradient(135deg, #e11d48, #be123c)", // Rose
  "linear-gradient(135deg, #d97706, #b45309)", // Amber
  "linear-gradient(135deg, #475569, #334155)", // Slate
  "linear-gradient(135deg, #0284c7, #0369a1)", // Sky Blue
  "linear-gradient(135deg, #9333ea, #7e22ce)", // Purple
];

const getColorForName = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
};

const StaffManagement = () => {
  const [activeTab, setActiveTab] = useState("faculty");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchMembers();
  }, [activeTab]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response =
        activeTab === "staff"
          ? await staffService.getStaff()
          : await staffService.getFaculty();
      setMembers(response.data);
    } catch (error) {
      console.error("Failed to fetch members", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="staff-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="page-subtitle">
            Manage system access and academic faculty
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary"
          onClick={() => setShowModal(true)}
        >
          <UserPlus size={18} />
          {activeTab === "staff" ? "Invite Staff" : "Add Faculty"}
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {["faculty", "staff"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "faculty" ? (
              <GraduationCap size={18} />
            ) : (
              <Users size={18} />
            )}
            {tab === "faculty" ? "Faculty Registry" : "Office Staff"}
            {activeTab === tab && (
              <motion.div
                className="active-tab-indicator"
                layoutId="activeTab"
              />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="toolbar">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role / Designation</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <td>
                        <div className="user-cell">
                          {member.profile_picture ? (
                            <img
                              src={`http://127.0.0.1:8000${member.profile_picture}`}
                              alt="Profile"
                              className="avatar-img"
                            />
                          ) : (
                            <div
                              className="avatar-circle"
                              style={{
                                background: getColorForName(member.name),
                              }}
                            >
                              {getInitials(member.name)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {activeTab === "faculty" ? (
                          <span className="badge badge-designation">
                            {member.designation || "Faculty"}
                          </span>
                        ) : (
                          <span className="badge badge-role">
                            {member.role_code === "ORG_ADMIN"
                              ? "Admin"
                              : "Staff"}
                          </span>
                        )}
                      </td>
                      <td>
                        {member.department_name || member.department || "-"}
                      </td>
                      <td>
                        {member.is_setup_complete ||
                        member.status === "Active" ? (
                          <span className="status-badge active">
                            <CheckCircle size={14} /> Active
                          </span>
                        ) : (
                          <span className="status-badge pending">
                            <Clock size={14} /> Invited
                          </span>
                        )}
                      </td>
                      <td>
                        <button className="btn-icon">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td colSpan="5" className="empty-state">
                      <Users size={48} className="text-muted opacity-20 mb-2" />
                      <p>No members found.</p>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal &&
          (activeTab === "staff" ? (
            <InviteStaffModal
              onClose={() => setShowModal(false)}
              onRefresh={fetchMembers}
            />
          ) : (
            <AddFacultyModal
              onClose={() => setShowModal(false)}
              onRefresh={fetchMembers}
            />
          ))}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Component: Add Faculty Modal (Auto-Color) ---
const AddFacultyModal = ({ onClose, onRefresh }) => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    designation: "Assistant Professor",
    phone_number: "",
    department_id: 1,
    profile_picture: null,
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, profile_picture: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, profile_picture: null });
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== null) payload.append(key, formData[key]);
    });

    try {
      await staffService.addFaculty(payload);
      onRefresh();
      onClose();
    } catch (err) {
      alert("Error adding faculty");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <div className="modal-header">
          <div>
            <h3>Add New Faculty</h3>
            <p className="modal-subtitle">
              Create their academic profile and permissions.
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          {/* Avatar Area */}
          <div className="avatar-selection-area">
            <div className="avatar-preview-large">
              {preview ? (
                <img src={preview} alt="Preview" />
              ) : (
                <div
                  className="monogram-avatar"
                  style={{
                    background: getColorForName(
                      formData.full_name || formData.email || "F",
                    ),
                  }}
                >
                  {getInitials(formData.full_name)}
                </div>
              )}
            </div>

            <div className="avatar-options">
              {preview ? (
                <div className="file-active-controls">
                  <span className="text-sm font-medium text-success flex items-center gap-1">
                    <CheckCircle size={14} /> Custom photo applied
                  </span>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="text-sm btn-link-danger"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted">
                    A professional avatar is auto-generated.
                  </label>
                  <label
                    className="upload-link-btn"
                    title="Upload custom photo"
                  >
                    <Upload size={16} /> Upload Custom Photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <UserIcon size={18} className="input-icon" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Connor"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="input-group">
              <label>College Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  required
                  placeholder="sarah@college.edu"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Designation</label>
                <div className="input-wrapper">
                  <Briefcase size={18} className="input-icon" />
                  <select
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                  >
                    <option>Assistant Professor</option>
                    <option>Associate Professor</option>
                    <option>Professor</option>
                    <option>Visiting Faculty</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="+91..."
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-text">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Create Faculty Profile"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Sub-Component: Invite Staff Modal ---
const InviteStaffModal = ({ onClose, onRefresh }) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await staffService.inviteStaff({ email, role });
      onRefresh();
      onClose();
    } catch (err) {
      alert("Error inviting staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal small-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="modal-header">
          <div>
            <h3>Invite Staff Member</h3>
            <p className="modal-subtitle">
              Send an invitation to join the admin dashboard.
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                required
                placeholder="admin@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <label>Access Level</label>
            <div className="input-wrapper">
              <Briefcase size={18} className="input-icon" />
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="STAFF">Viewer (Read Only)</option>
                <option value="ORG_ADMIN">Organization Admin</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-text">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default StaffManagement;
