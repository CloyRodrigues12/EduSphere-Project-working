import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { resultsService, academicService } from "../services/api";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";

import "./InternalAssessment.css";

const InternalAssessment = () => {

const { user } = useAuth();

const [classes,setClasses] = useState([]);
const [selectedClass,setSelectedClass] = useState(null);
const [students,setStudents] = useState([]);
const [loading,setLoading] = useState(false);


/* ---------------- LOAD CLASSES ---------------- */

const { activeAcademicYear, activeTerm } = useAcademic();

useEffect(() => {
  if (activeAcademicYear && activeTerm) loadClasses();
}, [activeAcademicYear, activeTerm]);
const loadClasses = async () => {
  try {
    // 1. We use the unified resultsService we created, passing the active Term!
    const res = await resultsService.getAssessmentAllocations(activeAcademicYear.id, activeTerm);

    // 2. Process the data for the UI cards
    const processedData = res.data.map(c => {
      const sem = c.semester;
      let yl = "FE";
      if (sem > 2) yl = "SE";
      if (sem > 4) yl = "TE";
      if (sem > 6) yl = "BE";

      return {
        ...c,
        class_label: `${yl} ECS`,
        display_faculty: c.faculty_name 
          ? (c.faculty_name.startsWith("Prof.") ? c.faculty_name : `Prof. ${c.faculty_name}`) 
          : "Faculty"
      };
    });

    setClasses(processedData);
  } catch (err) {
    console.error("Error loading classes:", err);
  }
};

/* ---------------- LOAD MARKS ---------------- */

const loadMarksheet = async(allocation)=>{

setSelectedClass(allocation);
setLoading(true);

try{

const res = await resultsService.getMarksheet(allocation.id);

const processedStudents = res.data.map(student => {

const marks = [
student.it1 || 0,
student.it2 || 0,
student.it3 || 0
].sort((a,b)=>b-a);

const final = Number(((marks[0] + marks[1]) / 2).toFixed(2));

return {
...student,
final_score: final,
is_passing: final >= 10
};

});

setStudents(processedStudents);

}catch(err){
console.log("Error loading marks",err);
}

setLoading(false);

};


/* ---------------- EDIT MARKS ---------------- */

const handleMarkChange=(studentId,field,value)=>{

const num = value === "" ? null : parseFloat(value);

if(num!==null && (num>25 || num<0)) return;

setStudents(prev =>
 prev.map(s=>{

  if(s.student_id===studentId){

   const updated={...s,[field]:num};

   const marks=[
     updated.it1 || 0,
     updated.it2 || 0,
     updated.it3 || 0
   ].sort((a,b)=>b-a);

   updated.final_score = Number(((marks[0]+marks[1])/2).toFixed(2));
   updated.is_passing = updated.final_score >= 10;

   return updated;
  }

  return s;

 })
);

};


/* ---------------- SAVE MARKS ---------------- */

const handleSave = async()=>{

try{

await resultsService.saveMarks({
allocation_id:selectedClass.id,
marks:students
});

alert("Marks saved successfully");

}catch(err){

alert("Failed to save");

}

};


/* ---------------- DOWNLOAD REPORT ---------------- */

const handleDownloadReport = ()=>{

const doc = new jsPDF();

doc.setFontSize(20);
doc.text("Edusphere -Internal Assesment Report", 14, 20);

doc.setFontSize(14);
doc.text(`INTERNAL ASSESSMENT: ${selectedClass.subject_name}`, 14, 32);

doc.setFontSize(11);

doc.text(`Subject Code: ${selectedClass.course_code || selectedClass.subject_code || "-"}`, 14, 44);

const branchName = selectedClass.branch || (selectedClass.class_name ? selectedClass.class_name.split(' ').pop() : "ECS");
  doc.text(`Branch: ${branchName}`, 14, 52);

doc.text(`Semester: ${selectedClass.semester}`, 14, 60);

doc.text(`Faculty: ${selectedClass.faculty_name || "Faculty"}`, 14, 68);

doc.text(`Batch: ${selectedClass.group_name}`, 14, 76);

doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 84);

doc.line(14, 90, 196, 90);

const columns = [
"Sr",
"Roll No",
"Student Name",
"IT1",
"IT2",
"IT3",
"Final Avg",
"Status"
];

const rows = students.map((s,i)=>[
i+1,
s.roll_number || s.student_roll_number,
s.student_name,
s.it1 ?? "-",
s.it2 ?? "-",
s.it3 ?? "-",
s.final_score,
s.is_passing ? "PASS":"FAIL"
]);

autoTable(doc,{
startY:95,
head:[columns],
body:rows,
theme:"grid",

headStyles:{
fillColor:[79,70,229],
textColor:[255,255,255]
},

didParseCell:(data)=>{

if(data.column.index===7 && data.cell.section==="body"){

if(data.cell.raw==="FAIL")
data.cell.styles.textColor=[220,38,38];

if(data.cell.raw==="PASS")
data.cell.styles.textColor=[5,150,105];

}

}

});

doc.save(`${selectedClass.subject_name}_Internal_Report.pdf`);

};


/* ---------------- CLASS SCREEN ---------------- */

/* ---------------- CLASS SCREEN ---------------- */
if (!selectedClass) {
  return (
    // Wrap in this ID to activate your Attendance CSS
    <div id="attendance-engine-root" className="fade-in">
      <div className="att-header-section">
        <h1 className="att-title">Internal Assessment</h1>
        <p className="att-subtitle">
          {user?.role_code === "ORG_ADMIN"
            ? "College-wide subject directory (Administration View)"
            : "Select a class to record or view internal marks"}
        </p>
      </div>

      {/* Use att-grid-layout for the correct spacing */}
      <div className="att-grid-layout mt-6">
        {classes.map((c) => (
          <motion.div
            key={c.id}
            // att-card-mine adds that blue border you wanted
            className="att-card att-card-mine"
            whileHover={{ y: -5 }}
            onClick={() => loadMarksheet(c)}
            style={{ cursor: "pointer" }}
          >
            {/* NO RIBBON HERE - Just the blue border */}
            
            <div className="att-card-icon">
              <div className="icon-box">📖</div>
            </div>

           <div className="att-card-details">
  <h3 className="text-xl font-bold">{c.subject_name}</h3>
  <div className="tags">
    {/* UPDATED: Change "ECS" to c.class_label */}
    <span className="tag">{c.class_label}</span>
    <span className="tag purple">Sem {c.semester}</span>
  </div>
  
  <p className="group">
    {c.class_name} • {c.group_name}
  </p>

  <div className="att-prof-badge">
    {/* UPDATED: Change c.faculty_name to c.display_faculty */}
    <span role="img" aria-label="teacher">👨‍🏫</span> {c.display_faculty}
  </div>
</div>

            <button className="att-btn att-btn-primary mt-4">
              Select Class
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}


/* ---------------- MARKS TABLE ---------------- */

return (
  <div id="attendance-engine-root" className="assessment-container fade-in">
    
    <div className="att-header-section with-back" style={{ marginBottom: '2rem' }}>
      <button
        className="att-back-btn"
        onClick={() => setSelectedClass(null)}
      >
        <ArrowLeft size={24} />
      </button>
      <div style={{ flex: 1 }}>
        <h1 className="att-title" style={{ margin: 0 }}>{selectedClass.subject_name} Marks Entry</h1>
       <p className="att-subtitle" style={{ margin: 0 }}>
  {/* 1. Try to get the Year (BE/TE/SE), otherwise fallback to the Dept Code */}
  {selectedClass.class_name && selectedClass.class_name !== "undefined" 
    ? selectedClass.class_name 
    : (selectedClass.department_code || "BE ECS")
  } • {selectedClass.group_name} • Internal Assessment
</p>
      </div>

      <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
        <button className="att-btn att-btn-secondary" onClick={handleDownloadReport}>
          <Download size={16} /> Cumulative Master Report
        </button>

        {user?.role_code === "FACULTY" && (
          <button className="att-btn att-btn-primary" onClick={handleSave}>
            <Save size={16} /> Save Progress
          </button>
        )}
      </div>
    </div>

{loading ? (

<div className="loader">Loading students...</div>

) : (

<div className="table-wrapper">

<table className="marks-table">

<thead>
<tr>
<th>Sr No</th>
<th>Roll No</th>
<th>Student Name</th>
<th>IT1 (25)</th>
<th>IT2 (25)</th>
<th>IT3 (25)</th>
<th>Final</th>
<th>Status</th>
</tr>
</thead>

<tbody>

{students.map((s,index)=>(

<tr key={s.student_id}>

<td>{index+1}</td>

<td>{s.roll_number || s.student_roll_number}</td>

<td>{s.student_name}</td>

<td>
<input
type="number"
value={s.it1 ?? ""}
disabled={user?.role_code !== "FACULTY"}
onChange={(e)=>handleMarkChange(s.student_id,"it1",e.target.value)}
/>
</td>

<td>
<input
type="number"
value={s.it2 ?? ""}
disabled={user?.role_code !== "FACULTY"}
onChange={(e)=>handleMarkChange(s.student_id,"it2",e.target.value)}
/>
</td>

<td>
<input
type="number"
value={s.it3 ?? ""}
disabled={user?.role_code !== "FACULTY"}
onChange={(e)=>handleMarkChange(s.student_id,"it3",e.target.value)}
/>
</td>

<td className={s.is_passing ? "pass":"fail"}>
{s.final_score}
</td>

<td>
<span className={s.is_passing ? "status pass":"status fail"}>
{s.is_passing ? "PASS":"FAIL"}
</span>
</td>

</tr>

))}

</tbody>

</table>

</div>

)}

</div>

);

};

export default InternalAssessment;