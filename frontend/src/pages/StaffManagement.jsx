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
  Trash2,
  Mail,
  Phone,
  Briefcase,
  User as UserIcon,
  AlertTriangle,
  Check,
  Edit2,
  Send,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import "./StaffManagement.css";
import { staffService, academicService } from "../services/api";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext"; 

const getInitials = (name) => {
  if (!name) return "F";
  const cleanName = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, "");
  const parts = cleanName.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return cleanName[0].toUpperCase();
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4f46e5, #3730a3)",
  "linear-gradient(135deg, #059669, #047857)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #d97706, #b45309)",
  "linear-gradient(135deg, #475569, #334155)",
  "linear-gradient(135deg, #0284c7, #0369a1)",
  "linear-gradient(135deg, #9333ea, #7e22ce)",
];

const getColorForName = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const StaffManagement = () => {
  const { user } = useAuth(); 
  const isHOD = user?.role_code === "HOD"; 

  const [activeTab, setActiveTab] = useState("faculty");
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const { activeAcademicYear, activeDepartment } = useAcademic();
  const [showWorkloadModal, setShowWorkloadModal] = useState(false);
  const [selectedWorkload, setSelectedWorkload] = useState([]);
  const [workloadFacultyName, setWorkloadFacultyName] = useState("");

  const handleViewWorkload = async (faculty) => {
    if (!activeAcademicYear)
      return showToast("Select an Academic Year first.", "error");
    try {
      const res = await academicService.getAllocations(
        activeAcademicYear.id,
        faculty.id,
      );
      setSelectedWorkload(res.data);
      setWorkloadFacultyName(faculty.full_name || faculty.name);
      setShowWorkloadModal(true);
    } catch (err) {
      showToast("Failed to load workload data.", "error");
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    fetchMembers();
    fetchDepartments();
  }, [activeTab]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const fetchDepartments = async () => {
    try {
      const res = await staffService.getDepartments();
      setDepartments(res.data);
    } catch (e) {
      console.error("Could not load departments");
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response =
        activeTab === "staff"
          ? await staffService.getStaff()
          : await staffService.getFaculty();
      setMembers(response.data);
    } catch (error) {
      showToast("Failed to fetch team members", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async (email, role) => {
    try {
      await staffService.inviteStaff({ email, role, action: "resend" });
      showToast(`Invite resent to ${email}`, "success");
    } catch (err) {
      showToast("Failed to resend invite", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (activeTab === "staff")
        await staffService.deleteStaff(deleteTarget.id);
      else await staffService.deleteFaculty(deleteTarget.id);
      showToast("User removed successfully", "success");
      fetchMembers();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    const displayName = m.full_name || m.name || "";
    return (
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="staff-container">
      <div
        className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}
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
          <h1 className="page-title">Team Management</h1>
          <p className="page-subtitle">
            Manage system access and academic faculty
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus size={18} />{" "}
          {activeTab === "staff" ? "Invite Staff" : "Add Faculty"}
        </motion.button>
      </div>

      <div className="tabs-container">
        {["faculty", "staff"].map((tab) => {
          if (isHOD && tab === "staff") return null;

          return (
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
          );
        })}
      </div>

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
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => {
                    const displayName = member.full_name || member.name || "Unknown";
                    const isSelf = member.email === user?.email; 
                    
                    const deptName = member.department_name || member.department || "";
                    const isExternal = isHOD && deptName !== activeDepartment?.name;

                    return (
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
                                  background: getColorForName(displayName),
                                }}
                              >
                                {getInitials(displayName)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{displayName}</div>
                              <div className="text-sm text-muted">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {member.role_code === "HOD" ? (
                            <span
                              className="badge"
                              style={{
                                background: "#f59e0b",
                                color: "#fff",
                                fontWeight: "bold",
                              }}
                            >
                              Head of Department
                            </span>
                          ) : activeTab === "faculty" ? (
                            <span className="badge badge-designation">
                              {member.designation || "Faculty"}
                            </span>
                          ) : (
                            <span className="badge badge-role">
                              {member.role_code === "ORG_ADMIN" ||
                              member.role_code === "SUPER_ADMIN"
                                ? "Admin"
                                : "Staff"}
                            </span>
                          )}
                        </td>
                        <td>
                          {deptName || "-"}
                          {isExternal && (
                            <span style={{ fontSize: "0.7rem", marginLeft: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#d97706", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>
                              External
                            </span>
                          )}
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
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            {activeTab === "faculty" && (
                              <button
                                className="btn-icon action-edit"
                                onClick={() => handleViewWorkload(member)}
                                title="View Workload"
                                style={{ color: "#3b82f6" }}
                              >
                                <Info size={16} />
                              </button>
                            )}
                            
                            {activeTab === "faculty" && !(isHOD && isSelf) && !isExternal && (
                              <button
                                className="btn-icon action-edit"
                                onClick={() => setEditTarget(member)}
                                title="Edit Faculty"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {activeTab === "staff" &&
                              member.status === "Invited" && (
                                <button
                                  className="btn-icon action-edit"
                                  onClick={() =>
                                    handleResendInvite(
                                      member.email,
                                      member.role_code,
                                    )
                                  }
                                  title="Resend Email"
                                >
                                  <Send size={16} />
                                </button>
                              )}
                              
                            {member.role_code !== "ORG_ADMIN" && !(isHOD && isSelf) && !isExternal && (
                              <button
                                className="btn-icon action-delete"
                                onClick={() => setDeleteTarget(member)}
                                title="Remove User"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
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

      <AnimatePresence>
        {showAddModal &&
          (activeTab === "staff" ? (
            <InviteStaffModal
              onClose={() => setShowAddModal(false)}
              onRefresh={fetchMembers}
              showToast={showToast}
            />
          ) : (
            <FacultyFormModal
              onClose={() => setShowAddModal(false)}
              onRefresh={fetchMembers}
              showToast={showToast}
              departments={departments}
              isHOD={isHOD}
              activeDepartment={activeDepartment}
            />
          ))}

        {editTarget && (
          <FacultyFormModal
            facultyData={editTarget}
            onClose={() => setEditTarget(null)}
            onRefresh={fetchMembers}
            showToast={showToast}
            departments={departments}
            isHOD={isHOD}
            activeDepartment={activeDepartment}
          />
        )}

        {deleteTarget && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content premium-modal delete-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="delete-icon-wrapper">
                <Trash2 size={32} />
              </div>
              <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                Remove User?
              </h3>
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  marginBottom: "2rem",
                }}
              >
                Are you sure you want to remove{" "}
                <strong>{deleteTarget.full_name || deleteTarget.name}</strong>?
              </p>
              <div
                className="modal-actions"
                style={{
                  justifyContent: "center",
                  borderTop: "none",
                  paddingTop: 0,
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmDelete}>
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
        
        {showWorkloadModal && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content premium-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="modal-header">
                <div>
                  <h3>Faculty Workload</h3>
                  <p>Current assignments for Prof. {workloadFacultyName}</p>
                </div>
                <button
                  onClick={() => setShowWorkloadModal(false)}
                  className="close-btn"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                style={{
                  marginTop: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {selectedWorkload.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    No subjects assigned for this academic year.
                  </div>
                ) : (
                  selectedWorkload.map((alloc) => (
                    <div
                      key={alloc.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "1rem",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "var(--text-primary)",
                          }}
                        >
                          {alloc.subject_name} ({alloc.subject_code})
                        </strong>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Semester {alloc.semester} •{" "}
                          {alloc.subject_type.replace("_", " ")}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            background: "var(--bg-card)",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "0.85rem",
                            fontWeight: "bold",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          Batch: {alloc.group_name}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FacultyFormModal = ({
  onClose,
  onRefresh,
  showToast,
  departments,
  facultyData = null,
  isHOD,
  activeDepartment,
}) => {
  const isEdit = !!facultyData;

  const resolvedName = facultyData?.full_name || facultyData?.name || "";

  let initialDeptId = "";
  if (facultyData) {
    if (facultyData.department_id) initialDeptId = facultyData.department_id;
    else if (typeof facultyData.department === "number") initialDeptId = facultyData.department;
    else {
      const found = departments.find(d => d.name === facultyData.department);
      if (found) initialDeptId = found.id;
    }
  }
  
  if (!initialDeptId) {
    initialDeptId = (isHOD && activeDepartment) ? activeDepartment.id : (departments.length > 0 ? departments[0].id : "");
  }

  const [formData, setFormData] = useState({
    full_name: resolvedName,
    email: facultyData?.email || "",
    // FIX: Safely preserve existing roles (like Admin/HOD) to prevent accidental demotions
    role: facultyData ? facultyData.role_code : (isHOD ? "FACULTY" : "FACULTY"),
    designation: facultyData?.designation || "Assistant Professor",
    phone_number: facultyData?.phone_number || "",
    department_id: initialDeptId,
    profile_picture: null,
    remove_picture: false,
  });

  const [preview, setPreview] = useState(
    facultyData?.profile_picture
      ? `http://127.0.0.1:8000${facultyData.profile_picture}`
      : null,
  );
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        profile_picture: file,
        remove_picture: false,
      });
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, profile_picture: null, remove_picture: true });
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = new FormData();

    Object.keys(formData).forEach((key) => {
      if (key === "designation" && formData.role === "HOD") {
        payload.append("designation", "Head of Department");
      } else if (formData[key] !== null) {
        payload.append(key, formData[key]);
      }
    });

    try {
      if (isEdit) await staffService.editFaculty(facultyData.id, payload);
      else await staffService.addFaculty(payload);

      showToast(
        isEdit
          ? "Faculty member updated!"
          : "Faculty member added successfully!",
      );
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Error saving faculty", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <div className="modal-header">
          <div>
            <h3>{isEdit ? "Edit Faculty Profile" : "Add New Faculty"}</h3>
            <p className="modal-subtitle">
              {isEdit
                ? "Update their academic details."
                : "Create their academic profile."}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="avatar-selection-area">
            <div className="avatar-preview-large">
              {preview ? (
                <img src={preview} alt="Preview" />
              ) : (
                <div
                  className="monogram-avatar"
                  style={{
                    background: getColorForName(formData.full_name || "F"),
                  }}
                >
                  {getInitials(formData.full_name)}
                </div>
              )}
            </div>
            <div className="avatar-options">
              {preview ? (
                <div className="file-active-controls">
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle size={14} /> Photo Applied
                  </span>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="btn-link-danger"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="upload-link-btn">
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
            <div className="sinput-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <UserIcon size={18} className="input-icon" />
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="sinput-group">
              <label>College Email</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  required
                  disabled={isEdit}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  style={
                    isEdit
                      ? { backgroundColor: "var(--bg-main)", opacity: 0.7 }
                      : {}
                  }
                />
              </div>
            </div>

            <div className="sinput-group">
              <label>Assigned Department</label>
              <div className="input-wrapper">
                <GraduationCap size={18} className="input-icon" />
                <select
                  required
                  value={formData.department_id}
                  disabled={isHOD}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
                  style={
                    isHOD ? { backgroundColor: "var(--bg-main)", opacity: 0.7 } : {}
                  }
                >
                  <option value="" disabled>
                    Select Department...
                  </option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="input-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <div className="sinput-group">
                <label>System Role</label>
                <div className="input-wrapper">
                  <Briefcase size={18} className="input-icon" />
                  <select
                    value={formData.role}
                    disabled={isHOD || ["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code)} 
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    style={
                      isHOD || ["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code) 
                        ? { backgroundColor: "var(--bg-main)", opacity: 0.7 } 
                        : {}
                    }
                  >
                    <option value="FACULTY">Teaching Faculty</option>
                    {!isHOD && <option value="HOD">Head of Department (HOD)</option>}
                    {/* Preserve Admin visually if they are editing themselves */}
                    {["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code) && (
                      <option value={facultyData.role_code}>Organization Admin</option>
                    )}
                  </select>
                </div>
              </div>

              {formData.role !== "HOD" && (
                <div className="sinput-group">
                  <label>Designation</label>
                  <div className="input-wrapper">
                    <Briefcase size={18} className="input-icon" />
                    <select
                      value={formData.designation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          designation: e.target.value,
                        })
                      }
                    >
                      <option>Assistant Professor</option>
                      <option>Associate Professor</option>
                      <option>Professor</option>
                      <option>Visiting Faculty</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="sinput-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="text"
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
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Profile"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const InviteStaffModal = ({ onClose, onRefresh, showToast }) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await staffService.inviteStaff({ email, role });
      showToast(`Invite sent to ${email}`);
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Error inviting staff", "error");
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
            <h3>Invite Staff</h3>
            <p className="modal-subtitle">Send an invitation to join.</p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="sinput-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="sinput-group">
            <label>Access Level</label>
            <div className="input-wrapper">
              <Briefcase size={18} className="input-icon" />
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="STAFF">Viewer (Read Only)</option>
                <option value="ORG_ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
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