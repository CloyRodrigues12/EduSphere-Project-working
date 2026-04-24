// ─── Knowledge Base ─────────────────────────────────────────────────────────
const KB = [
  // Greetings
  {
    patterns: [/^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening))/i],
    response: {
      text: "👋 Hello! I'm **EduBot**, your EduSphere AI assistant.\n\nI can help you navigate Attendance, Internal Assessments, Mentorship, Timetables, and Admin configurations.",
      quickReplies: [
        { label: "🏫 Class Teacher", value: "What does a class teacher do?" },
        { label: "💬 Mentorship", value: "How do I manage my mentees?" },
        { label: "📝 Assessments", value: "How do internal assessments work?" },
        { label: "📁 Admin Uploads", value: "How do I upload student data?" },
      ],
    },
  },

  // Class Teacher (Strict matching)
  {
    patterns: [/assign.*class teacher/i, /how to.*class teacher/i],
    response: {
      text: "🏫 **Assigning a Class Teacher**\n\nAdmins can assign this role by navigating to **Class Teacher Assignments** in the sidebar. Select the Academic Year, Class, and Section, then map the Faculty member.",
    },
  },
  {
    patterns: [/what.*class teacher/i, /class dashboard/i, /my class/i],
    response: {
      text: "🏫 **My Class Dashboard**\n\nIf you are assigned as a Class Teacher, you unlock the **My Class** dashboard! Here you can:\n\n• Track overall class attendance\n• Monitor Internal Assessment averages\n• View detailed profiles for every student in your class\n• Spot at-risk students instantly",
      quickReplies: [
        { label: "Duty Leaves", value: "How do duty leaves work?" },
      ],
    },
  },

  // Mentorship
  {
    patterns: [/assign.*mentor/i, /counsellor/i],
    response: {
      text: "💬 **Assigning Mentors**\n\nAdmins and HODs can map students to faculty mentors via the **Counsellor & Mentor Management** tab. Once mapped, the faculty member can view them in the My Mentees dashboard.",
    },
  },
  {
    patterns: [/my mentees/i, /manage.*mentees/i, /mentorship/i],
    response: {
      text: "📋 **My Mentees Dashboard**\n\nMentors can track their assigned students via the **My Mentees** tab. You can:\n\n• View their individual attendance and test scores\n• See their parent/guardian contact info\n• Send automated WhatsApp reports to parents directly from the portal",
    },
  },

  // Internal Assessments (NEW)
  {
    patterns: [/assessment/i, /marks/i, /grading/i, /it1/i, /it2/i],
    response: {
      text: "📝 **Internal Assessments**\n\nFaculty can enter IT1, IT2, and IT3 marks in the **Internal Assessment** module. The system automatically:\n\n• Calculates the best of 3 or average\n• Color-codes student status (Failing, Needs Effort, On Track)\n• Pushes these results to the Class Teacher and Mentor dashboards",
    },
  },

  // Duty Leaves (NEW)
  {
    patterns: [/duty leave/i, /sports leave/i, /hackathon/i],
    response: {
      text: "🏆 **Duty Leaves**\n\nStudents can apply for Duty Leaves (for sports, hackathons, etc.) via their portal. \n\nFaculty and Admins can approve or reject these requests in the **Duty Leave Dashboard**. Approved leaves are automatically factored into the student's final attendance percentage.",
    },
  },

  // Attendance (Ordered strictly: Specific first, Generic last)
  {
    patterns: [/mark attendance/i, /take attendance/i],
    response: {
      text: "✅ **Marking Attendance**\n\n1. Go to **Attendance** in the sidebar\n2. Select your Class, Section, and Subject\n3. Mark students Present/Absent/Late\n4. Click Save. \n\n*(Note: Duty Leaves are calculated automatically!)*",
    },
  },
  {
    patterns: [/attendance report/i, /export attendance/i],
    response: {
      text: "📈 **Attendance Reports**\n\nYou can generate and export visual attendance reports (Excel/PDF) directly from the **Attendance** dashboard. Students below 75% are automatically flagged in red.",
    },
  },
  {
    patterns: [/attendance/i],
    response: {
      text: "📊 **Attendance Tracking**\n\nEduSphere offers deep attendance tracking. Faculty mark daily sessions, and the data automatically syncs to the Mentor, Class Teacher, and Student portals.",
      quickReplies: [
        { label: "Mark attendance", value: "How do I mark attendance?" },
        { label: "Duty Leaves", value: "How do duty leaves work?" },
      ],
    },
  },

  // Faculty Matrix
  {
    patterns: [/allocation matrix/i, /assign faculty/i, /faculty assign/i],
    response: {
      text: "🗃️ **Faculty Allocation Matrix**\n\nAdmins use the **Allocation Matrix** to assign subjects to teachers. It provides a color-coded, bird's-eye view of all classes to instantly spot unassigned subjects or faculty workload conflicts.",
    },
  },

  // Admin Uploads
  {
    patterns: [/upload/i, /excel/i, /import/i, /ecs/i],
    response: {
      text: "📁 **ECS Upload Wizard**\n\nAdmins can bulk-import students using the ECS Upload Wizard. \n\n1. Download the Excel template\n2. Fill in the data (Roll No, Name, Contact, etc.)\n3. Upload it. The system will auto-validate for errors before saving to the database.",
    },
  },

  // Thanks & Goodbye
  {
    patterns: [/thank/i, /awesome/i, /perfect/i],
    response: {
      text: "😊 You're very welcome! Let me know if you need help with anything else.",
    },
  },
];

// ─── AI Fallback ─────────────────────────────────────────────────────────────
const FALLBACK = { isFallback: true };

export function getBotResponse(input) {
  const trimmed = input.trim();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(trimmed))) return entry.response;
  }
  return FALLBACK;
}

export const WELCOME_MESSAGE = {
  role: "bot",
  text: "👋 Hi! I'm **EduBot**, your EduSphere AI assistant.\n\nI can help you navigate Attendance, Assessments, Mentorship, Duty Leaves, and Admin settings.\n\nWhat do you need help with?",
};

export const INITIAL_QUICK_REPLIES = [
  { label: "🏫 Class Teacher", value: "What does a class teacher do?" },
  { label: "📝 Assessments", value: "How do internal assessments work?" },
  { label: "💬 Mentorship", value: "How do I manage my mentees?" },
];