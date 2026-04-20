// ─── Knowledge Base ─────────────────────────────────────────────────────────
const KB = [
  // Greetings
  {
    patterns: [/^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening))/i],
    response: {
      text: "👋 Hello! I'm **EduBot**, your EduSphere AI assistant. How can I help you today?",
      quickReplies: [
        { label: "📊 Attendance", value: "How do I check attendance?" },
        { label: "📚 Student Portal", value: "Tell me about the student portal" },
        { label: "👩‍🏫 Faculty", value: "How does faculty assignment work?" },
        { label: "📁 Upload Data", value: "How do I upload student data?" },
      ],
    },
  },

// --- ATTENDANCE SPECIFIC RULES (Must go first) ---
  {
    patterns: [/mark attendance/i],
    response: {
      text: "✅ **Marking Attendance**\n\n1. Go to **Attendance** in the sidebar\n2. Select the **Class**, **Section**, and **Date**\n3. Toggle each student as Present / Absent / Late\n4. Click **Save** to submit\n\n💡 *Tip: Use bulk-mark to mark all present, then uncheck absentees.*",
      quickReplies: [
        { label: "View reports", value: "How to view attendance reports?" },
        { label: "Export attendance", value: "Can I export attendance data?" },
      ],
    },
  },
  {
    patterns: [/attendance report/i],
    response: {
      text: "📈 **Attendance Reports**\n\nYou can generate reports from the Attendance page:\n\n• Filter by **student**, **subject**, **class**, or **date range**\n• Visualise trends with built-in charts\n• Identify students with **< 75% attendance** automatically\n• Export to **Excel / PDF**",
      quickReplies: [
        { label: "Export data", value: "Can I export attendance data?" },
        { label: "Low attendance alerts", value: "How do low attendance alerts work?" },
      ],
    },
  },
  {
    patterns: [/low attendance|alert|threshold/i],
    response: {
      text: "🚨 **Low Attendance Alerts**\n\nEduSphere automatically flags students whose attendance drops below the configured threshold (default **75%**).\n\nTo configure:\n1. Go to **Academic Settings**\n2. Under **Attendance Rules**, set your minimum %\n3. Enable email notifications for parents/students",
    },
  },
  {
    patterns: [/export attendance/i],
    response: {
      text: "📤 **Exporting Attendance**\n\nFrom the Attendance page, click the **Export** button (top-right). You can export:\n\n• Current view as **Excel (.xlsx)**\n• Full term report as **PDF**\n• Raw CSV for third-party tools",
    },
  },

  // --- ATTENDANCE GENERIC RULE (Must go last so it doesn't hijack the others) ---
  {
    patterns: [/attendance/i],
    response: {
      text: "📊 **Attendance Tracking**\n\nEduSphere's attendance module lets you:\n\n• **Mark attendance** daily by class/section\n• **View reports** – per student, per subject, or by date range\n• **Set thresholds** – auto-flag students below a minimum %\n• **Export** attendance sheets as Excel or PDF\n\nNavigate to **Attendance** in the sidebar to get started.",
      quickReplies: [
        { label: "Mark attendance", value: "How do I mark attendance?" },
        { label: "Attendance reports", value: "How to view attendance reports?" },
        { label: "Low attendance alerts", value: "How do low attendance alerts work?" },
      ],
    },
  },
  // Student Portal
  {
    patterns: [/student portal|student dashboard/i],
    response: {
      text: "🎓 **Student Portal**\n\nStudents get their own dedicated dashboard where they can:\n\n• View **personal attendance** percentage\n• Check **timetable** and upcoming classes\n• See **counsellor / mentor** details\n• Access **notices and announcements**\n• Download **documents and reports**",
      quickReplies: [
        { label: "Student login", value: "How do students log in?" },
        { label: "Mentor details", value: "How does mentoring work?" },
        { label: "Timetable", value: "How does the timetable work?" },
      ],
    },
  },
  {
    patterns: [/student.*login|login.*student/i],
    response: {
      text: "🔐 **Student Login**\n\nStudents log in using credentials provided by the institution:\n\n• **Username**: usually their roll number or email\n• **Password**: set during account creation or via the Welcome Email\n\nNew students receive a **Welcome Email** with a setup link. They can also reset their password from the login page.",
    },
  },

  // Faculty
  {
    patterns: [/faculty assignment|faculty.*assign|assign.*faculty/i],
    response: {
      text: "👩‍🏫 **Faculty Assignments**\n\nThe Faculty Assignment module allows admins to:\n\n• Assign **subjects to faculty members** per class/section\n• View the **Allocation Matrix** to spot conflicts or gaps\n• Manage **Class Teacher** designations\n• Track faculty workload across departments",
      quickReplies: [
        { label: "Allocation Matrix", value: "What is the allocation matrix?" },
        { label: "Class teacher", value: "How to assign a class teacher?" },
        { label: "Timetable", value: "How does the timetable work?" },
      ],
    },
  },
  {
    patterns: [/allocation matrix/i],
    response: {
      text: "🗃️ **Allocation Matrix**\n\nThe Allocation Matrix gives a **bird's-eye view** of all subject-faculty assignments across classes:\n\n• Rows = Classes/Sections\n• Columns = Subjects\n• Cells = Assigned faculty member\n\nGaps (unassigned slots) are highlighted in red. You can click any cell to edit the assignment.",
    },
  },
  {
    patterns: [/class teacher/i],
    response: {
      text: "🏫 **Class Teacher Assignments**\n\nTo assign a Class Teacher:\n1. Go to **Class Teacher Assignments** in the sidebar\n2. Select the **Academic Year**, **Class**, and **Section**\n3. Choose the faculty member from the dropdown\n4. Save — the teacher now has access to class-specific dashboards",
    },
  },

  // Timetable
  {
    patterns: [/timetable|schedule/i],
    response: {
      text: "📅 **Timetable Manager**\n\nBuild and manage class timetables:\n\n• Drag-and-drop period editor\n• Auto-detect **faculty conflicts** across sections\n• Publish timetables to students and faculty\n• Print or export as PDF\n\nAccess via **Timetable Manager** in the sidebar.",
    },
  },

  // Counselling / Mentoring
  {
    patterns: [/counsel|mentor/i],
    response: {
      text: "💬 **Counselling & Mentoring**\n\nEduSphere's counselling module helps you:\n\n• Assign **counsellors/mentors** to student groups\n• Log **one-on-one sessions** with notes\n• Track student **well-being flags**\n• Mentors can view their **My Mentees Dashboard**\n\nGo to **Counsellor & Mentor Management** in the sidebar.",
      quickReplies: [
        { label: "Assign mentor", value: "How do I assign a mentor to students?" },
        { label: "View mentees", value: "How does the mentee dashboard work?" },
      ],
    },
  },
  {
    patterns: [/assign.*mentor|mentor.*assign/i],
    response: {
      text: "🔗 **Assigning Mentors**\n\n1. Navigate to **Counsellor & Mentor Management**\n2. Select a staff member as Mentor\n3. Add students to their mentee list (individually or by batch)\n4. Save — the mentor can now access their **My Mentees Dashboard**",
    },
  },
  {
    patterns: [/mentee dashboard/i],
    response: {
      text: "📋 **My Mentees Dashboard**\n\nMentors can view:\n\n• List of all assigned mentees with key stats\n• **Attendance summary** per mentee\n• Session logs and notes\n• Quick-flag students who need attention\n\nAccess via **My Mentees** in the sidebar (faculty view).",
    },
  },

  // Upload
  {
    patterns: [/upload|import|ingest|excel|xlsx/i],
    response: {
      text: "📁 **Uploading Student Data**\n\nEduSphere supports bulk data import via Excel:\n\n• Navigate to **Upload → ECS Upload Wizard**\n• Download the **template** (.xlsx) from the wizard\n• Fill in student data (name, roll no., class, section, etc.)\n• Upload and run **validation** — errors are highlighted\n• Review and **confirm import**\n\n📌 Import logs are saved automatically for audit trails.",
      quickReplies: [
        { label: "Download template", value: "Where do I get the upload template?" },
        { label: "Fix validation errors", value: "How do I fix upload validation errors?" },
        { label: "Import logs", value: "Where can I see import logs?" },
      ],
    },
  },
  {
    patterns: [/template|download template/i],
    response: {
      text: "📄 **Download Upload Template**\n\n1. Go to **Upload → ECS Upload Wizard**\n2. On Step 1, click **Download Template**\n3. Open in Excel / Google Sheets\n4. Fill in the required columns (marked with *)\n5. Save as **.xlsx** before uploading",
    },
  },
  {
    patterns: [/validation error|fix.*error|error.*upload/i],
    response: {
      text: "🛠️ **Fixing Validation Errors**\n\nAfter uploading, EduSphere checks each row. Common errors:\n\n| Error | Fix |\n|-------|-----|\n| Missing roll number | Ensure column B is filled |\n| Invalid class/section | Use exact values from dropdown |\n| Duplicate entry | Remove duplicate rows |\n| Wrong date format | Use DD/MM/YYYY |\n\nDownload the **Error Report** from the wizard, fix issues in Excel, and re-upload.",
    },
  },
  {
    patterns: [/import log|audit/i],
    response: {
      text: "🗂️ **Import Logs**\n\nAll upload sessions are logged automatically:\n\n• Go to **Upload → Import History**\n• View date, uploader, file name, and status\n• Download original files or error reports",
    },
  },

  // Staff Management
  {
    patterns: [/staff|staff management/i],
    response: {
      text: "👥 **Staff Management**\n\nManage all staff from one place:\n\n• **Add / Edit / Deactivate** staff accounts\n• Assign roles: *Admin*, *Faculty*, *Counsellor*, *Mentor*\n• Set department and subject expertise\n• Send password reset emails\n\nGo to **Staff Management** in the sidebar.",
    },
  },

  // Student Directory
  {
    patterns: [/student directory|student list|find student/i],
    response: {
      text: "🔍 **Student Directory**\n\nSearch and manage all student records:\n\n• Filter by **class, section, batch, or academic year**\n• View full student profile (contact, guardian, attendance)\n• Edit individual records\n• Export filtered list\n\nAccess via **Student Directory** in the sidebar.",
    },
  },

  // Academic Settings
  {
    patterns: [/academic setting|academic year|semester|configuration/i],
    response: {
      text: "⚙️ **Academic Settings**\n\nConfigure your institution's academic structure:\n\n• Set **Academic Years**, **Terms/Semesters**\n• Define **Classes, Sections, and Batches**\n• Configure the **Subject Catalog**\n• Set attendance and grading thresholds\n\nGo to **Academic Settings** in the sidebar.",
    },
  },

  // DocuSense
  {
    patterns: [/docusense|document.*analys|analys.*document|ai.*document/i],
    response: {
      text: "🤖 **DocuSense – AI Document Analysis**\n\nDocuSense uses AI to analyse uploaded documents:\n\n• Upload any PDF or Excel document\n• AI extracts key insights and summaries\n• Identify patterns in student data\n• Get recommendations for interventions\n\nAccess via **DocuSense** in the sidebar.",
    },
  },

  // Setup Wizard
  {
    patterns: [/setup|wizard|getting started|first time/i],
    response: {
      text: "🚀 **Getting Started – Setup Wizard**\n\nNew to EduSphere? The Setup Wizard guides you through:\n\n1. **Institution profile** – name, logo, contact\n2. **Academic year** setup\n3. **Classes & Sections** creation\n4. **Subject Catalog** configuration\n5. **Staff accounts** creation\n6. **Student import** via ECS Upload Wizard\n\nFind it at **Setup Wizard** in the sidebar.",
    },
  },

  // Password / Auth
  {
    patterns: [/password|reset password|forgot password/i],
    response: {
      text: "🔑 **Password Reset**\n\n**For staff/admin:**\n1. Go to the login page\n2. Click **Forgot Password**\n3. Enter your email — a reset link will be sent\n\n**For students:**\nAdmins can trigger a password reset from **Student Directory → student profile → Reset Password**.",
    },
  },

  // Subject Catalog
  {
    patterns: [/subject catalog|subject list|add subject/i],
    response: {
      text: "📖 **Subject Catalog**\n\nManage all subjects in one place:\n\n• Add subjects with code, name, and type (Theory/Practical)\n• Assign subjects to specific classes/batches\n• Set credit hours and exam weightings\n\nGo to **Subject Catalog** in the sidebar.",
    },
  },

  // My Class Dashboard
  {
    patterns: [/my class|class dashboard/i],
    response: {
      text: "🏫 **My Class Dashboard**\n\nDesigned for **Class Teachers**, this dashboard shows:\n\n• Attendance overview for your class\n• Student list with quick-access profiles\n• Upcoming events and notices\n• Pending tasks (attendance not marked, etc.)\n\nAvailable in the sidebar under **My Class**.",
    },
  },

  // Welcome Guide
  {
    patterns: [/welcome guide|help guide|documentation/i],
    response: {
      text: "📘 **Welcome Guide**\n\nThe Welcome Guide is a built-in help resource covering:\n\n• Platform overview and navigation\n• Role-based feature guides (Admin, Faculty, Student)\n• FAQ and troubleshooting tips\n\nAccess it from the **Welcome Guide** link in the sidebar.",
    },
  },

  // Roles & Permissions
  {
    patterns: [/role|permission|access level/i],
    response: {
      text: "🛡️ **Roles & Permissions**\n\nEduSphere has the following user roles:\n\n| Role | Access |\n|------|--------|\n| **Super Admin** | Full system access |\n| **Admin** | All modules except system config |\n| **Faculty** | Teaching modules, own timetable |\n| **Class Teacher** | Class dashboard + attendance |\n| **Counsellor/Mentor** | Counselling + mentee data |\n| **Student** | Student portal only |\n\nRoles are assigned in **Staff Management**.",
    },
  },

  // Help
  {
    patterns: [/help|support|contact|problem|issue|bug/i],
    response: {
      text: "🆘 **Need Help?**\n\nHere are your support options:\n\n• 📘 **Welcome Guide** – in-app documentation\n• 🤖 **EduBot** – ask me anything about EduSphere!\n• 📧 **Email Support** – support@edusphere.edu\n• 🐛 **Report a Bug** – use the feedback button in the sidebar\n\nWhat specific issue are you facing? I'll do my best to help!",
      quickReplies: [
        { label: "Attendance issue", value: "I have an attendance issue" },
        { label: "Upload problem", value: "I have an upload problem" },
        { label: "Login issue", value: "I can't log in" },
        { label: "Other", value: "I need help with something else" },
      ],
    },
  },

  // Thanks
  {
    patterns: [/thank|thanks|great|awesome|perfect|helpful/i],
    response: {
      text: "😊 You're welcome! Is there anything else I can help you with?",
      quickReplies: [
        { label: "📊 Attendance", value: "Tell me about attendance" },
        { label: "📁 Upload data", value: "How do I upload student data?" },
        { label: "✅ I'm good!", value: "No, that's all for now" },
      ],
    },
  },

  // Goodbye
  {
    patterns: [/bye|goodbye|see you|that'?s all|no.*thanks/i],
    response: {
      text: "👋 Goodbye! Feel free to come back anytime. Have a great day! 🌟",
    },
  },
];

// ─── AI Fallback ─────────────────────────────────────────────────────────────
// 🚀 This tells the frontend that no pre-written rule matched, so it should hit Django/Ollama
const FALLBACK = {
  isFallback: true, 
};

// ─── Main Routing Function ───────────────────────────────────────────────────
export function getBotResponse(input) {
  const trimmed = input.trim();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(trimmed))) {
      return entry.response;
    }
  }
  return FALLBACK;
}

// ─── Default Boot States ─────────────────────────────────────────────────────
export const WELCOME_MESSAGE = {
  role: "bot",
  text: "👋 Hi! I'm **EduBot**, your EduSphere AI assistant.\n\nI can help you with attendance, faculty assignments, student uploads, timetables, counselling, and more!\n\nWhat would you like to know?",
};

export const INITIAL_QUICK_REPLIES = [
  { label: "📊 Attendance", value: "How do I check attendance?" },
  { label: "📁 Upload data", value: "How do I upload student data?" },
  { label: "👩‍🏫 Faculty", value: "How does faculty assignment work?" },
];