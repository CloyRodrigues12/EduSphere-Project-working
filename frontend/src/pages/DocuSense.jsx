// frontend/src/pages/DocuSense.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  FileText,
  BarChart2,
  CheckCircle,
  Clock,
} from "lucide-react";
import "./DocuSense.css";

const DocuSense = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("RESULT"); // RESULT or REPORT
  const [file, setFile] = useState(null);

  // 1. Load previous documents on mount
  useEffect(() => {
    fetchDocuments();
    // Optional: Auto-poll every 5 seconds to check for completion
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/docusense/upload/`
      );
      setDocuments(res.data);
    } catch (error) {
      console.error("Error fetching docs", error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/docusense/upload/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setFile(null); // Clear input
      fetchDocuments(); // Refresh list immediately
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="ds-container">
      <div className="ds-header">
        <h2>DocuSense AI</h2>
        <p style={{ color: "#aaa" }}>
          Document-Driven Academic Intelligence. No Database Required.
        </p>
      </div>

      {/* --- UPLOAD SECTION --- */}
      <div className="upload-card">
        <div className="category-selector">
          <button
            className={`cat-btn ${category === "RESULT" ? "active" : ""}`}
            onClick={() => setCategory("RESULT")}
          >
            📊 University Result
          </button>
          <button
            className={`cat-btn ${category === "REPORT" ? "active" : ""}`}
            onClick={() => setCategory("REPORT")}
          >
            📑 Academic Report
          </button>
        </div>

        <div className="upload-zone">
          <input
            type="file"
            id="fileInput"
            onChange={handleFileChange}
            style={{ display: "none" }}
            accept=".pdf,.xlsx,.csv,.docx"
          />
          <label htmlFor="fileInput" style={{ cursor: "pointer" }}>
            <UploadCloud
              size={48}
              color="#4facfe"
              style={{ marginBottom: "1rem" }}
            />
            <h3>{file ? file.name : "Click to Upload Document"}</h3>
            <p style={{ color: "#888" }}>Supported: PDF, Excel, Word</p>
          </label>
        </div>

        {file && (
          <button
            className="submit-btn"
            onClick={handleUpload}
            disabled={uploading}
            style={{ marginTop: "1rem", width: "200px" }}
          >
            {uploading ? "Uploading..." : "🚀 Start Analysis"}
          </button>
        )}
      </div>

      {/* --- RECENT DOCUMENTS --- */}
      <h3
        style={{
          marginTop: "3rem",
          borderBottom: "1px solid #333",
          paddingBottom: "1rem",
        }}
      >
        Recent Analysis
      </h3>

      <div className="doc-grid">
        {documents.map((doc) => (
          <div key={doc.id} className="doc-card">
            <span className={`status-badge status-${doc.status}`}>
              {doc.status_display}
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  padding: "10px",
                  borderRadius: "8px",
                }}
              >
                {doc.category === "RESULT" ? (
                  <BarChart2 size={24} />
                ) : (
                  <FileText size={24} />
                )}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "1.1rem" }}>
                  {doc.filename}
                </h4>
                <small style={{ color: "#888" }}>
                  {new Date(doc.upload_date).toLocaleDateString()}
                </small>
              </div>
            </div>

            {/* Placeholder for future Stats */}
            {doc.status === "COMPLETED" ? (
              <div style={{ color: "#28a745", fontSize: "0.9rem" }}>
                <CheckCircle
                  size={14}
                  style={{ display: "inline", marginRight: "5px" }}
                />
                Analysis Ready. Click to view.
              </div>
            ) : (
              <div style={{ color: "#17a2b8", fontSize: "0.9rem" }}>
                <Clock
                  size={14}
                  style={{ display: "inline", marginRight: "5px" }}
                />
                AI is processing...
              </div>
            )}
          </div>
        ))}

        {documents.length === 0 && (
          <div
            style={{
              color: "#666",
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "2rem",
            }}
          >
            No documents processed yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default DocuSense;
