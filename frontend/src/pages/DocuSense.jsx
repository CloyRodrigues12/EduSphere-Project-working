import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  FileText,
  BarChart2,
  Loader2,
  Sparkles,
  Download,
  Cpu,
  AlertTriangle,
} from "lucide-react";
import AnalysisModal from "../components/docusense/AnalysisModal";
import "./DocuSense.css";

const DocuSense = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/docusense/upload/`
      );
      setDocuments(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/docusense/upload/`,
        formData
      );
      setFile(null);
      fetchDocuments();
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // --- NEW: Secure Download Handler ---
  const handleDownload = async (docId, filename) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/docusense/download/${docId}/`,
        { responseType: "blob" } // Important for files
      );

      // Create Blob Link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      // Extract filename or use default
      link.setAttribute("download", `${filename.split(".")[0]}_Report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Download failed. File might not be ready.");
    }
  };

  return (
    <div className="docusense-container">
      <header className="page-header">
        <div>
          <h2>
            <Sparkles className="spin-slow" size={28} color="var(--primary)" />{" "}
            DocuSense AI
          </h2>
          <p>Intelligent Result Analysis System</p>
        </div>
      </header>

      <div className="ds-layout">
        {/* LEFT PANEL: UPLOAD */}
        <div className="upload-panel">
          <div className="panel-title">Upload Result PDF</div>
          <div className="drop-zone">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <div className="drop-content">
              <UploadCloud
                size={48}
                style={{ marginBottom: "1rem", color: "var(--primary)" }}
              />
              <h3>{file ? file.name : "Drag & Drop or Click"}</h3>
              <p>Supports Goa University Result PDFs</p>
            </div>
          </div>
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={uploading || !file}
          >
            {uploading ? <Loader2 className="spin" /> : "Start Analysis"}
          </button>
        </div>

        {/* RIGHT PANEL: ACTIVITY LIST */}
        <div className="activity-section">
          <div className="list-header">
            <span>Recent Activity</span>
            <span>{documents.length} Files</span>
          </div>

          <div className="doc-list">
            {documents.length === 0 && (
              <div
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No documents found. Upload one to start.
              </div>
            )}

            {documents.map((doc) => (
              <div key={doc.id} className="doc-row">
                <div className="doc-icon">
                  {doc.status === "PROCESSING" ? (
                    <Cpu className="spin-slow" />
                  ) : doc.status === "FAILED" ? (
                    <AlertTriangle color="#ef4444" />
                  ) : (
                    <FileText />
                  )}
                </div>

                <div className="doc-info">
                  <div className="doc-name">{doc.filename}</div>

                  {doc.status === "PROCESSING" ? (
                    <div className="processing-container">
                      <div className="proc-header">
                        <span>
                          {doc.analysis_data?.current_log || "Initializing..."}
                        </span>
                        <span className="proc-eta">
                          {doc.analysis_data?.eta || "Calculating..."}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${doc.analysis_data?.progress || 0}%`,
                          }}
                        ></div>
                      </div>
                      <div className="proc-logs">
                        <span>{doc.analysis_data?.meta?.size_mb} MB</span>
                        <span>{doc.analysis_data?.progress}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="doc-meta">
                      <span className={`badge ${doc.status}`}>
                        {doc.status}
                      </span>
                      <span>
                        {new Date(doc.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {doc.status === "COMPLETED" && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="upload-btn"
                      style={{ padding: "8px", width: "auto", marginTop: 0 }}
                    >
                      <BarChart2 size={18} />
                    </button>
                    {/* DOWNLOAD BUTTON CALLS FUNCTION */}
                    <button
                      onClick={() => handleDownload(doc.id, doc.filename)}
                      className="upload-btn"
                      style={{
                        padding: "8px",
                        width: "auto",
                        marginTop: 0,
                        background: "var(--bg-main)",
                        border: "1px solid var(--text-secondary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Download size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
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
