import React, { useState, useEffect } from "react";
import { studentService } from "../../services/api";
import { 
  UserCircle, MapPin, Users, Award, Mail, Phone, 
  Calendar, CheckCircle, AlertTriangle, ShieldCheck, CreditCard
} from "lucide-react";
import { motion } from "framer-motion";
import "./StudentProfile.css";

const StudentProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await studentService.getProfile();
      setProfile(res.data);
    } catch (error) {
      console.error("Failed to fetch profile", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (pData) => {
    if (!pData) return 0;
    const requiredFields = [
      'address', 'pin_code', 'contact_number',
      'father_name', 'father_occupation', 'father_contact',
      'mother_name', 'mother_occupation', 'mother_contact',
      'hobbies', 'achievements'
    ];
    let filled = 0;
    requiredFields.forEach(f => {
      if (pData[f] && String(pData[f]).trim() !== '') filled++;
    });
    return Math.round((filled / requiredFields.length) * 100);
  };

  if (loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;
  if (!profile) return <div style={{ textAlign: 'center', padding: '3rem' }}>Profile data not available.</div>;

  const menteeData = profile.profile || {};
  const progress = calculateProgress(menteeData);

  return (
    <div className="student-profile-page fade-in">
      
      {/* --- BANNER & HEADER --- */}
      <div className="sp-header-card">
        <div className="sp-cover-banner"></div>
        <div className="sp-profile-info-row">
          <div className="sp-avatar-wrapper">
            {profile.full_name.charAt(0)}
          </div>
          
          <div className="sp-primary-details">
            <h1>{profile.full_name}</h1>
            <p>
              <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{profile.roll_number}</span> 
              <span style={{ opacity: 0.5 }}>|</span> {profile.enrollment_number || "No Enroll No"} 
              <span style={{ opacity: 0.5 }}>|</span> {profile.department_name} 
              <span style={{ opacity: 0.5 }}>|</span> Semester {profile.current_semester}
            </p>
          </div>

          <div style={{ paddingBottom: '10px' }}>
            <span className="sp-status-badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <ShieldCheck size={16} /> Active Student
            </span>
          </div>
        </div>
      </div>

      {/* --- PROGRESS BAR --- */}
      <div className="sp-progress-container">
        <div className="sp-progress-header">
          <span style={{ color: 'var(--text-secondary)' }}>Mentee Profile Completion</span>
          <span style={{ color: progress === 100 ? '#10b981' : 'var(--primary-color)' }}>
            {progress === 100 ? <><CheckCircle size={14} style={{ display: 'inline', marginBottom: '-2px' }}/> Complete</> : `${progress}%`}
          </span>
        </div>
        <div className="sp-progress-bg">
          <div className="sp-progress-fill" style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : 'var(--primary-color)' }}></div>
        </div>
        {progress < 100 && (
          <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={14} /> Please contact your counsellor to complete your pending profile details.
          </p>
        )}
      </div>

      {/* --- DETAILS GRID --- */}
      <div className="sp-details-grid">
        
        {/* CARD 1: Core Info */}
        <motion.div className="sp-detail-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="sp-card-header">
            <div className="sp-icon-box"><UserCircle size={20} /></div>
            <h3>Core Information</h3>
          </div>
          <div className="sp-data-list">
            <div className="sp-data-item"><span className="sp-data-label">Full Name</span><span className="sp-data-value">{profile.full_name}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">College Email</span><span className="sp-data-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} className="text-muted"/> {profile.email}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">Primary Mobile No.</span><span className="sp-data-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} className="text-muted"/> {profile.mobile_number || <span className="sp-data-empty">Not specified</span>}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">Date of Birth</span><span className="sp-data-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} className="text-muted"/> {profile.dob || <span className="sp-data-empty">Not specified</span>}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">Gender</span><span className="sp-data-value">{profile.gender || <span className="sp-data-empty">Not specified</span>}</span></div>
          </div>
        </motion.div>

        {/* NEW CARD: Official Identifications */}
        <motion.div className="sp-detail-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="sp-card-header">
            <div className="sp-icon-box"><CreditCard size={20} /></div>
            <h3>Official Identifications & Records</h3>
          </div>
          <div className="sp-data-list">
            <div className="sp-data-item"><span className="sp-data-label">AIC ID</span><span className="sp-data-value">{profile.aic_id || <span className="sp-data-empty">Not recorded</span>}</span></div>
            <div className="sp-data-item">
                <span className="sp-data-label">Aadhar ID Number</span>
                <span className="sp-data-value" style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {profile.aadhar_number ? `•••• •••• ${String(profile.aadhar_number).slice(-4)}` : <span className="sp-data-empty" style={{ letterSpacing: 'normal', fontFamily: 'inherit' }}>Not recorded</span>}
                </span>
            </div>
            <div className="sp-data-item"><span className="sp-data-label">Name on Aadhar</span><span className="sp-data-value">{profile.name_on_aadhar || <span className="sp-data-empty">Not recorded</span>}</span></div>
            {profile.remarks && (
               <div className="sp-data-item" style={{ marginTop: '10px' }}><span className="sp-data-label" style={{ color: 'var(--primary-color)' }}>Official Remarks</span><span className="sp-data-value" style={{ fontStyle: 'italic' }}>{profile.remarks}</span></div>
            )}
          </div>
        </motion.div>

        {/* CARD 3: Contact Info */}
        <motion.div className="sp-detail-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="sp-card-header">
            <div className="sp-icon-box"><MapPin size={20} /></div>
            <h3>Address & Mentee Contact</h3>
          </div>
          <div className="sp-data-list">
            <div className="sp-data-item"><span className="sp-data-label">Mentee Contact No.</span><span className="sp-data-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} className="text-muted"/> {menteeData.contact_number || <span className="sp-data-empty">Not specified</span>}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">Residential Address</span><span className="sp-data-value">{menteeData.address || <span className="sp-data-empty">Not specified</span>}</span></div>
            <div className="sp-data-item"><span className="sp-data-label">Pin Code</span><span className="sp-data-value">{menteeData.pin_code || <span className="sp-data-empty">Not specified</span>}</span></div>
          </div>
        </motion.div>

        {/* CARD 4: Family Info */}
        <motion.div className="sp-detail-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="sp-card-header">
            <div className="sp-icon-box"><Users size={20} /></div>
            <h3>Family Details</h3>
          </div>
          <div className="sp-data-list">
            <div className="sp-data-item">
              <span className="sp-data-label" style={{ color: 'var(--primary-color)' }}>Father's Details</span>
              <span className="sp-data-value">{menteeData.father_name || <span className="sp-data-empty">Name not specified</span>}</span>
              {menteeData.father_occupation && <span className="sp-data-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Occupation: {menteeData.father_occupation}</span>}
              {menteeData.father_contact && <span className="sp-data-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Phone size={12} style={{display:'inline'}}/> {menteeData.father_contact}</span>}
            </div>
            
            <div className="sp-data-item" style={{ marginTop: '10px' }}>
              <span className="sp-data-label" style={{ color: 'var(--primary-color)' }}>Mother's Details</span>
              <span className="sp-data-value">{menteeData.mother_name || <span className="sp-data-empty">Name not specified</span>}</span>
              {menteeData.mother_occupation && <span className="sp-data-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Occupation: {menteeData.mother_occupation}</span>}
              {menteeData.mother_contact && <span className="sp-data-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Phone size={12} style={{display:'inline'}}/> {menteeData.mother_contact}</span>}
            </div>

            {(menteeData.guardian_name || menteeData.guardian_contact) && (
              <div className="sp-data-item" style={{ marginTop: '10px' }}>
                <span className="sp-data-label" style={{ color: 'var(--primary-color)' }}>Local Guardian</span>
                <span className="sp-data-value">{menteeData.guardian_name}</span>
                {menteeData.guardian_contact && <span className="sp-data-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Phone size={12} style={{display:'inline'}}/> {menteeData.guardian_contact}</span>}
              </div>
            )}
          </div>
        </motion.div>

        {/* CARD 5: Extracurriculars */}
        <motion.div className="sp-detail-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="sp-card-header">
            <div className="sp-icon-box"><Award size={20} /></div>
            <h3>Activities & Achievements</h3>
          </div>
          <div className="sp-data-list">
            <div className="sp-data-item">
              <span className="sp-data-label">Hobbies & Interests</span>
              <span className="sp-data-value" style={{ whiteSpace: 'pre-wrap' }}>{menteeData.hobbies || <span className="sp-data-empty">No hobbies recorded</span>}</span>
            </div>
            <div className="sp-data-item" style={{ marginTop: '10px' }}>
              <span className="sp-data-label">Achievements & Victories</span>
              <span className="sp-data-value" style={{ whiteSpace: 'pre-wrap' }}>{menteeData.achievements || <span className="sp-data-empty">No achievements recorded</span>}</span>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default StudentProfile;