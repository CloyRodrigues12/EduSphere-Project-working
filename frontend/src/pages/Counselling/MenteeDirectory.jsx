import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { 
  Search, Users, UserCircle, MapPin, 
  Phone, Briefcase, Heart, Award, X, Edit3, Save, CheckCircle
} from "lucide-react";
import "./MenteeDirectory.css";

const MenteeDirectory = () => {
  const { user } = useAuth();
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer State
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const getToken = () => localStorage.getItem("access_token");
  const getBaseUrl = () => import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    fetchMentees();
  }, []);

  const fetchMentees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getBaseUrl()}/api/counselling/mentees/`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMentees(res.data);
    } catch (err) {
      console.error("Failed to fetch mentees", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentees = mentees.filter(m => 
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.department_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openProfile = (mentee) => {
    setSelectedMentee(mentee);
    setIsEditing(false);
    // Initialize form with existing profile data or empty strings
    const p = mentee.profile || {};
    setFormData({
      address: p.address || "",
      pin_code: p.pin_code || "",
      contact_number: p.contact_number || "",
      father_name: p.father_name || "",
      father_occupation: p.father_occupation || "",
      father_contact: p.father_contact || "",
      mother_name: p.mother_name || "",
      mother_occupation: p.mother_occupation || "",
      mother_contact: p.mother_contact || "",
      guardian_name: p.guardian_name || "",
      guardian_contact: p.guardian_contact || "",
      hobbies: p.hobbies || "",
      achievements: p.achievements || ""
    });
  };

  const closeProfile = () => {
    setSelectedMentee(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { profile: formData };
      const res = await axios.patch(
        `${getBaseUrl()}/api/counselling/mentees/${selectedMentee.id}/`, 
        payload, 
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      
      // Update local state so UI reflects changes instantly
      setMentees(mentees.map(m => m.id === selectedMentee.id ? res.data : m));
      setSelectedMentee(res.data);
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save profile details.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="mentee-directory-container fade-in">
      
      {/* HEADER */}
      <div className="directory-header">
        <div>
          <h1>Mentee Profiles</h1>
          <p>Digitized Registration Forms & Background Details</p>
        </div>
        <div className="search-bar-wrapper">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by name, roll number, or department..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* GRID */}
      {loading ? (
        <div className="spinner" style={{ margin: "5rem auto" }}></div>
      ) : filteredMentees.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border-color)" }}>
          <Users size={48} style={{ color: "var(--text-muted)", opacity: 0.5, margin: "0 auto 1rem auto" }} />
          <h3 style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}>No Mentees Found</h3>
          <p style={{ color: "var(--text-secondary)" }}>Adjust your search or check your mentorship allocations.</p>
        </div>
      ) : (
        <div className="mentee-grid">
          {filteredMentees.map(mentee => (
            <div key={mentee.id} className="mentee-card" onClick={() => openProfile(mentee)}>
              <div className="mentee-card-top">
                <div className="mentee-avatar">{mentee.full_name.charAt(0)}</div>
                <div className="mentee-info">
                  <h3>{mentee.full_name}</h3>
                  <p>{mentee.roll_number}</p>
                </div>
              </div>
              <div className="mentee-badges">
                <span className="m-badge">Sem {mentee.current_semester}</span>
                <span className="m-badge">{mentee.department_name}</span>
                {mentee.profile ? (
                  <span className="m-badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.2)" }}>
                    <CheckCircle size={12} style={{ display: "inline", marginRight: "4px" }}/> Profile Active
                  </span>
                ) : (
                   <span className="m-badge" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.2)" }}>
                    Incomplete
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RIGHT SLIDING DRAWER (PROFILE REGISTRATION FORM) */}
      <AnimatePresence>
        {selectedMentee && (
          <div className="drawer-overlay" onClick={closeProfile}>
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.3 }}
              className="drawer-panel" onClick={e => e.stopPropagation()}
            >
              <div className="drawer-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>{selectedMentee.full_name}</h2>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Registration Form</span>
                </div>
                <button className="icon-btn" onClick={closeProfile}><X size={22} /></button>
              </div>

              <div className="drawer-content">
                
                {/* SECTION 1: Core Read-Only Info */}
                <div>
                  <div className="form-section-title"><UserCircle size={18} /> Core Academic Info</div>
                  <div className="form-grid">
                    <div className="form-group"><label>Roll Number</label><input disabled value={selectedMentee.roll_number} /></div>
                    <div className="form-group"><label>Department</label><input disabled value={selectedMentee.department_name} /></div>
                    <div className="form-group"><label>Semester / Class</label><input disabled value={`Semester ${selectedMentee.current_semester}`} /></div>
                    <div className="form-group"><label>Date of Birth</label><input disabled value={selectedMentee.dob || "N/A"} /></div>
                    <div className="form-group"><label>Gender</label><input disabled value={selectedMentee.gender || "N/A"} /></div>
                    <div className="form-group"><label>College Email</label><input disabled value={selectedMentee.email} /></div>
                  </div>
                </div>

                {/* SECTION 2: Personal Contact Info */}
                <div>
                  <div className="form-section-title"><MapPin size={18} /> Contact Details</div>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Residential Address</label>
                      <textarea rows="2" name="address" disabled={!isEditing} value={formData.address} onChange={handleChange} placeholder={isEditing ? "Enter full address..." : "-"} />
                    </div>
                    <div className="form-group"><label>Pin Code</label><input name="pin_code" disabled={!isEditing} value={formData.pin_code} onChange={handleChange} placeholder={isEditing ? "e.g. 403602" : "-"} /></div>
                    <div className="form-group"><label>Mentee Mobile No.</label><input name="contact_number" disabled={!isEditing} value={formData.contact_number} onChange={handleChange} placeholder={isEditing ? "e.g. +91 98765..." : "-"} /></div>
                  </div>
                </div>

                {/* SECTION 3: Family Details */}
                <div>
                  <div className="form-section-title"><Users size={18} /> Family Details</div>
                  <div className="form-grid">
                    <div className="form-group full-width"><label style={{ color: "var(--primary-color)" }}>Father's Details</label></div>
                    <div className="form-group"><label>Name</label><input name="father_name" disabled={!isEditing} value={formData.father_name} onChange={handleChange} placeholder={isEditing ? "Father's full name" : "-"} /></div>
                    <div className="form-group"><label>Occupation</label><input name="father_occupation" disabled={!isEditing} value={formData.father_occupation} onChange={handleChange} placeholder={isEditing ? "e.g. Business" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="father_contact" disabled={!isEditing} value={formData.father_contact} onChange={handleChange} placeholder={isEditing ? "Mobile number" : "-"} /></div>
                    
                    <div className="form-group full-width" style={{ marginTop: "10px" }}><label style={{ color: "var(--primary-color)" }}>Mother's Details</label></div>
                    <div className="form-group"><label>Name</label><input name="mother_name" disabled={!isEditing} value={formData.mother_name} onChange={handleChange} placeholder={isEditing ? "Mother's full name" : "-"} /></div>
                    <div className="form-group"><label>Occupation</label><input name="mother_occupation" disabled={!isEditing} value={formData.mother_occupation} onChange={handleChange} placeholder={isEditing ? "e.g. Teacher" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="mother_contact" disabled={!isEditing} value={formData.mother_contact} onChange={handleChange} placeholder={isEditing ? "Mobile number" : "-"} /></div>

                    <div className="form-group full-width" style={{ marginTop: "10px" }}><label style={{ color: "var(--primary-color)" }}>Local Guardian (If applicable)</label></div>
                    <div className="form-group"><label>Name</label><input name="guardian_name" disabled={!isEditing} value={formData.guardian_name} onChange={handleChange} placeholder={isEditing ? "Guardian's name" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="guardian_contact" disabled={!isEditing} value={formData.guardian_contact} onChange={handleChange} placeholder={isEditing ? "Mobile number" : "-"} /></div>
                  </div>
                </div>

                {/* SECTION 4: Extra-Curriculars */}
                <div>
                  <div className="form-section-title"><Award size={18} /> Activities & Achievements</div>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label><Heart size={14} style={{ display: "inline", marginRight: "4px" }}/> Hobbies / Interests</label>
                      <textarea rows="3" name="hobbies" disabled={!isEditing} value={formData.hobbies} onChange={handleChange} placeholder={isEditing ? "Sports, reading, coding..." : "-"} />
                    </div>
                    <div className="form-group full-width">
                      <label><Award size={14} style={{ display: "inline", marginRight: "4px" }}/> Achievements & Victories</label>
                      <textarea rows="3" name="achievements" disabled={!isEditing} value={formData.achievements} onChange={handleChange} placeholder={isEditing ? "Hackathons won, sports medals..." : "-"} />
                    </div>
                  </div>
                </div>

              </div>

              {/* DRAWER FOOTER (ACTIONS) */}
              <div className="drawer-footer">
                {!isEditing ? (
                  <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                    <Edit3 size={18} /> Edit Profile Data
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => { setIsEditing(false); openProfile(selectedMentee); }} disabled={saving}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : <><Save size={18} /> Save Changes</>}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenteeDirectory;