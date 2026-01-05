// frontend/src/pages/DocuSense.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  FileText,
  BarChart2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Clock,
  File,
  Eye,
  Download, // <--- Added Download Icon
} from "lucide-react";
import AnalysisModal from "../components/docusense/AnalysisModal";
import "./DocuSense.css";

const DocuSense = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("RESULT");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    fetchDocuments();
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
      setFile(null);
      fetchDocuments();
    } catch (error) {
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // --- NEW: Download Function ---
  const handleDownload = async (e, doc) => {
    e.stopPropagation(); // Prevent opening the modal when clicking download
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/docusense/download/${doc.id}/`,
        { responseType: "blob" } // Important: Treat response as a file
      );

      // Create a temporary link to trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `DocuSense_Report_${doc.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed", error);
      alert("Could not download the report. Please try again.");
    }
  };

  const handleFileChange = (e) => setFile(e.target.files?.[0]);

  const handleDocClick = (doc) => {
    if (doc.status === "COMPLETED") setSelectedDoc(doc);
  };

  return (
    <div className="docusense-container">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2>
            <Sparkles size={28} color="var(--primary)" /> DocuSense Intelligence
          </h2>
          <p>AI-Powered Document Analysis</p>
        </div>
      </div>

      <div className="ds-layout">
        {/* LEFT COLUMN: UPLOAD */}
        <div className="upload-panel">
          <div className="panel-title">New Analysis</div>
          <div className="toggle-wrapper">
            <button
              className={`toggle-btn ${category === "RESULT" ? "active" : ""}`}
              onClick={() => setCategory("RESULT")}
            >
              <BarChart2 size={18} /> University Result
            </button>
            <button
              className={`toggle-btn ${category === "REPORT" ? "active" : ""}`}
              onClick={() => setCategory("REPORT")}
            >
              <FileText size={18} /> Academic Report
            </button>
          </div>

          <div
            className={`drop-zone ${isDragging ? "active-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              style={{ display: "none" }}
              accept=".pdf,.xlsx,.csv,.docx"
            />
            <label
              htmlFor="fileInput"
              style={{ cursor: "pointer", display: "block" }}
            >
              <div className="drop-content">
                {file ? (
                  <>
                    <FileText
                      size={56}
                      color="var(--primary)"
                      style={{ margin: "0 auto" }}
                    />
                    <h3>{file.name}</h3>
                    <p>Ready to analyze</p>
                  </>
                ) : (
                  <>
                    <UploadCloud
                      size={56}
                      color={
                        isDragging ? "var(--primary)" : "var(--text-secondary)"
                      }
                      style={{ margin: "0 auto" }}
                    />
                    <h3>Click to Upload</h3>
                    <p>or drag PDF / Excel here</p>
                  </>
                )}
              </div>
            </label>
          </div>

          {file && (
            <button
              className="upload-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="spin" /> Processing...
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Start Analysis
                </>
              )}
            </button>
          )}
        </div>

        {/* RIGHT COLUMN: LIST */}
        <div className="activity-section">
          <div className="list-header">
            <span>
              <Clock
                size={16}
                style={{ marginRight: "8px", display: "inline" }}
              />{" "}
              Recent Documents
            </span>
            <span>{documents.length} Files</span>
          </div>

          <div className="doc-list">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="doc-row"
                onClick={() => handleDocClick(doc)}
                style={{
                  cursor: doc.status === "COMPLETED" ? "pointer" : "default",
                }}
              >
                <div className="doc-icon">
                  {doc.category === "RESULT" ? (
                    <BarChart2 size={24} />
                  ) : (
                    <File size={24} />
                  )}
                </div>
                <div className="doc-info">
                  <div className="doc-name">{doc.filename}</div>
                  <div className="doc-meta">
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </div>
                </div>
                <div className={`badge ${doc.status}`}>
                  {doc.status === "PROCESSING" && (
                    <Loader2
                      size={14}
                      className="spin"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  {doc.status === "COMPLETED" && (
                    <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                  )}
                  {doc.status}
                </div>

                {/* ACTIONS: Download & View */}
                {doc.status === "COMPLETED" && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      marginLeft: "10px",
                    }}
                  >
                    <button
                      onClick={(e) => handleDownload(e, doc)}
                      className="icon-btn"
                      title="Download PDF Report"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--primary)",
                      }}
                    >
                      <Download size={20} />
                    </button>
                    <Eye size={20} color="var(--text-secondary)" />
                  </div>
                )}
              </div>
            ))}
            {documents.length === 0 && (
              <div
                style={{
                  padding: "4rem",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No documents yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedDoc && (
        <AnalysisModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
};

export default DocuSense;
